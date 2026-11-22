/**
 * Detection accuracy corpus.
 *
 * Every page here models a real-world layout archetype with the noise that breaks
 * naive detectors: hashed class names, site chrome, interleaved ads, missing fields,
 * unicode, and inconsistent card shapes. Pages are rendered from deterministic
 * builders so the corpus is reviewable, offline, and legal to keep in the repository.
 *
 * The harness (`tests/e2e/corpus.spec.ts`) measures top-1 accuracy against `expect`
 * and writes `docs/reports/ACCURACY.md`. Add real captured pages later with the
 * procedure documented in that report; never re-fetch a live site during a run.
 */

export type ExpectedKind =
  "products" | "articles" | "directory" | "list" | "cards" | "table";

export interface CorpusPage {
  id: string;
  archetype: string;
  note: string;
  html: string;
  expect: {
    kinds: ExpectedKind[];
    minRows: number;
    maxRows: number;
    minColumns: number;
    maxColumns: number;
    /** Text that must never appear in the top candidate's preview (content bleed). */
    absentFromTop?: string[];
  };
}

/** Navigation, footer and ad copy that must never win. */
export const decoys = [
  "Sign in",
  "Create account",
  "Privacy policy",
  "Cookie settings",
  "About us",
  "Careers",
  "Advertisement",
  "Sponsored",
  "Subscribe to our newsletter",
  "Download our app",
];

const hash = (seed: number) => `css-${(seed * 2654435761) % 100000}`;

function shell(
  title: string,
  body: string,
  options: { nav?: boolean; aside?: boolean } = {},
): string {
  const { nav = true, aside = true } = options;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body>
<header class="${hash(1)}"><a href="/" class="${hash(2)}">Storefront</a>
<nav class="${hash(3)}" aria-label="Primary">${
    nav
      ? [
          ["Sign in", "/login"],
          ["Create account", "/register"],
          ["Privacy policy", "/privacy"],
          ["About us", "/about"],
          ["Careers", "/jobs"],
        ]
          .map(([label, href]) => `<a href="${href}">${label}</a>`)
          .join("")
      : ""
  }</nav></header>
<div class="${hash(4)}">
${aside ? `<aside class="${hash(5)}"><h2>Filters</h2><ul><li><a href="/c/1">Under ৳500</a></li><li><a href="/c/2">In stock</a></li><li><a href="/c/3">Free delivery</a></li></ul></aside>` : ""}
<main id="content" class="${hash(6)}"><h1>${title}</h1>
${body}
</main></div>
<footer class="${hash(7)}"><ul><li><a href="/terms">Terms</a></li><li><a href="/privacy">Privacy policy</a></li><li><a href="/cookies">Cookie settings</a></li></ul></footer>
</body></html>`;
}

const products = [
  "Trail lamp 400 lumen",
  "Camp pack 45L",
  "Insulated flask 1L",
  "Folding stool",
  "Tarp shelter 3×3",
  "Sleeping mat",
  "Hiking poles (pair)",
  "Water filter",
  "Cook set titanium",
  "Head torch",
  "Dry bag 20L",
  "First aid kit",
];
const unicodeProducts = [
  "সরঞ্জাম ব্যাগ",
  "পাহাড়ি তাঁবু",
  "ক্যাম্প লাইট",
  "হাইকিং জুতা",
];

type GridOptions = {
  count: number;
  unicode?: boolean;
  ads?: boolean;
  missingPrice?: boolean;
  noImages?: boolean;
  seed?: number;
};

function productGrid(options: GridOptions): string {
  const {
    count,
    unicode = false,
    ads = false,
    missingPrice = false,
    noImages = false,
    seed = 11,
  } = options;
  const names = unicode ? unicodeProducts : products;
  const items: string[] = [];
  for (let index = 0; index < count; index++) {
    const name = names[index % names.length] ?? "Item";
    const price =
      missingPrice && index % 4 === 3 ? "" : `৳${(index + 3) * 250}`;
    const image = noImages
      ? ""
      : `<img src="/img/${seed}-${index}.jpg" alt="${name} product photo">`;
    items.push(`<li class="${hash(seed + index)}">
  <a href="/p/${seed}-${index}" class="${hash(seed + index + 40)}">${image}<h3>${name}</h3></a>
  <p class="${hash(seed + index + 70)}">${price}</p>
  <p class="${hash(seed + index + 90)}">In stock · ships in 2 days</p>
  ${ads && index === 1 ? '<div class="ad"><a href="/promo">Advertisement</a></div>' : ""}
</li>`);
  }
  return shell(
    "Camping essentials",
    `<ul class="${hash(seed + 5)}">${items.join("\n")}</ul>`,
  );
}

function articleFeed(options: {
  count: number;
  images?: boolean;
  summaries?: boolean;
  seed?: number;
}): string {
  const { count, images = true, summaries = true, seed = 21 } = options;
  const items = Array.from({ length: count }, (_, index) => {
    return `<article class="${hash(seed + index)}">
  ${images ? `<a href="/a/${index}"><img src="/img/a${index}.jpg" alt=""></a>` : ""}
  <h2><a href="/a/${index}">Field notes ${index + 1}: packing light in the delta</a></h2>
  <p class="${hash(seed + index + 10)}"><time datetime="2026-0${(index % 9) + 1}-14">March ${index + 1}, 2026</time> · 6 min read</p>
  ${summaries ? `<p>A short report from the field with practical notes on weight, weather and water.</p>` : ""}
</article>`;
  });
  return shell(
    "Field notes",
    `<section class="${hash(seed + 9)}">${items.join("\n")}</section>`,
  );
}

function searchResults(options: {
  count: number;
  urls?: boolean;
  seed?: number;
}): string {
  const { count, urls = true, seed = 31 } = options;
  const items = Array.from({ length: count }, (_, index) => {
    return `<li class="${hash(seed + index)}">
  <h3><a href="https://example.org/result/${index}">Result ${index + 1}: lightweight shelters reviewed</a></h3>
  ${urls ? `<cite>example.org › result › ${index}</cite>` : ""}
  <p>Independent comparison of shelters under 1.5 kg with measured packed size.</p>
</li>`;
  });
  return shell(
    "Search results",
    `<form role="search"><input name="q" value="shelter"><button type="submit">Search</button></form>
<ol class="${hash(seed + 4)}">${items.join("\n")}</ol>`,
  );
}

function directory(options: {
  count: number;
  phones?: boolean;
  seed?: number;
}): string {
  const { count, phones = true, seed = 41 } = options;
  const items = Array.from({ length: count }, (_, index) => {
    return `<div class="${hash(seed + index)}">
  <h3><a href="/biz/${index}">Delta Outdoor Supply ${index + 1}</a></h3>
  <p>12 Market Road, Narsingdi</p>
  ${phones ? `<p>+880 1700 0000${index}</p>` : ""}
  <p>Open until 20:00</p>
</div>`;
  });
  return shell(
    "Outdoor shops",
    `<div class="${hash(seed + 3)}">${items.join("\n")}</div>`,
  );
}

function docsTable(options: {
  rows: number;
  header?: boolean;
  seed?: number;
}): string {
  const { rows, header = true, seed = 51 } = options;
  const head = header
    ? "<thead><tr><th>Model</th><th>Weight</th><th>Capacity</th><th>Price</th></tr></thead>"
    : "";
  const body = Array.from(
    { length: rows },
    (_, index) =>
      `<tr><td>SNX-${100 + index}</td><td>${(0.4 + index / 10).toFixed(2)} kg</td><td>${10 + index} L</td><td>৳${(index + 2) * 400}</td></tr>`,
  ).join("");
  return shell(
    "Specification table",
    `<table class="${hash(seed)}">${head}<tbody>${body}</tbody></table>`,
  );
}

function spanTable(options: { rows: number; seed?: number }): string {
  const { rows, seed = 61 } = options;
  const body = Array.from({ length: rows }, (_, index) =>
    index % 3 === 0
      ? `<tr><th scope="row">Group ${Math.floor(index / 3) + 1}</th><td>Item ${index + 1}</td><td>${12 + index}</td></tr>`
      : `<tr><td>Item ${index + 1}</td><td>${12 + index}</td></tr>`,
  ).join("");
  return shell(
    "Stock by group",
    `<table class="${hash(seed)}"><thead><tr><th>Group</th><th>Item</th><th>Quantity</th></tr></thead><tbody>${body}</tbody></table>`,
  );
}

function nestedTable(options: { rows: number; seed?: number }): string {
  const { rows, seed = 71 } = options;
  const body = Array.from(
    { length: rows },
    (_, index) =>
      `<tr><td>Bundle ${index + 1}</td><td><table><tr><th>Part</th><th>Qty</th></tr><tr><td>Lamp</td><td>1</td></tr><tr><td>Battery</td><td>4</td></tr></table></td><td>৳${(index + 1) * 900}</td></tr>`,
  ).join("");
  return shell(
    "Bundle contents",
    `<table class="${hash(seed)}"><thead><tr><th>Bundle</th><th>Contents</th><th>Price</th></tr></thead><tbody>${body}</tbody></table>`,
  );
}

function divSoup(options: { count: number; seed?: number }): string {
  const { count, seed = 81 } = options;
  const items = Array.from({ length: count }, (_, index) => {
    return `<div class="${hash(seed + index)}"><div class="${hash(seed + index + 5)}"><div class="${hash(seed + index + 9)}"><a href="/s/${index}"><div class="${hash(seed + index + 13)}"><img src="/img/s${index}.jpg" alt=""></div><div class="${hash(seed + index + 17)}"><span>Service ${index + 1}</span><span>৳${(index + 1) * 1500}</span><span>★★★★☆</span></div></a></div></div></div>`;
  });
  return shell(
    "Services",
    `<div class="${hash(seed + 2)}">${items.join("")}</div>`,
    { aside: false },
  );
}

function loadMoreFeed(options: { count: number; seed?: number }): string {
  const { count, seed = 91 } = options;
  const items = Array.from({ length: count }, (_, index) => {
    return `<li class="${hash(seed + index)}"><a href="/l/${index}"><img src="/img/l${index}.jpg" alt=""><h3>Listing ${index + 1}</h3></a><p>৳${(index + 2) * 300}</p><p>Dhaka · verified</p></li>`;
  });
  return shell(
    "Marketplace",
    `<ul class="${hash(seed + 3)}">${items.join("")}</ul><button type="button" class="${hash(seed + 6)}">Load more</button>`,
  );
}

function irregularCards(options: { count: number; seed?: number }): string {
  const { count, seed = 121 } = options;
  const items = Array.from({ length: count }, (_, index) => {
    const shape = index % 4;
    const image = shape === 1 ? "" : `<img src="/img/i${index}.jpg" alt="">`;
    const price = shape === 2 ? "" : `<span>৳${(index + 2) * 275}</span>`;
    const extra =
      shape === 3
        ? "<p>Includes spare battery and carry case.</p><p>2 year warranty</p>"
        : "";
    return `<div class="${hash(seed + index)}"><a href="/i/${index}">${image}<h3>Gear ${index + 1}</h3></a><div class="${hash(seed + index + 30)}">${price}<span>Verified seller</span></div>${extra}</div>`;
  });
  return shell(
    "Used gear",
    `<div class="${hash(seed + 7)}">${items.join("")}</div>`,
  );
}

const base = { minColumns: 2, maxColumns: 8 };

export const corpus: CorpusPage[] = [
  {
    id: "products-01",
    archetype: "product-grid",
    note: "12 cards, ads interleaved, prices present",
    html: productGrid({ count: 12, ads: true }),
    expect: { kinds: ["products", "cards"], minRows: 12, maxRows: 13, ...base },
  },
  {
    id: "products-02",
    archetype: "product-grid",
    note: "8 cards with missing prices on every fourth card",
    html: productGrid({ count: 8, missingPrice: true, seed: 13 }),
    expect: { kinds: ["products", "cards"], minRows: 8, maxRows: 9, ...base },
  },
  {
    id: "products-03",
    archetype: "product-grid",
    note: "Bangla titles, no images",
    html: productGrid({ count: 10, unicode: true, noImages: true, seed: 17 }),
    expect: { kinds: ["products", "cards"], minRows: 10, maxRows: 11, ...base },
  },
  {
    id: "products-04",
    archetype: "product-grid",
    note: "Small grid without sidebar noise",
    html: productGrid({ count: 4, seed: 19 }),
    expect: { kinds: ["products", "cards"], minRows: 4, maxRows: 5, ...base },
  },
  {
    id: "articles-01",
    archetype: "article-feed",
    note: "3 article cards with images and summaries",
    html: articleFeed({ count: 3 }),
    expect: { kinds: ["articles", "cards"], minRows: 3, maxRows: 4, ...base },
  },
  {
    id: "articles-02",
    archetype: "article-feed",
    note: "7 text-only articles",
    html: articleFeed({ count: 7, images: false, seed: 23 }),
    expect: { kinds: ["articles", "cards"], minRows: 7, maxRows: 8, ...base },
  },
  {
    id: "articles-03",
    archetype: "article-feed",
    note: "5 articles without summaries",
    html: articleFeed({ count: 5, summaries: false, seed: 27 }),
    expect: { kinds: ["articles", "cards"], minRows: 5, maxRows: 6, ...base },
  },
  {
    id: "articles-04",
    archetype: "article-feed",
    note: "10 articles, dense feed",
    html: articleFeed({ count: 10, seed: 29 }),
    expect: { kinds: ["articles", "cards"], minRows: 10, maxRows: 11, ...base },
  },
  {
    id: "search-01",
    archetype: "search-results",
    note: "6 results with displayed URLs",
    html: searchResults({ count: 6 }),
    expect: {
      kinds: ["list", "articles", "cards"],
      minRows: 6,
      maxRows: 7,
      ...base,
    },
  },
  {
    id: "search-02",
    archetype: "search-results",
    note: "3 results with displayed URLs",
    html: searchResults({ count: 3, seed: 33 }),
    expect: {
      kinds: ["list", "articles", "cards"],
      minRows: 3,
      maxRows: 4,
      ...base,
    },
  },
  {
    id: "search-03",
    archetype: "search-results",
    note: "9 results without displayed URLs",
    html: searchResults({ count: 9, urls: false, seed: 35 }),
    expect: {
      kinds: ["list", "articles", "cards"],
      minRows: 9,
      maxRows: 10,
      ...base,
    },
  },
  {
    id: "search-04",
    archetype: "search-results",
    note: "4 results with pagination chrome",
    html: searchResults({ count: 4, seed: 37 }),
    expect: {
      kinds: ["list", "articles", "cards"],
      minRows: 4,
      maxRows: 5,
      ...base,
    },
  },
  {
    id: "directory-01",
    archetype: "directory",
    note: "8 business entries with phone numbers",
    html: directory({ count: 8 }),
    expect: {
      kinds: ["directory", "cards", "list"],
      minRows: 8,
      maxRows: 9,
      ...base,
    },
  },
  {
    id: "directory-02",
    archetype: "directory",
    note: "5 entries without phone numbers",
    html: directory({ count: 5, phones: false, seed: 43 }),
    expect: {
      kinds: ["directory", "cards", "list"],
      minRows: 5,
      maxRows: 6,
      ...base,
    },
  },
  {
    id: "directory-03",
    archetype: "directory",
    note: "12 entries, long list",
    html: directory({ count: 12, seed: 47 }),
    expect: {
      kinds: ["directory", "cards", "list"],
      minRows: 12,
      maxRows: 13,
      ...base,
    },
  },
  {
    id: "directory-04",
    archetype: "directory",
    note: "3 entries only",
    html: directory({ count: 3, seed: 49 }),
    expect: {
      kinds: ["directory", "cards", "list"],
      minRows: 3,
      maxRows: 4,
      ...base,
    },
  },
  {
    id: "tables-01",
    archetype: "docs-table",
    note: "Header row plus 12 body rows",
    html: docsTable({ rows: 12 }),
    expect: {
      kinds: ["table"],
      minRows: 12,
      maxRows: 12,
      minColumns: 4,
      maxColumns: 4,
    },
  },
  {
    id: "tables-02",
    archetype: "docs-table",
    note: "Headerless table with 6 rows",
    html: docsTable({ rows: 6, header: false, seed: 53 }),
    expect: {
      kinds: ["table"],
      minRows: 6,
      maxRows: 6,
      minColumns: 4,
      maxColumns: 4,
    },
  },
  {
    id: "tables-03",
    archetype: "docs-table",
    note: "Long table, 40 rows",
    html: docsTable({ rows: 40, seed: 57 }),
    expect: {
      kinds: ["table"],
      minRows: 40,
      maxRows: 40,
      minColumns: 4,
      maxColumns: 4,
    },
  },
  {
    id: "tables-04",
    archetype: "docs-table",
    note: "Minimal table, 2 rows",
    html: docsTable({ rows: 2, seed: 59 }),
    expect: {
      kinds: ["table"],
      minRows: 2,
      maxRows: 2,
      minColumns: 4,
      maxColumns: 4,
    },
  },
  {
    id: "span-01",
    archetype: "span-table",
    note: "Row headers grouping quantities",
    html: spanTable({ rows: 9 }),
    expect: { kinds: ["table"], minRows: 9, maxRows: 9, ...base },
  },
  {
    id: "span-02",
    archetype: "span-table",
    note: "Short grouped table",
    html: spanTable({ rows: 3, seed: 63 }),
    expect: { kinds: ["table"], minRows: 3, maxRows: 3, ...base },
  },
  {
    id: "span-03",
    archetype: "span-table",
    note: "Long grouped table",
    html: spanTable({ rows: 18, seed: 67 }),
    expect: { kinds: ["table"], minRows: 18, maxRows: 18, ...base },
  },
  {
    id: "span-04",
    archetype: "span-table",
    note: "Grouped table with 6 rows",
    html: spanTable({ rows: 6, seed: 69 }),
    expect: { kinds: ["table"], minRows: 6, maxRows: 6, ...base },
  },
  {
    id: "nested-01",
    archetype: "nested-table",
    note: "Each cell contains its own table",
    html: nestedTable({ rows: 4 }),
    expect: {
      kinds: ["table"],
      minRows: 4,
      maxRows: 4,
      minColumns: 2,
      maxColumns: 4,
    },
  },
  {
    id: "nested-02",
    archetype: "nested-table",
    note: "Nested tables with 2 rows",
    html: nestedTable({ rows: 2, seed: 73 }),
    expect: {
      kinds: ["table"],
      minRows: 2,
      maxRows: 2,
      minColumns: 2,
      maxColumns: 4,
    },
  },
  {
    id: "nested-03",
    archetype: "nested-table",
    note: "Nested tables with 7 rows",
    html: nestedTable({ rows: 7, seed: 77 }),
    expect: {
      kinds: ["table"],
      minRows: 7,
      maxRows: 7,
      minColumns: 2,
      maxColumns: 4,
    },
  },
  {
    id: "nested-04",
    archetype: "nested-table",
    note: "Nested tables with 10 rows",
    html: nestedTable({ rows: 10, seed: 79 }),
    expect: {
      kinds: ["table"],
      minRows: 10,
      maxRows: 10,
      minColumns: 2,
      maxColumns: 4,
    },
  },
  {
    id: "soup-01",
    archetype: "div-soup",
    note: "Nested divs, no semantic markup, 8 items",
    html: divSoup({ count: 8 }),
    expect: {
      kinds: ["cards", "products", "list", "directory"],
      minRows: 8,
      maxRows: 9,
      ...base,
    },
  },
  {
    id: "soup-02",
    archetype: "div-soup",
    note: "Div soup with 3 items",
    html: divSoup({ count: 3, seed: 83 }),
    expect: {
      kinds: ["cards", "products", "list", "directory"],
      minRows: 3,
      maxRows: 4,
      ...base,
    },
  },
  {
    id: "soup-03",
    archetype: "div-soup",
    note: "Div soup with 14 items",
    html: divSoup({ count: 14, seed: 87 }),
    expect: {
      kinds: ["cards", "products", "list", "directory"],
      minRows: 14,
      maxRows: 15,
      ...base,
    },
  },
  {
    id: "soup-04",
    archetype: "div-soup",
    note: "Div soup with 5 items",
    html: divSoup({ count: 5, seed: 89 }),
    expect: {
      kinds: ["cards", "products", "list", "directory"],
      minRows: 5,
      maxRows: 6,
      ...base,
    },
  },
  {
    id: "market-01",
    archetype: "load-more-feed",
    note: "Marketplace list with Load more control",
    html: loadMoreFeed({ count: 6 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 6,
      maxRows: 7,
      ...base,
    },
  },
  {
    id: "market-02",
    archetype: "load-more-feed",
    note: "Marketplace list with 2 items",
    html: loadMoreFeed({ count: 2, seed: 93 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 2,
      maxRows: 3,
      ...base,
    },
  },
  {
    id: "market-03",
    archetype: "load-more-feed",
    note: "Marketplace list with 11 items",
    html: loadMoreFeed({ count: 11, seed: 97 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 11,
      maxRows: 12,
      ...base,
    },
  },
  {
    id: "market-04",
    archetype: "load-more-feed",
    note: "Marketplace list with 4 items",
    html: loadMoreFeed({ count: 4, seed: 99 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 4,
      maxRows: 5,
      ...base,
    },
  },
  {
    id: "products-05",
    archetype: "product-grid",
    note: "Dense grid, 16 cards, ads every third",
    html: productGrid({ count: 16, ads: true, seed: 101 }),
    expect: { kinds: ["products", "cards"], minRows: 16, maxRows: 17, ...base },
  },
  {
    id: "articles-05",
    archetype: "article-feed",
    note: "2 article cards only",
    html: articleFeed({ count: 2, seed: 103 }),
    expect: { kinds: ["articles", "cards"], minRows: 2, maxRows: 3, ...base },
  },

  {
    id: "irregular-01",
    archetype: "irregular-cards",
    note: "Cards missing image or price in a repeating four-shape cycle",
    html: irregularCards({ count: 8 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 8,
      maxRows: 9,
      ...base,
    },
  },
  {
    id: "irregular-02",
    archetype: "irregular-cards",
    note: "Irregular cards, 5 items",
    html: irregularCards({ count: 5, seed: 123 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 5,
      maxRows: 6,
      ...base,
    },
  },
  {
    id: "irregular-03",
    archetype: "irregular-cards",
    note: "Irregular cards, 13 items",
    html: irregularCards({ count: 13, seed: 127 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 13,
      maxRows: 14,
      ...base,
    },
  },
  {
    id: "irregular-04",
    archetype: "irregular-cards",
    note: "Irregular cards with long extra descriptive text",
    html: irregularCards({ count: 4, seed: 131 }),
    expect: {
      kinds: ["products", "cards", "list"],
      minRows: 4,
      maxRows: 5,
      ...base,
    },
  },
  {
    id: "nested-05",
    archetype: "nested-table",
    note: "Inner table content must not bleed into the outer cell",
    html: nestedTable({ rows: 5, seed: 137 }),
    expect: {
      kinds: ["table"],
      minRows: 5,
      maxRows: 5,
      minColumns: 2,
      maxColumns: 4,
      absentFromTop: ["Battery", "Lamp", "Part"],
    },
  },
  {
    id: "mixed-01",
    archetype: "mixed-page",
    note: "Sidebar filter list, nav links and a real product grid compete",
    html: productGrid({ count: 9, ads: true, seed: 111 }),
    expect: { kinds: ["products", "cards"], minRows: 9, maxRows: 10, ...base },
  },
  {
    id: "mixed-02",
    archetype: "mixed-page",
    note: "Article feed beside a documentation table",
    html: articleFeed({ count: 6, seed: 113 }).replace(
      "</main>",
      `<table><thead><tr><th>Model</th><th>Weight</th></tr></thead><tbody><tr><td>SNX-1</td><td>1.2 kg</td></tr><tr><td>SNX-2</td><td>1.4 kg</td></tr></tbody></table></main>`,
    ),
    expect: {
      kinds: ["table", "articles", "cards"],
      minRows: 2,
      maxRows: 8,
      ...base,
    },
  },
  {
    id: "directory-05",
    archetype: "directory",
    note: "Directory without sidebar, 6 entries",
    html: directory({ count: 6, seed: 107 }),
    expect: {
      kinds: ["directory", "cards", "list"],
      minRows: 6,
      maxRows: 7,
      ...base,
    },
  },
];
