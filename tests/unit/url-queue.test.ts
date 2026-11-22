import { expect, it } from "vitest";
import { maxQueuedPages, parseQueue } from "../../src/browser/url-queue";
it("normalizes deterministically, preserves exact targets and deduplicates in order", () => {
  expect(
    parseQueue(
      " HTTPS://example.test:443/one?q=2#x\r\n\nhttps://example.test/one?q=2#x\rhttps://other.test ",
    ),
  ).toEqual(["https://example.test/one?q=2#x", "https://other.test/"]);
});
it("rejects partial, unsupported, ambiguous, oversized and credential-bearing input", () => {
  for (const invalid of [
    "/path",
    "example.test",
    "https://user:secret@example.test/",
    "chrome://extensions",
    "https://chromewebstore.google.com/detail/x",
    "https://example.test\\bar",
    "https://example.test/a b",
    "https://example.test/\u200b",
    "https://example.test/" + "a".repeat(2048),
    Array.from(
      { length: maxQueuedPages + 1 },
      (_, i) => `https://example.test/${i}`,
    ).join("\n"),
  ])
    expect(() => parseQueue(`https://valid.test/\n${invalid}`)).toThrow();
});
