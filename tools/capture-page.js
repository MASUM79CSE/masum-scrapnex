/*
 * Capture a page you are authorised to analyse into an offline corpus fixture.
 *
 * How to use
 *   1. Open the page in Chrome.
 *   2. Open DevTools → Console, paste this whole file, press Enter.
 *   3. A file named "capture-<host>-<timestamp>.html" downloads.
 *   4. Move it into tests/fixtures/corpus/captured/ and add a
 *      "<same-name>.json" sidecar with the expected structure (see CAPTURE_CORPUS.md).
 *
 * The capture is a local file. Nothing is uploaded, and the page is not modified.
 * Only capture pages you have permission to analyse.
 */
(() => {
  const clone = document.documentElement.cloneNode(true);
  // Drop script contents: the corpus tests only need markup and layout.
  for (const el of clone.querySelectorAll("script, noscript, template"))
    el.remove();
  // Strip extension-injected nodes if any (never expected, but keeps fixtures clean).
  for (const el of clone.querySelectorAll("[data-scrapnex]")) el.remove();

  const html = `<!doctype html>\n${clone.outerHTML}`;
  const host = location.hostname.replace(/[^a-z0-9.-]/gi, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = `capture-${host}-${stamp}.html`;
  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  console.log(
    `Captured ${(html.length / 1024).toFixed(1)} KiB → ${name}\n` +
      "Now write the sidecar JSON described in docs/CAPTURE_CORPUS.md",
  );
})();
