import {
  maxColumns,
  type Kind,
  type DetectedCandidate,
} from "../detector/contracts";
export function candidateSignature(candidate: DetectedCandidate) {
  return JSON.stringify([
    candidate.id,
    candidate.kind,
    candidate.estimate,
    candidate.columns.map(({ id, label, kind }) => [id, label, kind]),
    candidate.rows,
  ]);
}

export function schemaSignature(candidate: DetectedCandidate) {
  return JSON.stringify([
    candidate.kind,
    candidate.columns.map(({ id, label, kind }) => [id, label, kind]),
  ]);
}

type ColumnTuple = [string, string, "text" | "url" | "image"];
export function readSchema(
  signature: string,
  kind: Kind,
): ColumnTuple[] | null {
  if (signature.length > 6000) return null;
  try {
    const parsed: unknown = JSON.parse(signature);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      parsed[0] !== kind ||
      !Array.isArray(parsed[1])
    )
      return null;
    const fields: unknown[] = parsed[1];
    if (!fields.length || fields.length > maxColumns) return null;
    const columns: ColumnTuple[] = [];
    const ids = new Set<string>();
    for (const field of fields) {
      if (!Array.isArray(field) || field.length !== 3) return null;
      const [id, label, type]: unknown[] = field;
      if (
        typeof id !== "string" ||
        !/^[a-z\d-]{1,24}$/i.test(id) ||
        ids.has(id) ||
        typeof label !== "string" ||
        label.length > 64 ||
        !(type === "text" || type === "url" || type === "image")
      )
        return null;
      ids.add(id);
      columns.push([id, label, type]);
    }
    return columns;
  } catch {
    return null;
  }
}
export function portableSchemaKey(signature: string, kind: Kind) {
  const columns = readSchema(signature, kind);
  if (!columns) return null;
  const keys = columns.map(([, label, fieldKind]) => {
    const normalized = label.normalize("NFC").replace(/\s+/gu, " ").trim();
    return normalized ? JSON.stringify([normalized, fieldKind]) : "";
  });
  if (keys.includes("") || new Set(keys).size !== keys.length) return null;
  return JSON.stringify(keys.sort());
}
