import { readSchema } from "../extraction/signature";
import { candidateLabels, type Kind } from "../detector/contracts";
import {
  canonicalOrigin,
  cleanedName,
  isRecipe,
  type Recipe,
} from "./contracts";

export const configurationFileLimit = 24 * 1024;
const tag = "masum-scrapnexs-configuration";
export type PortableConfiguration = Pick<
  Recipe,
  "name" | "origin" | "kind" | "signature"
>;
function exactKeys(
  object: unknown,
  keys: string[],
): object is Record<string, unknown> {
  return (
    !!object &&
    typeof object === "object" &&
    !Array.isArray(object) &&
    Object.keys(object).length === keys.length &&
    keys.every((key) => Object.hasOwn(object, key))
  );
}
export function decodeConfiguration(text: string): PortableConfiguration {
  if (
    text.length > configurationFileLimit ||
    new TextEncoder().encode(text).length > configurationFileLimit
  )
    throw new Error("Configuration files must be 24 KiB or smaller.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This configuration file is not valid JSON.");
  }
  if (
    !exactKeys(data, ["format", "version", "configuration"]) ||
    data.format !== tag ||
    data.version !== 1
  )
    throw new Error("Unsupported configuration file format or version.");
  const fields = data.configuration;
  if (!exactKeys(fields, ["name", "origin", "kind", "signature"]))
    throw new Error("Unexpected fields in the configuration file.");
  const { name, origin, kind, signature } = fields;
  if (
    typeof name !== "string" ||
    !name ||
    name.length > 80 ||
    name !== cleanedName(name) ||
    typeof origin !== "string" ||
    canonicalOrigin(origin) !== origin ||
    typeof kind !== "string" ||
    !Object.hasOwn(candidateLabels, kind) ||
    typeof signature !== "string"
  )
    throw new Error("Invalid configuration name, site, or schema.");
  const columns = readSchema(signature, kind as Kind);
  if (!columns) throw new Error("Invalid configuration field layout.");
  return {
    name,
    origin,
    kind: kind as Kind,
    signature: JSON.stringify([kind, columns]),
  };
}
export function encodeConfiguration(recipe: Recipe) {
  const { name, origin, kind, signature } = recipe;
  const text =
    JSON.stringify(
      {
        format: tag,
        version: 1,
        configuration: { name, origin, kind, signature },
      },
      null,
      2,
    ) + "\n";
  decodeConfiguration(text);
  return text;
}
export function importedConfiguration(
  data: PortableConfiguration,
  id: string,
  savedAt: number,
): Recipe {
  const record = { ...data, id, savedAt };
  if (!isRecipe(record)) throw new Error("This configuration cannot be saved.");
  const verified = decodeConfiguration(encodeConfiguration(record));
  return { ...verified, id, savedAt };
}
