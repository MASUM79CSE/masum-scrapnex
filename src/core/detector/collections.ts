import { inspectVisibility } from "../analyzer/visibility";
import type { StructureCandidate } from "../analyzer";
import {
  maxColumns,
  type Column,
  type DetectedCandidate,
  type Kind,
} from "./contracts";
import { safeWebUrl, uniqueLabels, visibleText } from "./dom";

interface Field {
  key: string;
  label: string;
  kind: Column["kind"];
  value: string;
  priority: number;
}
interface Evidence {
  title: boolean;
  price: boolean;
  address: boolean;
  article: boolean;
  product: boolean;
}
interface RowFields {
  fields: Field[];
  evidence: Evidence;
}
const currency =
  /^(?:[$€£৳₹¥]\s*\d|(?:USD|EUR|GBP|BDT|INR)\s*\d|\d[\d.,\s]*\s*(?:€|EUR\b|USD\b|BDT\b|৳))/iu;
const semanticTags = new Set([
  "article",
  "section",
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
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "time",
  "address",
  "strong",
  "em",
  "small",
  "figure",
  "figcaption",
]);
const typedProducts = new Set([
  "https://schema.org/Product",
  "http://schema.org/Product",
]);

function rowFields(root: Element, view: Window, base: string): RowFields {
  const fields: Field[] = [];
  const evidence: Evidence = {
    title: false,
    price: false,
    address: false,
    article: root.localName === "article",
    product: typedProducts.has(root.getAttribute("itemtype") ?? ""),
  };
  const maxNodes = 80;
  const stack: {
    element: Element;
    parent: string;
    depth: number;
    counters: Map<string, number>;
    textOwned: boolean;
  }[] = [
    {
      element: root,
      parent: "",
      depth: 0,
      counters: new Map(),
      textOwned: false,
    },
  ];
  let visited = 0;
  function add(
    key: string,
    label: string,
    kind: Column["kind"],
    value: string | null,
    priority: number,
  ) {
    if (value && fields.length < 28)
      fields.push({ key, label, kind, value, priority });
  }
  while (stack.length && visited++ < maxNodes) {
    const frame = stack.pop();
    if (!frame) break;
    const { element, parent, depth, counters, textOwned } = frame;
    if (element !== root && element.nextElementSibling)
      stack.push({ ...frame, element: element.nextElementSibling });
    const tag = element.localName;
    if (
      element.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
      tag === "table"
    )
      continue;
    const visibility = inspectVisibility(element, view);
    if (visibility === "prune") continue;
    const normalized = semanticTags.has(tag) ? tag : "other";
    const index = counters.get(normalized) ?? 0;
    counters.set(normalized, index + 1);
    const path = depth ? `${parent}/${normalized}:${index}` : "row";
    const role = element.getAttribute("role");
    const semantic = element.getAttribute("itemprop");
    const heading =
      /^h[1-6]$/.test(tag) || role === "heading" || semantic === "name";
    const address = tag === "address" || semantic === "address";
    const date = tag === "time" || semantic === "datePublished";
    const description = tag === "p" || semantic === "description";
    let ownsText = textOwned;
    if (visibility === "visible") {
      if (tag === "a")
        add(
          `${path}:url`,
          "Link",
          "url",
          safeWebUrl(element.getAttribute("href"), base),
          72,
        );
      if (tag === "img")
        add(
          `${path}:image`,
          "Image URL",
          "image",
          safeWebUrl(element.getAttribute("src"), base),
          68,
        );
      if (
        !textOwned &&
        (heading ||
          address ||
          date ||
          description ||
          semantic === "price" ||
          (depth > 0 && !element.firstElementChild) ||
          (!depth && !element.firstElementChild))
      ) {
        const value = visibleText(element, view);
        if (value) {
          const price =
            semantic === "price" ||
            (value.length <= 56 && currency.test(value));
          evidence.title ||= heading;
          evidence.address ||= address;
          evidence.price ||= price;
          evidence.article ||= date;
          const label = heading
            ? "Title"
            : address
              ? "Address"
              : date
                ? "Date"
                : price
                  ? "Price"
                  : description
                    ? "Description"
                    : "Text";
          const priority = heading
            ? 100
            : address || price
              ? 90
              : date
                ? 79
                : description
                  ? 65
                  : 40;
          add(`${path}:text`, label, "text", value, priority);
          ownsText = true;
        }
      }
    }
    if (depth < 5 && element.firstElementChild && !element.shadowRoot)
      stack.push({
        element: element.firstElementChild,
        parent: path,
        depth: depth + 1,
        counters: new Map(),
        textOwned: ownsText,
      });
  }
  if (!fields.some((field) => field.kind === "text"))
    add("row:fallback", "Text", "text", visibleText(root, view), 50);
  return { fields, evidence };
}

function classify(
  rows: readonly RowFields[],
  first: Element,
): { kind: Kind; reason: string } {
  const typical = (signal: (entry: Evidence) => boolean) =>
    rows.filter((row) => signal(row.evidence)).length >=
    Math.ceil(rows.length * 0.6);
  if (typical((entry) => entry.address))
    return {
      kind: "directory",
      reason: "Address semantics recur across previewed entries.",
    };
  if (typical((entry) => (entry.title && entry.price) || entry.product))
    return {
      kind: "products",
      reason:
        "Repeated title-and-price pairs or product markup suggest a catalog.",
    };
  if (typical((entry) => entry.title && entry.article))
    return {
      kind: "articles",
      reason: "Repeated headings with article or publication-date markup.",
    };
  if (
    first.localName === "li" ||
    first.localName === "dd" ||
    first.getAttribute("role") === "listitem"
  )
    return { kind: "list", reason: "Repeated semantic list items." };
  return {
    kind: "cards",
    reason: "Repeated row shapes with no stronger semantic classification.",
  };
}

export function detectCollection(
  group: StructureCandidate,
  members: readonly Element[],
  view: Window,
  base: string,
): DetectedCandidate | undefined {
  const first = members[0];
  if (
    !first ||
    members.length < 2 ||
    group.score < 48 ||
    group.reasons.some(({ code }) => code === "landmark") ||
    /^(table|thead|tbody|tfoot|tr|td|th)$/.test(group.tag) ||
    first.closest("table")
  )
    return;
  const samples = members.map((element) => rowFields(element, view, base));
  const { kind, reason } = classify(samples, first);
  const keys = new Map<
    string,
    { field: Field; count: number; labels: Map<string, number> }
  >();
  for (const row of samples)
    for (const field of row.fields) {
      const info = keys.get(field.key) ?? {
        field,
        count: 0,
        labels: new Map(),
      };
      info.count += 1;
      info.labels.set(field.label, (info.labels.get(field.label) ?? 0) + 1);
      keys.set(field.key, info);
    }
  const ranked = [...keys.values()]
    .filter(
      ({ count }) => count >= Math.max(2, Math.ceil(samples.length * 0.5)),
    )
    .sort((a, b) => b.field.priority - a.field.priority || b.count - a.count)
    .slice(0, maxColumns);
  if (!ranked.length) return;
  const names = uniqueLabels(
    ranked.map(({ labels, count }) => {
      const winner = [...labels.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!winner || winner[1] < Math.ceil(count * 0.6)) return "Text";
      return kind === "products" && winner[0] === "Title"
        ? "Product name"
        : winner[0];
    }),
  );
  return {
    id: group.id,
    kind,
    observed: group.observedRows,
    estimate: group.estimatedRows,
    sampled: group.sampled,
    score: Math.min(
      100,
      group.score + (kind !== "cards" && kind !== "list" ? 4 : 0),
    ),
    explanations: [reason, ...group.reasons.map(({ message }) => message)],
    columns: ranked.map(({ field }, index) => ({
      id: `c${index + 1}`,
      label: names[index] ?? `Column ${index + 1}`,
      kind: field.kind,
    })),
    rows: samples.map(({ fields }) =>
      ranked.map(
        ({ field }) =>
          fields.find(({ key }) => key === field.key)?.value ?? null,
      ),
    ),
  };
}
