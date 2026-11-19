import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CircleAlert,
  CircleCheck,
  Database,
  FlaskConical,
  Globe2,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  Moon,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Monitor,
  Table2,
} from "lucide-react";
import { Brand, LocalBadge, SampleBadge } from "./brand";
import {
  candidates,
  columns,
  visibleRows,
  type Candidate,
  type Sort,
} from "./sample";
import { useTheme, type ThemeStore } from "./theme";

export type Connection = "loading" | "connected" | "error";
type Section = "workspace" | "candidates" | "preview" | "settings";
const navigation = [
  { id: "workspace", label: "Workspace", icon: LayoutDashboard },
  { id: "candidates", label: "Candidates", icon: ScanLine },
  { id: "preview", label: "Data preview", icon: Table2 },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;
const workflow = [
  { title: "Source", detail: "Select a webpage" },
  { title: "Candidates", detail: "Choose a structure" },
  { title: "Preview", detail: "Review the records" },
  { title: "Export", detail: "Available in a later phase" },
];

function Status({
  connection,
  retry,
}: {
  connection: Connection;
  retry?: (() => void) | undefined;
}) {
  if (connection === "error")
    return (
      <div className="connection connection--error">
        <span role="alert">
          <CircleAlert size={16} aria-hidden="true" /> Extension connection
          lost.
        </span>
        {retry && (
          <button
            type="button"
            className="button button--quiet"
            onClick={retry}
          >
            Retry
          </button>
        )}
      </div>
    );
  return (
    <p role="status" className="connection">
      {connection === "loading" ? (
        <>
          <LoaderCircle size={15} className="spin" aria-hidden="true" />{" "}
          Checking extension connection…
        </>
      ) : (
        <>
          <span className="status-dot" aria-hidden="true" /> Extension connected
        </>
      )}
    </p>
  );
}

function SectionTitle({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <header className="card-head">
      <div className="card-lead">
        <span className="section-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
      </div>
      {action}
    </header>
  );
}

export function CandidateCards({
  sample,
  selected,
  choose,
}: {
  sample: boolean;
  selected: Candidate;
  choose: (candidate: Candidate) => void;
}) {
  return (
    <section
      className="panel candidate-panel"
      aria-label="Candidate structures"
    >
      <SectionTitle
        icon={<ScanLine size={19} />}
        title="Detected structures"
        hint={
          sample
            ? "Structures from the sample page"
            : "Collections suggested from the current page"
        }
        action={
          sample && <span className="count-tag">{candidates.length} found</span>
        }
      />
      {sample ? (
        <>
          <fieldset className="candidate-list">
            <legend className="sr-only">Select a sample structure</legend>
            {candidates.map((candidate) => (
              <label className="candidate" key={candidate.id}>
                <input
                  type="radio"
                  name="candidate"
                  value={candidate.id}
                  checked={candidate.id === selected.id}
                  onChange={() => choose(candidate)}
                />
                <span className="candidate-title">
                  <span>{candidate.title}</span>
                  <span className="radio-dot" aria-hidden="true" />
                </span>
                <span className="candidate-meta">
                  {candidate.type} <b aria-hidden="true">·</b>{" "}
                  {candidate.rows.length} records
                </span>
                <span
                  className={`match-tag ${candidate.id === "products" ? "match-tag--strong" : ""}`}
                >
                  <span aria-hidden="true" /> {candidate.score}
                </span>
                <span className="candidate-hint">{candidate.hint}</span>
              </label>
            ))}
          </fieldset>
          <footer className="panel-note">
            <FlaskConical size={15} aria-hidden="true" /> Match labels are
            illustrative in sample mode.
          </footer>
        </>
      ) : (
        <div className="empty-state">
          <ScanLine size={24} aria-hidden="true" />
          <strong>No candidates yet</strong>
          <p>
            Page analysis is not enabled in this build. Try sample mode to
            explore this view.
          </p>
        </div>
      )}
    </section>
  );
}

export function DataPreview({ candidate }: { candidate?: Candidate }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>();
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const rows = candidate ? visibleRows(candidate.rows, query, sort) : [];
  function toggle(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <section className="panel data-panel" aria-label="Data preview">
      <SectionTitle
        icon={<Table2 size={18} />}
        title="Data preview"
        hint={
          candidate
            ? `Inspect the sample records in ${candidate.title.toLowerCase()}`
            : "Review records before exporting"
        }
        action={
          candidate && (
            <span className="count-tag">
              {candidate.rows.length} rows · {columns.length} columns
            </span>
          )
        }
      />
      {candidate ? (
        <>
          <div className="table-tools">
            <label className="search-box">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search sample records</span>
              <input
                type="search"
                placeholder="Search records…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <span className="table-meta">
              <ListFilter size={14} aria-hidden="true" />{" "}
              <span>Sample dataset</span>
            </span>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Sample data table (scroll horizontally if needed)"
          >
            <table>
              <caption className="sr-only">
                {candidate.title} sample records
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="row-select">
                    <span className="sr-only">Select row</span>
                  </th>
                  <th scope="col" className="row-number">
                    #
                  </th>
                  {columns.map(({ id, name }) => (
                    <th
                      scope="col"
                      key={id}
                      aria-sort={
                        sort?.column === id
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <button
                        className="sort-button"
                        type="button"
                        onClick={() =>
                          setSort({
                            column: id,
                            direction:
                              sort?.column === id && sort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        {name}
                        {sort?.column === id ? (
                          sort.direction === "asc" ? (
                            <ArrowUp size={13} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={13} aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown size={12} aria-hidden="true" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      selection.has(row.id) ? "selected-row" : undefined
                    }
                  >
                    <td className="row-select">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.item}`}
                        checked={selection.has(row.id)}
                        onChange={() => toggle(row.id)}
                      />
                    </td>
                    <td className="row-number">
                      {candidate.rows.findIndex(
                        (entry) => entry.id === row.id,
                      ) + 1}
                    </td>
                    <th scope="row" className="product-cell">
                      {row.item}
                    </th>
                    <td>{row.category}</td>
                    <td className="price-cell">{row.price}</td>
                    <td>
                      <span
                        className={`stock-tag ${row.availability === "In stock" ? "stock-tag--ok" : row.availability === "Low stock" ? "stock-tag--low" : ""}`}
                      >
                        <span aria-hidden="true" /> {row.availability}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="no-results">
                      No records match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="table-foot">
            <p role="status">
              Showing {rows.length} of {candidate.rows.length} records
              {selection.size > 0 && ` · ${selection.size} selected`}
            </p>
            <span>
              <LockKeyhole size={13} aria-hidden="true" /> Sample only
            </span>
          </footer>
        </>
      ) : (
        <div className="empty-state">
          <Table2 size={26} aria-hidden="true" />
          <strong>No records to preview</strong>
          <p>Choose a sample structure to see how records will appear here.</p>
        </div>
      )}
    </section>
  );
}

function SettingsScreen({
  appearance,
}: {
  appearance: ReturnType<typeof useTheme>;
}) {
  return (
    <div className="settings-stack">
      <section className="panel settings-card" aria-label="Appearance">
        <SectionTitle
          icon={<Sun size={19} />}
          title="Appearance"
          hint="Choose how SCRAPNEX looks on this device."
        />
        <fieldset className="theme-options" disabled={appearance.busy}>
          <legend className="sr-only">Theme</legend>
          {(
            [
              {
                id: "system",
                icon: Monitor,
                title: "System",
                description: "Follow this device",
              },
              {
                id: "light",
                icon: Sun,
                title: "Light",
                description: "Bright and quiet",
              },
              {
                id: "dark",
                icon: Moon,
                title: "Dark",
                description: "Low-glare workspace",
              },
            ] as const
          ).map(({ id, icon: Icon, title, description }) => (
            <label className="theme-option" key={id}>
              <input
                type="radio"
                name="theme"
                checked={appearance.theme === id}
                onChange={() => void appearance.choose(id)}
              />
              <Icon size={21} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{description}</span>
            </label>
          ))}
        </fieldset>
        {appearance.error && (
          <p className="settings-error" role="alert">
            {appearance.error}
          </p>
        )}
      </section>
      <section className="panel settings-card" aria-label="Privacy and storage">
        <SectionTitle
          icon={<ShieldCheck size={19} />}
          title="Privacy & storage"
          hint="Local by design"
        />
        <p className="settings-copy">
          This build saves your appearance preference only. It does not scan
          webpages, store extraction history, or upload data.
        </p>
      </section>
      <section
        className="panel settings-card"
        aria-label="Collection and export"
      >
        <SectionTitle
          icon={<Database size={19} />}
          title="Collection & export"
          hint="Not available in this build"
        />
        <p className="settings-copy">
          Export defaults, request delays, page limits, and duplicate handling
          will be available as those features are implemented.
        </p>
      </section>
    </div>
  );
}

export function Workspace({
  mode,
  themeStore,
  connection = "loading",
  retry,
}: {
  mode: "preview" | "extension" | "options";
  themeStore: ThemeStore;
  connection?: Connection;
  retry?: () => void;
}) {
  const [sample, setSample] = useState(mode === "preview");
  const [section, setSection] = useState<Section>(
    mode === "options" ? "settings" : "workspace",
  );
  const [candidate, setCandidate] = useState<Candidate>(candidates[0]);
  const heading = useRef<HTMLHeadingElement>(null);
  const appearance = useTheme(
    themeStore,
    mode === "preview" ? "dark" : "system",
  );
  const isSettings = section === "settings";
  function navigate(next: Section) {
    if (next === section) return;
    setSection(next);
    requestAnimationFrame(() => {
      heading.current?.focus();
    });
  }
  function toggleSample() {
    setSample((current) => !current);
    setCandidate(candidates[0]);
  }
  const title =
    section === "workspace"
      ? "Extraction workspace"
      : section === "candidates"
        ? "Candidate structures"
        : section === "preview"
          ? "Data preview"
          : "Settings";
  const short =
    section === "workspace"
      ? "Turn structured information on the web into data you can use."
      : section === "candidates"
        ? "Compare similar collections and choose which structure to preview."
        : section === "preview"
          ? "Review, search, and sort records in a spreadsheet-style view."
          : "Manage appearance and see what SCRAPNEX stores on this device.";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-top">
        <Brand />
        <div className="top-end">
          <span className="build-tag">
            v0.1.0 <span>FOUNDATION</span>
          </span>
          <LocalBadge />
        </div>
      </header>
      <div
        className={`app-grid${mode === "options" ? " app-grid--options" : ""}`}
      >
        {mode !== "options" && (
          <aside className="sidebar">
            <div>
              <p className="nav-caption">WORKSPACE</p>
              <nav aria-label="Workspace navigation">
                {navigation.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    className="nav-link"
                    key={id}
                    aria-current={section === id ? "page" : undefined}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                    {section === id && (
                      <span className="nav-active-dot" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </nav>
            </div>
            <div className="sidebar-foot">
              <div>
                <ShieldCheck size={16} aria-hidden="true" />
                <strong>Private by design</strong>
              </div>
              <p>
                No account, no cloud.
                <br />
                Your data stays with you.
              </p>
            </div>
          </aside>
        )}
        <main id="main-content" className="app-main" tabIndex={-1}>
          <section
            className={`hero${isSettings ? " hero--settings" : ""}`}
            aria-labelledby="page-heading"
          >
            <div className="hero-content">
              <p className="eyebrow">
                <span aria-hidden="true" />{" "}
                {isSettings ? "PREFERENCES" : "LOCAL-FIRST EXTRACTION"}
              </p>
              <h1 ref={heading} tabIndex={-1} id="page-heading">
                {title}
              </h1>
              <p className="hero-description">{short}</p>
              {!isSettings && (
                <div className="source-chip">
                  <Globe2 size={17} aria-hidden="true" />
                  <div>
                    <span>{sample ? "SAMPLE SOURCE" : "PAGE SOURCE"}</span>
                    <strong>
                      {sample
                        ? "fieldwork.example/catalog"
                        : "No webpage connected for analysis"}
                    </strong>
                  </div>
                </div>
              )}
            </div>
            {!isSettings && (
              <div className="hero-actions">
                {sample && <SampleBadge />}
                <button
                  className={`button ${sample ? "button--outline" : "button--primary"}`}
                  type="button"
                  onClick={toggleSample}
                >
                  {sample ? (
                    <ArrowLeft size={16} aria-hidden="true" />
                  ) : (
                    <FlaskConical size={16} aria-hidden="true" />
                  )}
                  {sample ? "Exit sample" : "Try sample data"}
                </button>
              </div>
            )}
          </section>
          {mode === "extension" && (
            <Status connection={connection} retry={retry} />
          )}
          {section === "workspace" && (
            <>
              <ol className="workflow" aria-label="Extraction workflow">
                {workflow.map((step, index) => (
                  <li
                    key={step.title}
                    aria-current={
                      index === (sample ? 1 : 0) ? "step" : undefined
                    }
                    className={
                      index === 0 && sample ? "flow-complete" : undefined
                    }
                  >
                    <span className="step-index">
                      {index === 0 && sample ? (
                        <CircleCheck
                          size={18}
                          aria-label="Sample source selected"
                        />
                      ) : (
                        `0${index + 1}`
                      )}
                    </span>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </div>
                    {index < workflow.length - 1 && (
                      <ArrowRight
                        className="step-arrow"
                        size={14}
                        aria-hidden="true"
                      />
                    )}
                  </li>
                ))}
              </ol>
              <div className="work-grid">
                <CandidateCards
                  sample={sample}
                  selected={candidate}
                  choose={setCandidate}
                />
                <DataPreview
                  key={`${sample}-${candidate.id}`}
                  {...(sample ? { candidate } : {})}
                />
              </div>
            </>
          )}
          {section === "candidates" && (
            <div className="focused-panel">
              <CandidateCards
                sample={sample}
                selected={candidate}
                choose={setCandidate}
              />
              {sample && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => navigate("preview")}
                >
                  View sample preview{" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {section === "preview" && (
            <DataPreview
              key={`${sample}-${candidate.id}`}
              {...(sample ? { candidate } : {})}
            />
          )}
          {isSettings && <SettingsScreen appearance={appearance} />}
          <footer className="workspace-foot">
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Processed locally.
              Always under your control.
            </span>
            {sample && !isSettings && (
              <span>Illustrative data · no site was scanned</span>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}
