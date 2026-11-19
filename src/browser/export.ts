import { clipboardText, exportBlob, mimes } from "../core/export";
import {
  safeFilename,
  type ExportPlan,
  type Format,
} from "../core/export/plan";

interface SaveWritable {
  write: (blob: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
}
interface SaveOptions {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}
export type ExplicitSave = (
  options: SaveOptions,
) => Promise<{ createWritable: () => Promise<SaveWritable> }>;
const picker = () =>
  (window as Window & { showSaveFilePicker?: ExplicitSave }).showSaveFilePicker;
export function canChooseSaveLocation() {
  return typeof window !== "undefined" && typeof picker() === "function";
}
export async function saveWithPicker(
  blob: Blob,
  name: string,
  format: Format,
  choose: ExplicitSave,
) {
  let writable: SaveWritable | undefined;
  try {
    const handle = await choose({
      suggestedName: name,
      types: [
        {
          description: `${format.toUpperCase()} file`,
          accept: { [mimes[format].split(";")[0]!]: [`.${format}`] },
        },
      ],
    });
    writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved" as const;
  } catch (error) {
    if (
      !writable &&
      error instanceof DOMException &&
      error.name === "AbortError"
    )
      return "cancelled" as const;
    if (writable) await writable.abort().catch(() => {});
    throw new Error(
      "The file could not be saved. Check the destination and available space, or try a browser download.",
      { cause: error },
    );
  }
}
export function requestDownload(
  blob: Blob,
  name: string,
  doc: Document = document,
) {
  let url: string | undefined;
  let link: HTMLAnchorElement | undefined;
  try {
    url = URL.createObjectURL(blob);
    link = doc.createElement("a");
    link.href = url;
    link.download = name;
    link.hidden = true;
    doc.body.append(link);
    link.click();
    const current = url;
    setTimeout(() => URL.revokeObjectURL(current), 60_000);
  } catch {
    if (url) URL.revokeObjectURL(url);
    throw new Error(
      "Could not start the browser download. Try again or choose a save location.",
    );
  } finally {
    link?.remove();
  }
}
export async function saveExport(
  plan: ExportPlan,
  format: Format,
  stem: string,
  explicit: boolean,
) {
  const blob = exportBlob(plan, format);
  const name = safeFilename(stem, format);
  if (explicit) {
    const choose = picker();
    if (!choose)
      throw new Error(
        "A save location dialog is not available here. Use a browser download instead.",
      );
    const status = await saveWithPicker(
      blob,
      name,
      format,
      choose.bind(window),
    );
    return { status, name };
  }
  requestDownload(blob, name);
  return { status: "requested" as const, name };
}
export async function copyExport(plan: ExportPlan) {
  if (!navigator.clipboard?.writeText)
    throw new Error(
      "Clipboard access is unavailable. Download the records instead.",
    );
  try {
    await navigator.clipboard.writeText(clipboardText(plan));
  } catch {
    throw new Error(
      "Could not copy records. Focus the extension panel and try again, or download the records instead.",
    );
  }
}
