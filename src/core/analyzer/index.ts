import {
  alignedFieldCoverage,
  ContentSignal,
  similarity,
  structureScore,
  type Shape,
} from "./shape";
import type {
  AnalysisLimits,
  AnalysisResult,
  AnalyzerOptions,
  CandidateReason,
  StructureCandidate,
} from "./types";
import { inspectVisibility } from "./visibility";

export type {
  AnalysisLimits,
  AnalysisResult,
  AnalyzerOptions,
  StructureCandidate,
} from "./types";

export const defaultLimits: Readonly<AnalysisLimits> = {
  maxNodes: 50_000,
  maxDepth: 64,
  maxTimeMs: 1_200,
  yieldEvery: 192,
  maxSiblings: 192,
  maxCandidates: 20,
};
const maxima: AnalysisLimits = {
  maxNodes: 100_000,
  maxDepth: 128,
  maxTimeMs: 4_000,
  yieldEvery: 256,
  maxSiblings: 256,
  maxCandidates: 50,
};
const roles = new Set([
  "article",
  "list",
  "listitem",
  "row",
  "cell",
  "heading",
  "link",
  "img",
  "navigation",
  "banner",
  "contentinfo",
  "menu",
  "menubar",
  "complementary",
  "search",
]);
const chromeRoles = new Set([
  "navigation",
  "banner",
  "contentinfo",
  "menu",
  "menubar",
  "search",
]);
const chromeTags = new Set(["nav", "header", "footer", "menu"]);
const structuralTags = new Set([
  "main",
  "section",
  "article",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "p",
  "a",
  "img",
  "picture",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "footer",
  "nav",
  "aside",
  "menu",
  "figure",
  "figcaption",
  "strong",
  "em",
  "time",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "small",
  "label",
]);
const HTML = "http://www.w3.org/1999/xhtml";
const groupingThreshold = 0.6;
const maxGroupsPerRoot = 6;
const sampleChildren = 12;
const sampleGrandchildren = 4;

interface Entry {
  element?: Element;
  ordinal: number;
  tag: string;
  key: string;
  visible: boolean;
  depth: number;
  chrome: boolean;
  children: Entry[];
  mask: number;
}
interface Frame {
  node: Node;
  parent?: Entry;
  depth: number;
}
interface Group {
  exemplar: Shape;
  first: Entry;
  masks: number[];
  sumSimilarity: number;
  samples: Element[];
}
interface Ranked extends StructureCandidate {
  samples: readonly Element[];
  firstOrdinal: number;
  enumerate?: () => Iterable<Element | null>;
}

function limitsFor(input?: Partial<AnalysisLimits>): AnalysisLimits {
  const result = { ...defaultLimits };
  for (const key of Object.keys(result) as (keyof AnalysisLimits)[]) {
    const value = input?.[key];
    if (typeof value === "number" && Number.isFinite(value))
      result[key] = Math.min(maxima[key], Math.max(1, Math.floor(value)));
  }
  return result;
}

function taskScheduler() {
  if (typeof MessageChannel !== "function")
    return {
      yield: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      close: () => {},
    };
  const chan = new MessageChannel();
  return {
    yield: () =>
      new Promise<void>((resolve) => {
        chan.port1.onmessage = () => resolve();
        chan.port2.postMessage(0);
      }),
    close: () => {
      chan.port1.close();
      chan.port2.close();
    },
  };
}

function describe(
  element: Element,
  parent: Entry | undefined,
  visibility: "hidden" | "visible",
  depth: number,
  ordinal: number,
): Entry {
  const local = element.localName;
  const tag = structuralTags.has(local) ? local : "other";
  const rawRole = element.getAttribute("role")?.slice(0, 32).toLowerCase();
  const role = rawRole && roles.has(rawRole) ? rawRole : undefined;
  const visible = visibility === "visible";
  let mask = 0;
  if (visible) {
    if (/^h[1-6]$/.test(tag) || role === "heading")
      mask |= ContentSignal.heading;
    if ((tag === "a" && element.hasAttribute("href")) || role === "link")
      mask |= ContentSignal.link;
    if (tag === "img" || role === "img") mask |= ContentSignal.image;
  }
  return {
    ordinal,
    depth,
    tag,
    key: role ? `${tag}:${role}` : tag,
    visible,
    chrome:
      Boolean(parent?.chrome) ||
      chromeTags.has(tag) ||
      Boolean(role && chromeRoles.has(role)),
    children: [],
    mask,
  };
}

function fingerprint(row: Entry): Shape {
  const tokens = new Map<string, number>();
  function add(token: string) {
    tokens.set(token, (tokens.get(token) ?? 0) + 1);
  }
  // Children may be CSS-hidden or wrappers with visible contents, so their visibility
  // is already accounted for on the row and their own masks. Do not scan descendants beyond this sample.
  for (const child of row.children.slice(0, sampleChildren)) {
    add(`1/${child.key}`);
    for (const grandchild of child.children.slice(0, sampleGrandchildren))
      add(`2/${child.key}/${grandchild.key}`);
  }
  return { root: row.key, tokens };
}

function compareCandidates(a: Ranked, b: Ranked) {
  return (
    b.score - a.score ||
    b.observedRows - a.observedRows ||
    a.firstOrdinal - b.firstOrdinal
  );
}

function toCandidate(
  group: Group,
  parent: Entry,
  seen: number,
  total: number,
): Ranked | undefined {
  const observed = group.masks.length;
  if (observed < 2) return undefined;
  const filled = group.masks.filter(Boolean).length / observed;
  if (filled < 0.5) return undefined;
  const ratio = group.sumSimilarity / observed;
  const alignment = alignedFieldCoverage(group.masks);
  const hasRich =
    group.masks.filter(
      (mask) => (mask & (ContentSignal.heading | ContentSignal.image)) !== 0,
    ).length / observed;
  const linkOnly =
    group.masks.filter(
      (mask) =>
        (mask & ContentSignal.link) !== 0 &&
        (mask & (ContentSignal.heading | ContentSignal.image)) === 0,
    ).length /
      observed >=
    0.8;
  const chrome = parent.chrome || group.first.chrome;
  const sampled = seen < total;
  const estimate = sampled ? Math.round((observed * total) / seen) : observed;
  const score = structureScore({
    similarity: ratio,
    alignment,
    content: (filled + hasRich) / 2,
    count: observed,
    visibility: 1,
    penalty: (chrome ? 40 : 0) + (linkOnly ? 9 : 0) + (sampled ? 4 : 0),
  });
  const reasons: CandidateReason[] = [
    { code: "repeat", message: `${observed} similar siblings observed.` },
    {
      code: "similarity",
      message: `${Math.round(ratio * 100)}% average shape similarity to the first member.`,
    },
    {
      code: "aligned-signals",
      message:
        alignment >= 0.6
          ? "Several content signal types recur across the group."
          : "Limited recurring content signal types.",
    },
    {
      code: "record-content",
      message: `${Math.round(filled * 100)}% of observed siblings have a text, link, image, or heading signal.`,
    },
    {
      code: "visible",
      message:
        "Candidate members are not suppressed by the supported visibility checks.",
    },
  ];
  if (chrome)
    reasons.push({
      code: "landmark",
      message:
        "Lower rank: this structure is in a navigation or site landmark.",
    });
  if (linkOnly)
    reasons.push({
      code: "link-only",
      message: "Lower rank: mostly links without headings or images.",
    });
  if (sampled)
    reasons.push({
      code: "sampled",
      message: "Count estimated from a bounded, evenly spaced sibling sample.",
    });
  return {
    id: `r${parent.ordinal}-${group.first.ordinal}`,
    kind: "repeated-siblings",
    tag: group.first.tag,
    parentDepth: parent.depth,
    observedRows: observed,
    estimatedRows: estimate,
    sampled,
    score,
    confidence: score >= 76 ? "strong" : score >= 53 ? "possible" : "weak",
    reasons,
    firstOrdinal: group.first.ordinal,
    samples: group.samples,
  };
}

export async function analyzeDocument(
  doc: Document,
  options: AnalyzerOptions = {},
): Promise<AnalysisResult> {
  return (await scan(doc, options, false)).analysis;
}

/** Internal handles are scoped to the detector's same-document preview pass. Never message them. */
export function scanForDetection(doc: Document) {
  return scan(doc, {}, true);
}

interface Snapshot {
  analysis: AnalysisResult;
  members: ReadonlyMap<string, readonly Element[]>;
  enumerators: ReadonlyMap<string, () => Iterable<Element | null>>;
  tables: readonly HTMLTableElement[];
  tableLimitReached: boolean;
}

async function scan(
  doc: Document,
  options: AnalyzerOptions,
  capture: boolean,
): Promise<Snapshot> {
  const limits = limitsFor(options.limits);
  const start = performance.now();
  const stats: AnalysisResult["stats"] = {
    visited: 0,
    visibleElements: 0,
    pruned: 0,
    depthLimited: 0,
    sampledParents: 0,
    rankedGroups: 0,
    elapsedMs: 0,
  };
  const best: Ranked[] = [];
  const tables: HTMLTableElement[] = [];
  let tableLimitReached = false;
  const finish = (
    status: AnalysisResult["status"],
    reason?: AnalysisResult["reason"],
    discard = false,
  ): Snapshot => ({
    analysis: {
      status,
      ...(reason ? { reason } : {}),
      stats: { ...stats, elapsedMs: performance.now() - start },
      candidates: discard
        ? []
        : best.map(({ firstOrdinal, samples, enumerate, ...candidate }) => {
            void enumerate;
            void firstOrdinal;
            void samples;
            return candidate;
          }),
    },
    members: new Map(
      capture && !discard
        ? best.map((candidate) => [candidate.id, candidate.samples] as const)
        : [],
    ),
    enumerators: new Map(
      capture && !discard
        ? best.flatMap((candidate) =>
            candidate.enumerate
              ? [[candidate.id, candidate.enumerate] as const]
              : [],
          )
        : [],
    ),
    tables: discard ? [] : tables,
    tableLimitReached,
  });
  if (options.signal?.aborted) return finish("cancelled", "aborted", true);
  const view = doc.defaultView;
  const root = doc.body;
  if (!view || !root) return finish("complete");
  const scheduler = options.schedule
    ? { yield: options.schedule, close: () => {} }
    : taskScheduler();
  let dirty = false;
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  // Inspect the document wrapper too (e.g. a replaced body or CSS/class change on <html>).
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  function stop(): Snapshot | undefined {
    if (options.signal?.aborted) return finish("cancelled", "aborted", true);
    if (dirty || observer.takeRecords().length || !root.isConnected)
      return finish("partial", "dom-changed", true);
    if (performance.now() - start >= limits.maxTimeMs)
      return finish("partial", "time-limit");
    return undefined;
  }
  let work = 0;
  function shouldYield() {
    work += 1;
    return work % limits.yieldEvery === 0;
  }
  const entries: Entry[] = [];
  const parents: (Entry | undefined)[] = [];
  const stack: Frame[] = [{ node: root, depth: 0 }];
  let nodeLimited = false;
  try {
    const rootElement = doc.documentElement;
    if (inspectVisibility(rootElement, view) === "prune")
      return finish("complete");
    // Explicit cursor stack: never materialize or pre-enqueue an entire sibling list.
    while (stack.length) {
      const interrupted = stop();
      if (interrupted) return interrupted;
      if (stats.visited >= limits.maxNodes) {
        nodeLimited = true;
        break;
      }
      const frame = stack.pop();
      if (!frame) break;
      const { node, parent, depth } = frame;
      stats.visited += 1;
      if (node !== root && node.nextSibling)
        stack.push({ ...frame, node: node.nextSibling });
      if (node.nodeType === 1) {
        const element = node as Element;
        const visibility =
          element.namespaceURI === HTML
            ? inspectVisibility(element, view)
            : "prune";
        if (visibility === "prune") stats.pruned += 1;
        else {
          const entry = describe(
            element,
            parent,
            visibility,
            depth,
            stats.visited,
          );
          if (capture && entry.visible) {
            entry.element = element;
            if (entry.tag === "table") {
              if (tables.length < 24) tables.push(element as HTMLTableElement);
              else tableLimitReached = true;
            }
          }
          entries.push(entry);
          if (entry.visible) stats.visibleElements += 1;
          // Keep visible siblings only, but aggregate signals through non-pruned hidden wrappers below.
          if (entry.visible) parent?.children.push(entry);
          const first = element.shadowRoot ? null : element.firstChild;
          if (first && depth < limits.maxDepth)
            stack.push({ node: first, parent: entry, depth: depth + 1 });
          else if (first) stats.depthLimited += 1;
          // Internal parent linkage for aggregation (never serialized or returned).
          parents.push(parent);
        }
      } else if (
        node.nodeType === 3 &&
        parent?.visible &&
        (node as Text).data.slice(0, 256).trim().length > 0
      ) {
        parent.mask |= ContentSignal.text;
      }
      if (shouldYield()) await scheduler.yield();
    }
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const interrupted = stop();
      if (interrupted) return interrupted;
      const entry = entries[i];
      const parent = parents[i];
      if (entry && parent) parent.mask |= entry.mask;
      if (shouldYield()) await scheduler.yield();
    }
    for (const parent of entries) {
      const interrupted = stop();
      if (interrupted) return interrupted;
      const count = parent.children.length;
      if (count >= 2) {
        const buckets = new Map<string, Group[]>();
        const seen = Math.min(count, limits.maxSiblings);
        if (seen < count) stats.sampledParents += 1;
        for (let i = 0; i < seen; i += 1) {
          const row = parent.children[Math.floor((i * count) / seen)];
          if (!row) continue;
          const shape = fingerprint(row);
          const matches = buckets.get(shape.root) ?? [];
          let bestMatch: Group | undefined;
          let bestSimilarity = groupingThreshold;
          for (const group of matches) {
            const value = similarity(shape, group.exemplar);
            if (
              value >= groupingThreshold &&
              (!bestMatch || value > bestSimilarity)
            ) {
              bestMatch = group;
              bestSimilarity = value;
            }
          }
          if (bestMatch) {
            bestMatch.masks.push(row.mask);
            if (row.element && bestMatch.samples.length < 6)
              bestMatch.samples.push(row.element);
            bestMatch.sumSimilarity += bestSimilarity;
          } else if (matches.length < maxGroupsPerRoot) {
            matches.push({
              exemplar: shape,
              first: row,
              masks: [row.mask],
              sumSimilarity: 1,
              samples: row.element ? [row.element] : [],
            });
            buckets.set(shape.root, matches);
          }
          if (shouldYield()) {
            await scheduler.yield();
            const state = stop();
            if (state) return state;
          }
        }
        for (const groups of buckets.values())
          for (const group of groups) {
            const candidate = toCandidate(group, parent, seen, count);
            if (!candidate) continue;
            if (capture)
              candidate.enumerate = function* () {
                for (const child of parent.children) {
                  if (
                    child.key !== group.exemplar.root ||
                    !child.element?.isConnected
                  ) {
                    yield null;
                    continue;
                  }
                  const shape = fingerprint(child);
                  let picked: Group | undefined;
                  let score = groupingThreshold;
                  for (const siblingGroup of groups) {
                    const value = similarity(shape, siblingGroup.exemplar);
                    if (
                      value >= groupingThreshold &&
                      (!picked || value > score)
                    ) {
                      picked = siblingGroup;
                      score = value;
                    }
                  }
                  yield picked === group ? child.element : null;
                }
              };
            stats.rankedGroups += 1;
            best.push(candidate);
            best.sort(compareCandidates);
            if (best.length > limits.maxCandidates) best.pop();
          }
      }
      if (shouldYield()) await scheduler.yield();
    }
    const interrupted = stop();
    if (interrupted) return interrupted;
    if (nodeLimited) return finish("partial", "node-limit");
    if (stats.depthLimited) return finish("partial", "depth-limit");
    return finish("complete");
  } finally {
    observer.disconnect();
    scheduler.close();
  }
}
