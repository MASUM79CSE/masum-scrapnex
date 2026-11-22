# Phase 10 — Local persistence and history

**MASUM SCRAPNEXS · Development snapshot `0.1.0`**  
**Approval pending.** Phase 11 has not begun.

## Save, restore, and manage local data

1. Load the unpacked Chrome build and collect records from an authorized page. Edit the working dataset as needed. Expand **Save working snapshot**, enter a name, and save it. Nothing is saved automatically; later working changes do not change an existing snapshot.
2. Close Chrome and reopen the same browser profile with the same installed extension. Open **Local history** and select **Restore**. Restoring opens the saved rows and columns, including edits and partial-capture status, without reading, navigating, or resuming the source page. Discard or finish an existing working dataset before restoring another. Uncommitted working edits, grid filters/selection, and in-progress collection are not restored.
3. From a detected candidate preview, save a named configuration. It stores the HTTP(S) origin, candidate kind, and normalized schema signature, not example records or the source path. On the same origin, analyze the authorized tab again and select **Use configuration**. The selection requires exactly one candidate with a matching signature on a complete, current scan; it neither collects nor navigates.
4. In **Settings**, set the starting export format, additional pagination-action count, delay, and optional exact deduplication for new single-page captures. Pagination still requires per-run review and authorization and always skips exact duplicates. These preferences do not change restored rows. Appearance keeps its existing independent local preference.
5. Check snapshot payload usage and saved item counts in **Settings** or **Local history**. Delete individual items in history, clear snapshots or configurations independently, or run age-based snapshot cleanup (7, 30, or 90 days; default 30). Destructive UI actions require confirmation; changing the age setting does not delete records. Cleanup runs only when requested.

## Storage and limits

- Extension-local IndexedDB schema v2 keeps snapshot metadata, payloads, and configurations in separate stores. The v1 upgrade validates and moves inline payloads in one upgrade transaction; validation failure rolls it back. Data and metadata are written and deleted together. The settings parser recognizes the legacy v1 cleanup preference and upgrades it to the current version.
- Limits: 20 snapshots, 24 MiB of serialized UTF-8 snapshot datasets, and 50 configurations. The shown byte count is a payload estimate excluding browser overhead and metadata; it is not browser quota. The repository rejects new saves beyond the cap rather than evicting records. Browsers may impose their own limits or clear local data.
- Data is restricted to the current extension and browser profile. There is no backup, sync, cloud account, new manifest permission, or network request for persistence. Snapshot cells may contain sensitive text or URLs; save only data you are authorized to keep. Deleting a snapshot does not erase copies previously exported or copied. Removing the extension or its browser data can remove the local library.

## Verification

The Chromium restart test closes the first persistent browser context and relaunches Chromium with the same profile directory and unpacked extension path. It verifies restored edited records, deletion of a row before saving, retained preferences, and configuration reuse without collection. Other Chromium tests cover v1 migration and rollback, cleanup/deletion, and concurrent capacity enforcement. The local-history screenshot shows the packaged UI after restart in a Chromium test tab, not the native side panel. The test suite uses a loopback-only host grant in a build copy; the shipped manifest is unchanged. Other browsers and profile transfers were not verified.

**Final result:** 54 unit/component tests and 46 Chromium tests passed. Formatting, TypeScript, ESLint, the production build (520.35 kB), and Git whitespace checks passed. `npm audit` reported zero vulnerabilities. The Chrome manifest matches Phase 09 byte for byte. See [the checks transcript](PHASE_10_CHECKS.txt).

The storage scale test measured single save/restore calls using short synthetic records in Chromium IndexedDB. These observations are not performance guarantees. In the concurrent check, 20 of 25 saves committed and the other five were rejected at capacity.

| Rows | Serialized payload | Save | Restore |
| ---: | ---: | ---: | ---: |
| 100 | 5,400 B | 18.5 ms | 2.3 ms |
| 1,000 | 54,902 B | 13.7 ms | 7.1 ms |
| 10,000 | 567,904 B | 87.0 ms | 36.2 ms |

To reproduce:

```sh
npm ci
npx playwright install chromium
PHASE10_SCREENSHOT=/tmp/phase-10-local-history.png npm run test:e2e -- tests/e2e/library.spec.ts
```

**Approval gate: `APPROVE PHASE 10`**
