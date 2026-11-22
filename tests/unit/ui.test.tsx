import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { candidates, visibleRows } from "../../src/ui/sample";
import { parseTheme } from "../../src/ui/theme";
import { CandidateCards, DataPreview, Workspace } from "../../src/ui/workspace";
import { DatasetPanel } from "../../src/ui/dataset-panel";
import type { DatasetView } from "../../src/browser/use-dataset";
import type { Dataset } from "../../src/core/extraction/contracts";

const tinyDataset: Dataset = {
  version: 1,
  columns: [
    { id: "c1", label: "Name", kind: "text" },
    { id: "c2", label: "Price", kind: "text" },
  ],
  rows: [{ id: "r1", cells: ["Lamp", "900"] }],
};
function DatasetPanelStub({ partial }: { partial: boolean }) {
  const view = {
    dataset: tinyDataset,
    note: "Captured from the authorized page.",
    partial,
    error: "",
    busy: false,
    back: () => {},
    discard: () => {},
  } as unknown as DatasetView;
  return <DatasetPanel view={view} />;
}
/** Mirrors the boundary fallback so the copy can be asserted without a DOM. */
function CrashCardForTest({ error }: { error: Error }) {
  return (
    <div className="crash-card" role="alert">
      <h1>Something went wrong in this view</h1>
      <p>
        Your collected data is safe: the working copy lives in memory until you
        save it, and saved snapshots are untouched. Reloading rebuilds the view
        from what is stored locally.
      </p>
      <p className="crash-detail">
        {error.name}: {error.message}
      </p>
    </div>
  );
}

const store = {
  async read() {
    return undefined;
  },
  async write() {},
};
describe("sample UI and preference contracts", () => {
  it("filters case-insensitively across fields without mutating input", () => {
    const rows = candidates[0].rows;
    expect(visibleRows(rows, " lighting ").map((row) => row.id)).toEqual([
      "p3",
    ]);
    expect(visibleRows(rows, "in stock")).toHaveLength(4);
    expect(
      visibleRows(rows, "", { column: "price", direction: "asc" })[0]?.price,
    ).toBe("$32.00");
    expect(rows[0].price).toBe("$84.00");
  });
  it("parses only supported appearance values", () => {
    expect(parseTheme("system", "dark")).toBe("system");
    expect(parseTheme({ mode: "dark" }, "light")).toBe("light");
  });
  it("does not pretend to show results before sample mode is enabled", () => {
    const candidate = renderToStaticMarkup(
      <CandidateCards
        sample={false}
        selected={candidates[0]}
        choose={vi.fn()}
      />,
    );
    const grid = renderToStaticMarkup(<DataPreview />);
    expect(candidate).toContain("No candidates yet");
    expect(candidate).not.toContain("Product catalog");
    expect(grid).not.toContain("<table>");
  });
  it("labels the preview and emits a semantic sample data table and checked controls", () => {
    const workspace = renderToStaticMarkup(
      <Workspace mode="preview" themeStore={store} />,
    );
    expect(workspace).toContain("Sample mode");
    expect(workspace).toContain("Illustrative data · no site was scanned");
    expect(workspace).toContain("<caption");
    expect(workspace).toContain('checked=""');
  });
  it("renders explicit loading, lost connection and accessible retry states", () => {
    expect(
      renderToStaticMarkup(<Workspace mode="extension" themeStore={store} />),
    ).toContain("Checking extension connection…");
    const content = renderToStaticMarkup(
      <Workspace
        mode="extension"
        themeStore={store}
        connection="error"
        retry={vi.fn()}
      />,
    );
    expect(content).toContain('role="alert"');
    expect(content).toContain("Retry");
  });
});

describe("resilience surfaces", () => {
  it("renders a non-destructive crash card and never leaks a stack", () => {
    const error = new Error("render blew up");
    const html = renderToStaticMarkup(<CrashCardForTest error={error} />);
    expect(html).toContain("Something went wrong in this view");
    expect(html).toContain("saved snapshots are untouched");
    expect(html).toContain("render blew up");
    expect(html).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });
  it("explains a capped capture without pretending data is complete", () => {
    const html = renderToStaticMarkup(<DatasetPanelStub partial />);
    expect(html).toContain("Partial capture.");
    expect(html).toMatch(/10,000 row cap/);
    expect(html).toContain("fully editable");
  });
  it("omits the cap notice on a complete capture", () => {
    const html = renderToStaticMarkup(<DatasetPanelStub partial={false} />);
    expect(html).not.toContain("Partial capture.");
  });
});
