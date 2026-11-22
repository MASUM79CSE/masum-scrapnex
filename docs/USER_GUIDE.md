# MASUM SCRAPNEXS — user guide

A local-first workspace for collecting structured data from pages you are authorised to analyse.
Nothing is uploaded; there is no account and no cloud.

## Install

1. Unzip the release archive.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, select the
   folder containing `manifest.json` (not the ZIP itself).

## Collect a table or listing

1. Open the page. Click the toolbar icon, then **Open side panel**.
2. Click **Analyze page**. The extension reads the page only after this click.
3. Choose a suggestion. The preview shows up to six observed rows — check it before collecting.
4. Click **Collect records**.
5. Edit, sort, filter or delete in **Working dataset**, then export.

## Point and click instead

Choose **Pick elements** when detection is wrong. Hover to highlight, click to select a row,
then use *parent/child* controls to correct the scope, choose fields, and confirm the preview.

## Multi-page collection

For detected tables and listings you can authorise a bounded run: Next, numbered pages, URL
patterns, Load More, or scroll. Every action is explicit, and you set the page count, delay and
time budget. Pause, resume or stop at any time; verified rows are kept.

## Keep, reuse, share

- **Save** a snapshot to reuse after a restart (local only, with retention cleanup).
- Save a **configuration** to re-select the same structure on future visits after a fresh scan.
- **Download/import configuration** to move a setup between machines — review the site and fields
  before confirming.

## Export

CSV (UTF-8, optional BOM), XLSX (inline literals, no formulas) and JSON (typed). Copy to clipboard
as tab-separated text. Formula-like text is neutralised for spreadsheet safety.

## What it cannot do

- Pagination works for detected structures; the manual picker is single-page.
- No cross-origin collection, and no capture from a page you have not invoked the extension on.
- JavaScript-only infinite scroll without DOM growth, nested scroll containers, and automatic
  retry after a failed page are out of scope for v1.
- Already-performed page actions (a click that loaded a page) cannot be undone.
- Verified on Chrome for Testing 159 only; see [BROWSER_MATRIX.md](BROWSER_MATRIX.md).
- English-only interface in v1.

## Responsible use

Collect only data you are permitted to collect. Respect site terms, robots directives, rate
limits, personal data and copyright. The extension deliberately does not bypass authentication,
paywalls or anti-bot measures, and it sends nothing to any server.
