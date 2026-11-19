import {
  isCollectionResult,
  type CollectionResult,
} from "../extraction/contracts";
import { maxCellChars } from "../detector/contracts";

export const pickerPortName = "scrapnex/manual-picker/v1";
export const fieldKinds = [
  "text",
  "link",
  "image",
  "alt",
  "attribute",
] as const;
export const allowedAttributes = [
  "title",
  "datetime",
  "data-title",
  "data-price",
  "data-category",
  "data-sku",
  "data-rating",
] as const;
export type FieldKind = (typeof fieldKinds)[number];
export type AllowedAttribute = (typeof allowedAttributes)[number];
export type FieldRule =
  | { kind: Exclude<FieldKind, "attribute"> }
  | { kind: "attribute"; attribute: AllowedAttribute };
export const maxFields = 8;
export const maxRows = 6;
export type PickerCommand =
  | {
      v: 1;
      action: "pick-row" | "parent" | "child" | "confirm" | "collect" | "stop";
    }
  | { v: 1; action: "pick-field"; rule: FieldRule }
  | { v: 1; action: "remove-field"; index: number };
export type PickerPhase = "pick-row" | "pick-field" | "review";
export interface PickerPreview {
  selector: string;
  observed: number;
  sampled: boolean;
  canParent: boolean;
  canChild: boolean;
  columns: { label: string; selector: string }[];
  rows: (string | null)[][];
  explicitFields: boolean;
}
export interface PickerState {
  phase: PickerPhase;
  hint: string;
  preview: PickerPreview | null;
}
export type PickerEvent =
  | { v: 1; type: "collected"; result: CollectionResult }
  | { v: 1; type: "state"; state: PickerState }
  | {
      v: 1;
      type: "ended";
      reason: "cancelled" | "page-changed" | "expired" | "confirmed";
      preview: PickerPreview | null;
    };

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
export function isFieldRule(value: unknown): value is FieldRule {
  if (!object(value) || !fieldKinds.some((kind) => kind === value.kind))
    return false;
  return value.kind === "attribute"
    ? Object.keys(value).length === 2 &&
        allowedAttributes.some((name) => name === value.attribute)
    : Object.keys(value).length === 1;
}
export function isPickerCommand(value: unknown): value is PickerCommand {
  if (!object(value) || value.v !== 1) return false;
  if (value.action === "pick-field")
    return Object.keys(value).length === 3 && isFieldRule(value.rule);
  if (value.action === "remove-field")
    return (
      Object.keys(value).length === 3 &&
      typeof value.index === "number" &&
      Number.isInteger(value.index) &&
      value.index >= 0 &&
      value.index < maxFields
    );
  return (
    Object.keys(value).length === 2 &&
    ["pick-row", "parent", "child", "confirm", "collect", "stop"].some(
      (action) => action === value.action,
    )
  );
}
function isPreview(value: unknown): value is PickerPreview {
  if (
    !object(value) ||
    !text(value.selector, 720) ||
    typeof value.observed !== "number" ||
    !Number.isInteger(value.observed) ||
    value.observed < 1 ||
    value.observed > 129 ||
    typeof value.canParent !== "boolean" ||
    typeof value.canChild !== "boolean" ||
    typeof value.sampled !== "boolean" ||
    typeof value.explicitFields !== "boolean"
  )
    return false;
  const { columns, rows } = value;
  return (
    Array.isArray(columns) &&
    columns.length > 0 &&
    columns.length <= maxFields &&
    columns.every(
      (col: unknown) =>
        object(col) && text(col.label, 60) && text(col.selector, 720),
    ) &&
    Array.isArray(rows) &&
    rows.length <= maxRows &&
    rows.length <= value.observed &&
    rows.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.length === columns.length &&
        row.every(
          (value: unknown) => value === null || text(value, maxCellChars),
        ),
    )
  );
}
export function isPickerEvent(value: unknown): value is PickerEvent {
  if (!object(value) || value.v !== 1) return false;
  if (value.type === "collected") return isCollectionResult(value.result);
  if (value.type === "state") {
    const state = value.state;
    return (
      object(state) &&
      ["pick-row", "pick-field", "review"].some(
        (phase) => state.phase === phase,
      ) &&
      text(state.hint, 300) &&
      (state.preview === null || isPreview(state.preview))
    );
  }
  return (
    value.type === "ended" &&
    ["cancelled", "page-changed", "expired", "confirmed"].some(
      (reason) => value.reason === reason,
    ) &&
    (value.reason === "confirmed"
      ? isPreview(value.preview)
      : value.preview === null)
  );
}
