/** Initial versioned shapes; not a persistence schema or a collection implementation. */
export const SCHEMA_VERSION = 1 as const;
export const PRODUCT_NAME = "MASUM SCRAPNEXS";
/**
 * Injected from package.json at build time (`wxt.config.ts`). The fallback keeps unit
 * tests and any non-bundled consumer working without a define step.
 */
export const PRODUCT_VERSION: string =
  typeof __PRODUCT_VERSION__ === "string" ? __PRODUCT_VERSION__ : "0.1.0";

type SchemaVersion = typeof SCHEMA_VERSION;
export type CellValue = string | number | boolean | null;
export type FieldKind =
  | "visibleText"
  | "text"
  | "href"
  | "imageSrc"
  | "imageAlt"
  | "allowedAttribute";

export type ExtractionField = {
  id: string;
  label: string;
  relativeLocator: string;
} & (
  | { kind: Exclude<FieldKind, "allowedAttribute"> }
  | { kind: "allowedAttribute"; attributeName: string }
);

export interface ExtractionConfiguration {
  schemaVersion: SchemaVersion;
  id: string;
  name: string;
  origin: string;
  rowLocator: string;
  fields: readonly ExtractionField[];
}

export interface ExtractionColumn {
  id: string;
  label: string;
  exportKey: string;
}

export interface ExtractionRecord {
  id: string;
  order: number;
  values: Readonly<Record<string, CellValue>>;
}

export interface ExtractionSession {
  schemaVersion: SchemaVersion;
  id: string;
  configuration: ExtractionConfiguration;
  status:
    | "draft"
    | "awaitingApproval"
    | "running"
    | "paused"
    | "needsReview"
    | "completed"
    | "stopped"
    | "failed";
  revision: number;
}
