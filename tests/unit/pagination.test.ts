import { describe, expect, it, vi } from "vitest";
import {
  isSettings,
  maxRunMs,
  sameWebUrl,
  type Action,
} from "../../src/core/pagination/contracts";
import {
  startRun,
  type Adapter,
  type Progress,
  type Cursor,
} from "../../src/core/pagination/run";
import type { CollectionResult } from "../../src/core/extraction/contracts";
const first = {
  href: "https://example.test/items?page=1",
  documentId: "first",
};
const action = {
  mode: "next",
  label: "Next page",
  href: "https://example.test/items?page=2",
} as const;
const more = { mode: "more", label: "Load More", key: "load more" } as const;
const capture = (...values: string[]): CollectionResult => ({
  version: 1,
  status: "complete",
  note: "Capture",
  dataset: {
    version: 1,
    columns: [{ id: "t1", label: "Item", kind: "text" }],
    rows: values.map((value, i) => ({ id: `r${i + 1}`, cells: [value] })),
  },
});
function port(overrides: Partial<Adapter> = {}): Adapter {
  return {
    inspect: vi.fn(async (c: Cursor) =>
      c.href === first.href ? [action] : [],
    ),
    read: vi.fn(async (_c: Cursor, initial: boolean) =>
      initial ? capture("A", "B") : capture("B", "C"),
    ),
    navigate: vi.fn(async (_c: Cursor, a: typeof action) => ({
      href: a.href,
      documentId: "next",
    })) as Adapter["navigate"],
    interact: vi.fn(async () => true),
    wait: vi.fn(async () => {}),
    ...overrides,
  };
}
describe("bounded pagination", () => {
  it("restricts addresses and settings", () => {
    expect(sameWebUrl("?page=2", first.href)).toBe(action.href);
    for (const bad of [
      "javascript:alert(1)",
      "https://other.test",
      "https://user:pass@example.test",
      "http://example.test",
      "?page=2#fragment",
    ])
      expect(sameWebUrl(bad, first.href)).toBeNull();
    expect(isSettings({ steps: 10, delay: 500 })).toBe(true);
    expect(isSettings({ steps: 11, delay: 500 })).toBe(false);
    expect(isSettings({ steps: 3, delay: 10 })).toBe(false);
  });
  it("merges verified pages, deduplicates and honors the action limit", async () => {
    const adapter = port();
    const result = await startRun(
      first,
      action,
      { steps: 1, delay: 750 },
      adapter,
      () => {},
    ).result;
    expect(result.progress).toMatchObject({
      status: "complete",
      steps: 1,
      snapshots: 2,
      rows: 3,
      duplicates: 1,
    });
    expect(result.dataset?.rows.map((r) => r.cells[0])).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(adapter.navigate).toHaveBeenCalledTimes(1);
    expect(adapter.wait).toHaveBeenCalledWith(750, expect.any(AbortSignal));
  });
  it("pauses before issuing another action and resumes from the checkpoint", async () => {
    const adapter = port();
    let notify: () => void = () => {};
    const safe = new Promise<void>((resolve) => {
      notify = resolve;
    });
    const states: Progress[] = [];
    const run = startRun(
      first,
      action,
      { steps: 1, delay: 500 },
      adapter,
      (state) => {
        states.push(state);
        if (state.status === "paused") notify();
      },
    );
    run.pause();
    await safe;
    expect(adapter.navigate).not.toHaveBeenCalled();
    run.resume();
    expect((await run.result).progress.status).toBe("complete");
    expect(states.map((s) => s.status)).toContain("pausing");
  });
  it("stopping at the pause checkpoint prevents navigation and preserves verified rows", async () => {
    const adapter = port();
    const states: string[] = [];
    const run = startRun(
      first,
      action,
      { steps: 3, delay: 500 },
      adapter,
      (progress) => {
        states.push(progress.status);
      },
    );
    run.pause();
    await vi.waitFor(() => expect(states).toContain("paused"));
    run.stop();
    expect((await run.result).progress).toMatchObject({
      status: "stopped",
      rows: 2,
      steps: 0,
    });
    expect(adapter.navigate).not.toHaveBeenCalled();
  });
  it("never replays an ambiguous or unverified action", async () => {
    const adapter = port({
      navigate: vi.fn(async () => ({
        href: first.href,
        documentId: first.documentId,
      })),
    });
    const result = await startRun(
      first,
      action,
      { steps: 3, delay: 500 },
      adapter,
      () => {},
    ).result;
    expect(result.progress).toMatchObject({
      status: "recovery",
      steps: 1,
      snapshots: 1,
      rows: 2,
    });
    expect(adapter.navigate).toHaveBeenCalledTimes(1);
    expect(adapter.read).toHaveBeenCalledTimes(1);
  });
  it("stops at loops and does not act on an altered reviewed destination", async () => {
    const loop: Action = { mode: "next", label: "Next page", href: first.href };
    const adapter = port({
      inspect: vi.fn(async (c) => (c.href === first.href ? [action] : [loop])),
    });
    expect(
      (
        await startRun(
          first,
          action,
          { steps: 3, delay: 500 },
          adapter,
          () => {},
        ).result
      ).progress.note,
    ).toMatch(/loop/);
    const altered = port({
      inspect: vi.fn(async () => [
        { ...action, href: "https://example.test/items?page=9" },
      ]),
    });
    expect(
      (
        await startRun(
          first,
          action,
          { steps: 3, delay: 500 },
          altered,
          () => {},
        ).result
      ).progress.status,
    ).toBe("recovery");
    expect(altered.navigate).not.toHaveBeenCalled();
  });
  it("prevents unnecessary clicks when a Load More interaction adds no new record", async () => {
    const adapter = port({
      inspect: vi.fn(async () => [more]),
      read: vi.fn(async () => capture("A", "B")),
    });
    const { progress } = await startRun(
      first,
      more,
      { steps: 4, delay: 500 },
      adapter,
      () => {},
    ).result;
    expect(progress).toMatchObject({ status: "complete", steps: 1, rows: 2 });
    expect(adapter.interact).toHaveBeenCalledTimes(1);
  });
  it("ends at the wall-clock deadline even when a browser operation never resolves", async () => {
    vi.useFakeTimers();
    try {
      const adapter = port({
        navigate: vi.fn(() => new Promise<Cursor>(() => {})),
      });
      const run = startRun(
        first,
        action,
        { steps: 3, delay: 500 },
        adapter,
        () => {},
      );
      await vi.advanceTimersByTimeAsync(maxRunMs);
      const result = await run.result;
      expect(result.progress).toMatchObject({
        status: "recovery",
        steps: 1,
        rows: 2,
        snapshots: 1,
      });
      expect(result.progress.note).toMatch(/Time limit/);
    } finally {
      vi.useRealTimers();
    }
  });
});
