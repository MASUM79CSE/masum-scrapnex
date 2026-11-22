import { describeTab } from "./ports";

export const maxQueuedPages = 12;
export const maxQueueText = 12_000;
export function parseQueue(text: string): string[] {
  if (text.length > maxQueueText) throw new Error("The URL list is too long.");
  const lines = text
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > maxQueuedPages)
    throw new Error(
      `Enter between 1 and ${maxQueuedPages} URLs, one per line.`,
    );
  const result = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (
      !/^https?:\/\//i.test(line) ||
      /[\p{Cc}\p{Cf}\s\\]/u.test(line) ||
      line.length > 2048 ||
      describeTab({ id: 0, windowId: 0, url: line }).state !== "available"
    )
      throw new Error(
        `Line ${index + 1} is not a supported absolute HTTP(S) URL.`,
      );
    const href = new URL(line).href;
    if (href.length > 2048)
      throw new Error(`Line ${index + 1} is too long after normalization.`);
    result.add(href);
  }
  return [...result];
}
