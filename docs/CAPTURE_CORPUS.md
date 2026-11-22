# Capturing real pages for the accuracy corpus

The committed corpus in `tests/fixtures/corpus/pages.ts` is written by us. It proves we do not
regress; it cannot prove real-world accuracy. That evidence comes from pages you are authorised
to analyse.

## Workflow

1. Open an authorised page in Chrome.
2. Paste [`tools/capture-page.js`](../tools/capture-page.js) into the DevTools console and run it.
   It downloads a single-file HTML snapshot and modifies nothing.
3. Save the file in `tests/fixtures/corpus/captured/`.
4. Add a sidecar with the same base name, for example `capture-shop-example.html.json`:

```json
{
  "note": "Product grid, 24 cards, ad row after 6",
  "kinds": ["products", "cards"],
  "minRows": 20,
  "maxRows": 30,
  "minColumns": 3,
  "maxColumns": 6
}
```

5. Run `npx playwright test tests/e2e/corpus.spec.ts` and read
   [`docs/reports/ACCURACY.md`](reports/ACCURACY.md).

## Rules

- Capture only pages you have permission to analyse.
- Captures are stored in the repository: check with the site owner before committing, and keep
  personal data out (use a logged-out view or a page without user content).
- The test run never fetches a live site. Fixtures are the only input, so runs stay deterministic
  and offline.
- Captured pages without a sidecar are listed in the report as **unscored**: they are exercised for
  crashes and shape reporting, but never counted toward the accuracy figure.
