import { describe, expect, it, vi } from "vitest";
import { clipboardText, exportBlob } from "../../src/core/export";
import {
  createPlan,
  defaultStem,
  safeFilename,
  type Format,
} from "../../src/core/export/plan";
import { spreadsheetText } from "../../src/core/export/text";
import { storeZip } from "../../src/core/export/zip";
import { xmlText } from "../../src/core/export/xlsx";
import { requestDownload, saveWithPicker } from "../../src/browser/export";
import type { Dataset } from "../../src/core/extraction/contracts";

const data: Dataset = {
  version: 1,
  columns: [
    { id: "c1", label: "Title", kind: "text" },
    { id: "c2", label: "__proto__", kind: "text" },
    { id: "c3", label: "=Notes", kind: "text" },
  ],
  rows: [
    { id: "r1", cells: ['Lamp, "large"\nবাংলা', "0042", ""] },
    { id: "r2", cells: ["=1+1", null, "<text> & more"] },
    { id: "r3", cells: ["😺", "15", null] },
  ],
};
const plan = () => createPlan(data, data.rows, new Set(), new Set(), "all");
const png = () => new Blob(["hello"]);

describe("export plan and serialization", () => {
  it("uses the working dataset order, and applies a filtered sort only when requested", () => {
    const selection = new Set(["r2"]);
    const exclusions = new Set(["c2"]);
    const view = [data.rows[2]!, data.rows[0]!];
    expect(
      createPlan(data, view, selection, exclusions, "selected"),
    ).toMatchObject({
      columns: [{ id: "c1" }, { id: "c3" }],
      rows: [{ id: "r2", cells: ["=1+1", "<text> & more"] }],
    });
    expect(
      createPlan(data, view, selection, exclusions, "visible").rows.map(
        (row) => row.id,
      ),
    ).toEqual(["r3", "r1"]);
    expect(
      createPlan(data, view, selection, exclusions, "all").rows.map(
        (row) => row.id,
      ),
    ).toEqual(["r1", "r2", "r3"]);
    expect(() =>
      createPlan(data, [], selection, exclusions, "visible"),
    ).toThrow(/at least one/);
    expect(() =>
      createPlan(
        data,
        view,
        selection,
        new Set(data.columns.map((col) => col.id)),
        "all",
      ),
    ).toThrow(/at least one/);
  });
  it("quotes CSV delimiters, newlines and quotes, uses UTF-8 BOM and shields formulas", async () => {
    const blob = exportBlob(plan(), "csv");
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([239, 187, 191]);
    expect(await blob.text()).toBe(
      `"Title","__proto__","'=Notes"\r\n"Lamp, ""large""\nবাংলা","0042",""\r\n"'=1+1",,"<text> & more"\r\n"😺","15",\r\n`,
    );
    for (const danger of [
      "=1",
      "+10",
      "-2",
      "@SUM(A1)",
      "\u200B =1",
      " \t@a",
      "＝1",
      "\tword",
      "\rnew",
    ])
      expect(spreadsheetText(danger)).toBe(`'${danger}`);
    expect(spreadsheetText("0042")).toBe("0042");
    expect(spreadsheetText("hello-বাংলা")).toBe("hello-বাংলা");
  });
  it("applies the same safety rules to quoted clipboard TSV and uses only planned columns", () => {
    expect(
      clipboardText(
        createPlan(data, [], new Set(["r2"]), new Set(["c2"]), "selected"),
      ),
    ).toBe(`"Title"\t"'=Notes"\r\n"'=1+1"\t"<text> & more"\r\n`);
  });
  it("preserves current JSON types and literal strings, including prototype-shaped labels", async () => {
    const text = await exportBlob(plan(), "json").text();
    const body = JSON.parse(text);
    expect(text).toContain('\n  "version": 1,\n');
    expect(Object.hasOwn(body.records[0].values, "__proto__")).toBe(true);
    expect(body.records[0].values).toMatchObject({
      Title: 'Lamp, "large"\nবাংলা',
      __proto__: "0042",
      "=Notes": "",
    });
    expect(body.records[1].values.Title).toBe("=1+1");
    expect(body.records[1].values["__proto__"]).toBeNull();
  });
  it("constructs a ZIP32 workbook with inline strings and safely escaped XML", async () => {
    const blob = exportBlob(plan(), "xlsx");
    const buffer = await blob.arrayBuffer();
    const bytes = new DataView(buffer);
    const text = new TextDecoder().decode(buffer);
    expect(bytes.getUint32(0, true)).toBe(0x04034b50);
    expect(bytes.getUint32(buffer.byteLength - 22, true)).toBe(0x06054b50);
    expect(bytes.getUint16(buffer.byteLength - 12, true)).toBe(5);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain('r="A3" t="inlineStr"');
    expect(text).toContain(">\u003d1+1</t>");
    expect(text).not.toContain("<f>");
    expect(text).toContain("&lt;text&gt; &amp; more");
    expect(text).not.toContain('r="B3"');
    expect(xmlText("_x0041_\r\u0000\ud800")).toBe("_x005F_x0041_&#13;��");
    const crc = new DataView(
      storeZip([{ name: "a", parts: ["123456789"] }])[0]!,
    );
    expect(crc.getUint32(14, true)).toBe(0xcbf43926);
  });
  it("creates safe bounded filenames without replacing Unicode names", () => {
    expect(defaultStem(new Date("2026-11-19T10:00:01Z"))).toBe(
      "scrapnexs-20261119t100001z",
    );
    expect(safeFilename(" বাংলা.csv", "json")).toBe("বাংলা.json");
    expect(safeFilename("con.xlsx", "xlsx")).toBe("scrapnexs-con.xlsx");
    expect(safeFilename("...", "csv")).toBe("scrapnexs-export.csv");
    expect(safeFilename("a/../b:?.csv", "xlsx")).not.toMatch(/[:?/]/);
    expect(
      new TextEncoder().encode(safeFilename("😺".repeat(80), "xlsx")).length,
    ).toBeLessThan(220);
  });
  it("enforces row count and collection unit caps before writing", () => {
    const oversized = {
      ...data,
      rows: Array.from({ length: 10001 }, () => data.rows[0]!),
    };
    expect(() =>
      createPlan(oversized, [], new Set(), new Set(), "all"),
    ).toThrow(/dataset limits/);
    const long = {
      ...data,
      rows: Array.from({ length: 4000 }, (_, i) => ({
        id: `r${i + 1}`,
        cells: ["x".repeat(640), "", ""],
      })),
    };
    expect(() => createPlan(long, [], new Set(), new Set(), "all")).toThrow(
      /size limit/,
    );
  });
  for (const rows of [100, 1000, 10000])
    it(`serializes ${rows} bounded fixture rows into all formats`, async () => {
      const large: Dataset = {
        ...data,
        rows: Array.from({ length: rows }, (_, i) => ({
          id: `r${i + 1}`,
          cells: [`Record ${i + 1}`, "0042", "বাংলা & tags"],
        })),
      };
      const startPlan = performance.now();
      const selection = createPlan(large, [], new Set(), new Set(), "all");
      const planMs = performance.now() - startPlan;
      for (const format of [
        "csv",
        "xlsx",
        "json",
      ] as const satisfies readonly Format[]) {
        const start = performance.now();
        const blob = exportBlob(selection, format);
        const ms = performance.now() - start;
        expect(blob.size).toBeGreaterThan(rows * 8);
        expect(blob.size).toBeLessThan(6_000_000);
        expect(new TextDecoder().decode(await blob.arrayBuffer())).toContain(
          `Record ${rows}`,
        );
        console.log(
          `PHASE09_SCALE rows=${rows} format=${format} bytes=${blob.size} plan_ms=${planMs.toFixed(2)} serialize_ms=${ms.toFixed(2)}`,
        );
      }
    });
});

describe("export delivery outcomes", () => {
  it("reports a rejected write, aborts the writable, and never claims success", async () => {
    const writable = {
      write: vi.fn(async () => {
        throw new DOMException("private path", "QuotaExceededError");
      }),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };
    await expect(
      saveWithPicker(png(), "fixture.csv", "csv", async () => ({
        createWritable: async () => writable,
      })),
    ).rejects.toThrow(/could not be saved/);
    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
  });
  it("distinguishes cancelled and successfully closed saves", async () => {
    await expect(
      saveWithPicker(png(), "fixture.json", "json", async () => {
        throw new DOMException("Cancelled", "AbortError");
      }),
    ).resolves.toBe("cancelled");
    const writable = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };
    const choose = vi.fn(async () => ({
      createWritable: async () => writable,
    }));
    const blob = png();
    await expect(
      saveWithPicker(blob, "fixture.json", "json", choose),
    ).resolves.toBe("saved");
    expect(writable.write).toHaveBeenCalledWith(blob);
    expect(writable.close).toHaveBeenCalledOnce();
    expect(choose).toHaveBeenCalledWith({
      suggestedName: "fixture.json",
      types: [
        { description: "JSON file", accept: { "application/json": [".json"] } },
      ],
    });
  });
  it("releases the object URL and temporary element if the download cannot be initiated", () => {
    const make = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:scrapnexs-test");
    const release = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const link = {
      click: vi.fn(() => {
        throw new Error("blocked");
      }),
      remove: vi.fn(),
    };
    const doc = {
      createElement: () => link,
      body: { append: vi.fn() },
    } as unknown as Document;
    try {
      expect(() => requestDownload(png(), "fixture.csv", doc)).toThrow(
        /Could not start/,
      );
      expect(release).toHaveBeenCalledWith("blob:scrapnexs-test");
      expect(link.remove).toHaveBeenCalledOnce();
    } finally {
      make.mockRestore();
      release.mockRestore();
    }
  });
});
