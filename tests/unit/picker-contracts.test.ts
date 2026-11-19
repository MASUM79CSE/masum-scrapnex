import { describe, expect, it } from "vitest";
import {
  isPickerCommand,
  isPickerEvent,
} from "../../src/core/picker/contracts";

describe("picker wire contract", () => {
  it("accepts only explicit, bounded picker operations and safe attribute names", () => {
    expect(
      isPickerCommand({
        v: 1,
        action: "pick-field",
        rule: { kind: "attribute", attribute: "data-price" },
      }),
    ).toBe(true);
    for (const attribute of [
      "value",
      "data-token",
      "data-password",
      "onclick",
      "style",
      "srcdoc",
    ])
      expect(
        isPickerCommand({
          v: 1,
          action: "pick-field",
          rule: { kind: "attribute", attribute },
        }),
      ).toBe(false);
    for (const value of [
      { v: 1, action: "query-selector", selector: "body" },
      { v: 1, action: "remove-field", index: 8 },
      { v: 2, action: "stop" },
      { v: 1, action: "stop", url: "https://example.test" },
    ])
      expect(isPickerCommand(value)).toBe(false);
  });
  it("requires bounded and aligned preview payloads before accepting a confirmation", () => {
    const preview = {
      selector: "body > article:nth-of-type(1)",
      observed: 2,
      sampled: false,
      canParent: true,
      canChild: true,
      columns: [{ label: "Text", selector: ":scope" }],
      rows: [["First"], [null]],
      explicitFields: false,
    };
    const event = { v: 1, type: "ended", reason: "confirmed", preview };
    expect(isPickerEvent(event)).toBe(true);
    expect(isPickerEvent({ ...event, preview: null })).toBe(false);
    for (const rows of [
      [["one", "two"]],
      [["x".repeat(641)]],
      Array(7).fill(["one"]),
    ])
      expect(isPickerEvent({ ...event, preview: { ...preview, rows } })).toBe(
        false,
      );
    expect(isPickerEvent({ ...event, reason: "page-changed" })).toBe(false);
  });
});
