import { maxExportBytes, type ExportPlan, type Format } from "./plan";
import { delimited, jsonText } from "./text";
import { xlsxParts } from "./xlsx";
export const mimes: Record<Format, string> = {
  csv: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export function exportBlob(plan: ExportPlan, format: Format): Blob {
  const parts: BlobPart[] =
    format === "xlsx"
      ? xlsxParts(plan)
      : format === "csv"
        ? ["\uFEFF", delimited(plan, ",")]
        : [jsonText(plan)];
  const blob = new Blob(parts, { type: mimes[format] });
  if (blob.size > maxExportBytes)
    throw new Error("This file exceeds the supported export size.");
  return blob;
}
export function clipboardText(plan: ExportPlan) {
  const value = delimited(plan, "\t");
  if (value.length > maxExportBytes / 2)
    throw new Error(
      "This selection is too large for clipboard export. Download it as a file instead.",
    );
  return value;
}
