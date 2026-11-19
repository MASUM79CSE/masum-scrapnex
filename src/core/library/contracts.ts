import { formats, type Format } from "../export/plan";
import { isSettings } from "../pagination/contracts";
import {
  candidateLabels,
  maxCellChars,
  maxColumns,
  type Column,
  type DetectedCandidate,
  type PageDetection,
} from "../detector/contracts";
import {
  maxDatasetRows,
  maxDatasetUnits,
  normalizeCell,
  type Dataset,
} from "../extraction/contracts";
import { schemaSignature } from "../extraction/signature";

export const libraryName = "masum-scrapnexs-library";
export const libraryVersion = 2;
export const maxSessions = 20;
export const maxRecipes = 50;
export const maxLibraryBytes = 24 * 1024 * 1024;
const utf8 = new TextEncoder();
const idPattern = /^[a-z0-9-]{1,64}$/i;
export const dayMs = 86_400_000;
export interface SessionSummary {
  id: string;
  name: string;
  savedAt: number;
  rows: number;
  columns: number;
  byteCount: number;
  partial: boolean;
}
export interface SavedSession extends SessionSummary {
  dataset: Dataset;
}
export interface Recipe {
  id: string;
  name: string;
  savedAt: number;
  origin: string;
  kind: DetectedCandidate["kind"];
  signature: string;
}
export type CleanupDays = 7 | 30 | 90;
export interface StorageSettings {
  version: 2;
  cleanupDays: CleanupDays;
  exportFormat: Format;
  pageDelay: number;
  pageSteps: number;
  deduplicate: boolean;
}
export type WorkflowDefaults = Omit<StorageSettings, "version" | "cleanupDays">;
export const defaultStorageSettings: StorageSettings = {
  version: 2,
  cleanupDays: 30,
  exportFormat: "csv",
  pageDelay: 1000,
  pageSteps: 3,
  deduplicate: false,
};
export const storageSettingsKey = "localLibrarySettings";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const safeInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
export function cleanedName(value: string) {
  const name = value
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim()
    .slice(0, 80)
    .trimEnd();
  if (!name) throw new Error("Enter a name for this saved item.");
  return name;
}
function validColumn(value: unknown): value is Column {
  return (
    object(value) &&
    string(value.id, 24) &&
    idPattern.test(value.id) &&
    string(value.label, 64) &&
    ["text", "url", "image"].includes(value.kind as string)
  );
}
export function isStoredDataset(value: unknown): value is Dataset {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.columns) ||
    value.columns.length < 1 ||
    value.columns.length > maxColumns ||
    !Array.from(value.columns as unknown[]).every(validColumn) ||
    !Array.isArray(value.rows) ||
    value.rows.length > maxDatasetRows
  )
    return false;
  const columns = value.columns as Column[];
  if (new Set(columns.map((c) => c.id)).size !== columns.length) return false;
  const ids = new Set<string>();
  let units = 0;
  for (const row of value.rows as unknown[]) {
    if (
      !object(row) ||
      !string(row.id, 12) ||
      !/^r[1-9]\d{0,9}$/.test(row.id) ||
      ids.has(row.id) ||
      !Array.isArray(row.cells) ||
      row.cells.length !== columns.length
    )
      return false;
    ids.add(row.id);
    for (const [i, cell] of (row.cells as unknown[]).entries()) {
      if (
        cell !== null &&
        (typeof cell !== "string" ||
          cell.length > maxCellChars ||
          normalizeCell(cell, columns[i]!.kind) !== cell)
      )
        return false;
      units += Math.max(1, typeof cell === "string" ? cell.length : 0);
      if (units > maxDatasetUnits) return false;
    }
  }
  return true;
}
export function canonicalOrigin(input: string) {
  try {
    const url = new URL(input);
    return /^https?:$/.test(url.protocol) &&
      !url.username &&
      !url.password &&
      url.origin.length <= 255
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
export function isSummary(value: unknown): value is SessionSummary {
  return (
    object(value) &&
    string(value.id, 64) &&
    idPattern.test(value.id) &&
    string(value.name, 80) &&
    safeInt(value.savedAt, 0, 8.64e15) &&
    safeInt(value.rows, 1, maxDatasetRows) &&
    safeInt(value.columns, 1, maxColumns) &&
    safeInt(value.byteCount, 1, maxLibraryBytes) &&
    typeof value.partial === "boolean"
  );
}
export function plainSnapshot(dataset: Dataset): Dataset {
  if (!isStoredDataset(dataset))
    throw new Error("This working copy cannot be saved.");
  return {
    version: 1,
    columns: dataset.columns.map(({ id, label, kind }) => ({
      id,
      label,
      kind,
    })),
    rows: dataset.rows.map(({ id, cells }) => ({ id, cells: [...cells] })),
  };
}
export const snapshotBytes = (dataset: Dataset) =>
  utf8.encode(JSON.stringify(dataset)).length;
export function snapshotSummary(
  id: string,
  name: string,
  savedAt: number,
  partial: boolean,
  dataset: Dataset,
): SessionSummary {
  if (!isStoredDataset(dataset) || !dataset.rows.length)
    throw new Error("This working copy cannot be saved.");
  const summary = {
    id,
    name: cleanedName(name),
    savedAt,
    partial,
    rows: dataset.rows.length,
    columns: dataset.columns.length,
    byteCount: snapshotBytes(plainSnapshot(dataset)),
  };
  if (!isSummary(summary))
    throw new Error("The snapshot exceeds the local storage limits.");
  return summary;
}
export function isRecipe(value: unknown): value is Recipe {
  return (
    object(value) &&
    string(value.id, 64) &&
    idPattern.test(value.id) &&
    string(value.name, 80) &&
    safeInt(value.savedAt, 0, 8.64e15) &&
    string(value.origin, 255) &&
    canonicalOrigin(value.origin) === value.origin &&
    typeof value.kind === "string" &&
    Object.hasOwn(candidateLabels, value.kind) &&
    string(value.signature, 6000)
  );
}
export function newRecipe(
  name: string,
  origin: string,
  candidate: DetectedCandidate,
  id: string,
  savedAt: number,
): Recipe {
  const recipe = {
    name: cleanedName(name),
    origin: canonicalOrigin(origin),
    kind: candidate.kind,
    signature: schemaSignature(candidate),
    id,
    savedAt,
  };
  if (!isRecipe(recipe))
    throw new Error("This detected configuration cannot be saved.");
  return recipe;
}
export function matchRecipe(
  recipe: Recipe,
  origin: string | null,
  report: PageDetection | null,
) {
  if (origin !== recipe.origin || report?.status !== "complete")
    return undefined;
  const matches = report.candidates.filter(
    (c) => c.kind === recipe.kind && schemaSignature(c) === recipe.signature,
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function cleanupDays(value: unknown): value is CleanupDays {
  return value === 7 || value === 30 || value === 90;
}
export function parseStorageSettings(input: unknown): StorageSettings {
  if (input === undefined) return { ...defaultStorageSettings };
  if (!object(input))
    throw new Error("Local storage preferences are not readable.");
  const days =
    input.version === 1
      ? input.retentionDays
      : input.version === 2
        ? input.cleanupDays
        : null;
  const unsupported = () =>
    new Error("Local storage preferences use an unsupported format.");
  if (!cleanupDays(days)) throw unsupported();
  if (input.version === 1)
    return { ...defaultStorageSettings, cleanupDays: days };
  const {
    exportFormat = defaultStorageSettings.exportFormat,
    pageDelay = defaultStorageSettings.pageDelay,
    pageSteps = defaultStorageSettings.pageSteps,
    deduplicate = defaultStorageSettings.deduplicate,
  } = input;
  const format = formats.find((format) => format === exportFormat);
  if (
    !format ||
    typeof pageDelay !== "number" ||
    typeof pageSteps !== "number" ||
    !isSettings({ steps: pageSteps, delay: pageDelay }) ||
    typeof deduplicate !== "boolean"
  )
    throw unsupported();
  return {
    version: 2,
    cleanupDays: days,
    exportFormat: format,
    pageDelay,
    pageSteps,
    deduplicate,
  };
}
