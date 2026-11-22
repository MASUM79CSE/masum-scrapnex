# Phase 09 — Export engine

**MASUM SCRAPNEXS · Development snapshot `0.1.0`**  
**Implemented and verified; approval pending.** Phase 10 has not begun.

## Use and reproduce

1. Load the Chrome build unpacked, open an authorized page through the toolbar popup, and collect a working dataset. This works with single-page detection, manual collection, and pagination results.
2. Expand **Export and copy records** below the grid. Select **All records**, **Filtered and sorted view**, or **Selected records**. Selected rows stay selected when hidden by a filter. The all/selected scopes use working dataset order; the filtered scope uses the current filter and sort. These scopes are independent of which rows the virtualized table has currently rendered. Use **Columns to include** to retain only the fields you need, in their current working order.
3. Choose **CSV**, **Excel workbook**, or **JSON**, then review the filename and click **Download**. The extension confirms the browser request, not a completed disk write. If offered, **Choose save location** lets Chrome prompt for a destination; this path distinguishes successful file close, cancellation, and an I/O failure. Retry using the browser download when necessary.
4. **Copy all records**, **Copy selected records**, and **Copy filtered records** use the current row scope and column selection. Copy occurs only on an explicit click. The extension does not read the clipboard. Clipboard contents can outlive the extension session.

Actual example files `scrapnexs-phase-09-fixture.csv`, `.xlsx`, and `.json` come from the packaged extension's Chromium download workflow. Their controlled inventory has three rows with Bangla text, leading zeroes, a multiline string containing delimiters and quotes, literal `=1+1` text, and blank versus missing values. Regenerate the files from the source tree with pinned Node and the installed Chromium test runtime:

```sh
mkdir -p /tmp/scrapnexs-exports
PHASE9_ARTIFACTS=/tmp/scrapnexs-exports npm run test:e2e -- tests/e2e/detector.spec.ts -g 'export downloads real'
python tests/qa/verify_phase_09_exports.py /tmp/scrapnexs-exports
```

The optional independent Python check uses `openpyxl`; it is not required by the extension or Node test suite.

## Format behavior and safeguards

| Format | Format and data behavior |
| --- | --- |
| CSV | UTF-8 with BOM, comma-separated, CRLF record endings, header row, quoted strings with doubled embedded quotes. Missing cells are bare empty fields and explicit empty strings are quoted; ordinary CSV readers can present both as blank. Formula-like text, including triggers after leading whitespace or control/format characters, is prefixed with an apostrophe for spreadsheet import safety. |
| Excel workbook | Valid OOXML `.xlsx` with one `Captured records` sheet. Data and header values are inline strings, never formulas, hyperlinks, or inferred numbers. A leading zero stays a string. Missing cells are omitted; explicit blanks are inline empty strings. XML-forbidden characters and lone surrogates are replaced; ordinary text, including Bangla, is preserved. No macros or external relationships. |
| JSON | Readable UTF-8 JSON with version, column descriptors, and records keyed by the visible column labels. Values remain `string` or `null`, and the empty string is preserved. No spreadsheet apostrophe is added. |
| Clipboard | Quoted, tab-separated text with headers and the same formula protection as CSV. The application receiving the clipboard data controls its parsing. |

An application importing CSV may coerce numeric-looking text, strip protective prefixes on re-export, or handle separators differently. Use XLSX when spreadsheet cell typing or leading zeros matter, and JSON for lossless string/null data exchange. The extension leaves the working dataset unchanged.

- File names are bounded, Unicode-aware leaf names with unsafe characters and platform-reserved names handled before a fixed format suffix is applied.
- Export does not introduce network calls, remote libraries or browser permissions. XLSX uses a bounded ZIP32 store writer and a fixed set of OOXML parts instead of adding an export dependency. Downloads use temporary blob URLs with cleanup. The clipboard write uses the focused panel's user gesture; denied or unavailable clipboard output can be retried or downloaded.
- Empty row or column selections do not create a file. Limits: 10,000 dataset rows, up to 12 columns, two million cell data units, and a 32 MiB output ceiling. Large files are generated locally as bounded blobs; file generation does not scrape more records. Native platform save dialogs and Microsoft Excel's UI were not exercised by the automated suite.

## Verification

Chromium downloads real CSV/XLSX/JSON files from the packaged side panel, verifies export selection across a filter, tests clipboard write on a trusted click, and injects a deterministic save-destination failure to verify UI feedback and browser-download retry. The loopback page's host grant is test-only. Independent QA reads the downloaded bytes with Python's CSV/JSON/ZIP/XML readers and `openpyxl`, including literal formula-looking strings in the XLSX. The screenshot is the packaged panel in a test tab, not a native side-panel screenshot.

Final checks: **50 unit/component tests and 42 Chromium tests passed**. Formatting, TypeScript, ESLint, production build, diff checks, and independent artifact validation passed; `npm audit` found zero vulnerabilities. See [the checks transcript](PHASE_09_CHECKS.txt).

### Bounded data measurements

Single-run serialization on the pinned Node runtime, using three short columns. Times cover construction of the file blob, not saving, clipboard transfer, or browser interactions. Measurements are observations, not guarantees.

| Records | CSV | XLSX | JSON |
| ---: | ---: | ---: | ---: |
| 100 | 3.60 ms / 4,526 B | 0.99 ms / 27,926 B | 0.27 ms / 16,274 B |
| 1,000 | 3.12 ms / 45,927 B | 13.06 ms / 261,936 B | 2.18 ms / 162,076 B |
| 10,000 | 28.02 ms / 468,928 B | 60.43 ms / 2,646,946 B | 24.43 ms / 1,638,078 B |

**Approval gate: `APPROVE PHASE 09`**
