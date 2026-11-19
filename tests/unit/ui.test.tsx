import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { candidates, visibleRows } from "../../src/ui/sample";
import { parseTheme } from "../../src/ui/theme";
import { CandidateCards, DataPreview, Workspace } from "../../src/ui/workspace";

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
