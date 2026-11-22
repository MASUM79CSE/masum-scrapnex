# MASUM SCRAPNEXS — Architecture

**Phase 01 design proposal; not implemented.**

## Boundaries and Chrome MV3 flow

| Layer | Runs where | Owns |
|---|---|---|
| Presentation | Popup, side panel, options (React) | Tab context, actions/consent, candidate preview, virtualized grid, settings. Export blobs are created in an extension page or UI-owned worker. |
| Application | MV3 service worker and extension UI use cases | Service worker validates and dispatches commands, coordinates leases and persists batches/checkpoints. UI requests snapshots/updates; not the authoritative job state. |
| Page integration | Top frame, isolated-world content script, injected on demand | Adapts live DOM signals, picker overlay, scoped observations, bounded DOM actions/read operations. Sends serializable results; never runs arbitrary code from page or recipe. |
| Domain | TypeScript; DOM access via narrow interfaces | Tables, repeated structures, field rules, normalization, dataset transforms, scoring and job state transitions. No Chrome/React imports, transport or networking. |
| Infrastructure | Extension origin and adapters | Permission/session messaging, IndexedDB, settings, file save, local export serializers. No backend. |

Toolbar invocation grants `activeTab`; popup opens panel from a user gesture (Chrome 116+ proposed). A persistent panel is not itself permission to scan a new tab. Pin a run to its originating tab, origin and top-frame document epoch. Background injects a packaged entrypoint and obtains a capability handshake before sending commands. Locally aggregate preview to a small sample; send capped row batches with acknowledgements. No bulk DOM snapshots cross the boundary. On a full same-origin reload, content context is replaced; reacquire and revalidate permission, document and expected result before proceeding. An SPA route may change without replacing the document: require a meaningful source-region change, not only a URL change.

### Proposed browser ports

- **TabContext:** resolve a user-invoked tab, identify supported page/document, inject top-frame packaged agent, and watch close/navigation. Block restricted or unsupported tabs with explicit reason.
- **SessionTransport:** typed request/response and reconnect, bound to tab, top frame, document epoch, request/run IDs. Use native document identity where supported and an agent epoch as part of the handshake. Reject stale replies.
- **UserPermission/Workspace:** derive access state, route authorization prompts to user gestures, open side panel or equivalent workspace. Expose capability flags instead of assuming parity.
- **SettingsStore/FileSave:** small local data and user-triggered blob save; isolate browser specifics and fall back to ordinary browser file-save behavior. IndexedDB repository remains separate.

## Detection and extraction

1. **Scan:** bounded, cancellable `TreeWalker` traversal; inspect semantic tags/roles and direct children; cache visibility and features for the current epoch only. Exclude hidden/disconnected/inert elements, forms and non-content nodes; keep offscreen but rendered content. Yield between chunks, enforce node/time/cell budgets and report incomplete scans. A mutation can invalidate the relevant region; do not rescan the whole page on each change.
2. **Tables:** project direct rows by table section and cell ownership (`closest('table')` must match). Build a rectangular occupancy grid using `rowSpan`, `colSpan` and section boundaries (including `rowspan=0` through section end). Infer headers from `thead`, explicit associations and consistent leading `th`; use composed multi-level paths or `Column n`. Default `tfoot` to summary, not data. Missing cell is `null`; an empty existing cell is `""`. Row-spanning data applies to covered rows; horizontally merged body-cell values stay in the anchor column with covered positions represented as null plus span provenance. Skip wholly empty rows with a visible count; treat an inner table as a separate candidate and omit it from outer-cell text. Warn on conflicting associations, invalid spans or exhausted grid budgets.
3. **Repeated structures:** cluster sibling subtrees (and repeated wrappers) by tag/role and shallow child-shape signatures with bounded approximate comparisons. Use landmarks, recurring aligned text/links/images, structural regularity, repetition and visibility. Classes are low-weight hints, not identity. Prefer primary content over repeated site chrome; consider an actual main-content link gallery separately from a nav-only group. Collapse substantially overlapping candidates unless a nested group yields independently useful rows/fields.
4. **Rank:** proposed starting weights, normalized signals 0–1: 30% structural consistency, 25% recurring field coverage, 20% meaningful content, 15% repetition (saturating), 10% visibility, minus bounded landmark/noise/overlap penalties, clamped to 0–100. Calibrate from positive and negative fixtures; deterministic tie-break on semantic table evidence and DOM order. Present reasons such as “consistent heading and link across items,” not a probability. Keep low-evidence options available for manual review.
5. **Field alignment:** anchor relative paths to row roots using stable tag/role/semantic attributes, limited CSS only where needed. No extraction rule escapes its row. Sample coverage and types before naming; optional/missing values become `null`. Resolve relative links with the page base, revalidate safe protocol, drop credentials, and treat invalid links as missing. Read image source as text, never fetch for preview. Preserve text and Unicode; do not guess numbers from price-like values or coerce opaque IDs.
6. **Collect:** revalidate the recipe against the document and show drift/errors instead of silently moving columns. Batch normalized rows. Stable row IDs are not dedup keys; use user-selected uniqueness fields or exact canonical values across observed batches, with occurrence tracking for repeated DOM snapshots to avoid dropping legitimate same-valued rows. Protect against hash collisions by comparing canonical tuples; preserve original values on opt-out and support review.

## Dynamic collection and recovery

State machine: `draft → awaitingApproval → running ↔ paused → completed | stopped | failed`; interrupted or uncertain side effects transition to `needsReview`, with committed data available. Single side-effect lease per run/tab; record action intent with step ID before acting. Acknowledge only after verification or clear failure. Observe scoped mutations and loading markers; verify document/list fingerprint and new rows. Prefer rel, accessible role, container and link/URL evidence over words like “Next.” Confirm safe same-origin HTTP(S) destinations, deny submit/destructive/ambiguous controls, do not open background targets, and treat redirects as scope changes. An eventual cross-origin redirect can still be made by the website/browser; never inject, scrape or continue after arrival. URL-pattern navigation is an explicitly reviewed sequence, never link discovery. Multi-URL uses a finite user-reviewed queue and per-origin approval; absent a verified narrow permission mechanism, use a user gesture for each new origin.

Persist checkpoints before/after side-effect steps and commit rows/checkpoint atomically. Duplicate batch IDs are idempotent. On worker restart restore durable progress, reconnect, validate tab/origin/document; pause for review if prior action is uncertain, permission is lost, or page/config drifted. No assumed resident worker, hidden keepalive, or automatic replay of uncertain actions. Pause/stop cancel queued work, timers and observers; a dispatched action cannot be undone. Closing tab or browser preserves committed results; resuming after browser restart requires fresh authorization. No run silently shifts to another tab.

## Versioned data contracts (conceptual)

Use discriminated unions, bounded parsers and explicit `null` vs omission; opaque IDs independent of names/selectors. UTC epoch timestamps; `CellValue = string | number (finite) | boolean | null`; provenance kept apart from export payloads. Persist schema version per record envelope and database version for structures.

| Model | Key fields and invariants |
|---|---|
| ExtractionSession | `id`, `status`, `recipeId?`, configuration snapshot, origin, dataset revision, timestamps/counts, limits, checkpoint, structured error if any. Tab/document bindings are ephemeral; persisted run state never grants authority. |
| ExtractionConfiguration | `id`, `schemaVersion`, name, origin, row locator, ordered field IDs/rules, default bounds/dedupe and timestamps. No credentials, full session URLs or executable strings. |
| ExtractionCandidate | Document epoch, temporary ID, kind, row locator, estimated count/partial flag, fields, bounded preview, score and evidence; not serialized as a DOM node. |
| ExtractionField | Stable `id`, label, relative locator and extraction kind (`visibleText`, `text`, `href`, `imageSrc`, `imageAlt`, `allowedAttribute`), optional validated attribute; bounded and row-scoped. |
| ExtractionColumn | Stable `id`, optional source field ID, display label, unique export key, order and optional observed type. IDs unchanged by edits or reordering. |
| ExtractionRecord | Stable row ID, session ID, order, values keyed by column ID, extraction timestamp, optional sanitized provenance and optional span/step metadata; canonical hash is separate. |
| PaginationConfiguration | Mode (`none`, next, numbered, explicit pattern, load more, scroll), verified locator/route constraints, max steps/rows/time, delay/idle wait/no-growth limit; runtime consent not importable. |
| PaginationState | Run status, step counter, action intent/step ID, visited fingerprint set, last committed batch ID, cancel flag, counts and error. Full URLs with query only in memory while needed. |
| ExportConfiguration | Format, ordered column/row scope, headers, sanitized filename, CSV delimiter/BOM preference. Create a stable revision snapshot. |
| UserSettings | Schema version, theme, default export, limits/delay, dedupe mode, retention preference; not synced. |
| BrowserMessage | Version, discriminator, request ID, run/document metadata if needed and bounded payload. Runtime sender identity is checked separately from payload. |
| ExtractionError | Enumerated code, phase/step, safe message, retryability and partial-result flag. No scraped text or raw URL in diagnostics. |

## Persistence and export

`storage.local` for versioned settings and UI preferences only. Extension-origin IndexedDB stores `sessions`, `recipes`, `columns`, `rows`, and `batches` with session/order indexes and `(sessionId, batchId)` uniqueness; occasional compaction can discard obsolete checkpoints. A transaction batches row inserts and checkpoint/counter updates. Use bounded queries for virtualization/export and stable snapshot revision (lock editing during export or use consistent read); never materialize unlimited rows. Run and edit mutations coordinate per dataset revision; no last-writer-wins merge of conflicting updates. Schema upgrades are transactional; preserve old records on failure, report quota errors and avoid silent deletion. Clear history deletes rows and metadata with explicit recipe-deletion choice. UI estimates owned storage and reports browser quota approximately.

Default CSV UTF-8, quoted/doubled separators and newlines, optional BOM, safe spreadsheet text handling; use the same safety for tabular clipboard. XLSX uses only explicit data cells, no formulas or live hyperlinks, with preflight size/cell limits and no silent truncation. JSON exports typed records under unique keys with deterministic order; omit provenance by default. All export formats run locally and support selection with displayed counts.

## Proposed code tree (Phase 02 onward)

```text
masum-scrapnex/
  entrypoints/{background.ts,page-agent.ts,popup/,sidepanel/,options/}
  src/{app/,core/{analyzer,detector,extractor,pagination,normalizer}/,
       browser/{adapters,messaging,permissions}/,
       data/{models,repositories,exporters}/,features/,components/}
  tests/{unit,fixtures,e2e,qa}/   public/icons/   docs/{,phases/}
  wxt.config.ts   package.json   tsconfig.json   README.md
```

Create modules as needed, not as empty placeholders. Phase 01 documents are archived outside the repository under `artifacts/archive/phase-01-docs/`.
