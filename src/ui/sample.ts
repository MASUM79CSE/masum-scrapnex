export interface SampleRow {
  id: string;
  item: string;
  category: string;
  price: string;
  availability: string;
}

export const columns = [
  { id: "item", name: "Product name" },
  { id: "category", name: "Category" },
  { id: "price", name: "Price" },
  { id: "availability", name: "Availability" },
] as const;

export const candidates = [
  {
    id: "products",
    title: "Product catalog",
    type: "Repeating cards",
    score: "Strong match",
    hint: "Repeated title, price, and availability fields.",
    rows: [
      {
        id: "p1",
        item: "Ridge Trail Backpack",
        category: "Packs",
        price: "$84.00",
        availability: "In stock",
      },
      {
        id: "p2",
        item: "Summit Insulated Bottle",
        category: "Hydration",
        price: "$32.00",
        availability: "In stock",
      },
      {
        id: "p3",
        item: "Terrain Camp Lantern",
        category: "Lighting",
        price: "$46.00",
        availability: "Low stock",
      },
      {
        id: "p4",
        item: "Alpine Compact Stove",
        category: "Camp kitchen",
        price: "$58.00",
        availability: "In stock",
      },
      {
        id: "p5",
        item: "Basecamp Utility Blanket",
        category: "Camping",
        price: "$62.00",
        availability: "Out of stock",
      },
      {
        id: "p6",
        item: "Waypoint Trekking Poles",
        category: "Trail gear",
        price: "$74.00",
        availability: "In stock",
      },
    ],
  },
  {
    id: "gear",
    title: "Featured gear",
    type: "Repeated list",
    score: "Possible match",
    hint: "Short list with consistent product names and prices.",
    rows: [
      {
        id: "g1",
        item: "Aster Headlamp",
        category: "Lighting",
        price: "$36.00",
        availability: "In stock",
      },
      {
        id: "g2",
        item: "Roam Daypack",
        category: "Packs",
        price: "$52.00",
        availability: "Low stock",
      },
      {
        id: "g3",
        item: "Signal Fire Kit",
        category: "Camping",
        price: "$18.00",
        availability: "In stock",
      },
    ],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  type: string;
  score: string;
  hint: string;
  rows: readonly SampleRow[];
}[];

export type Candidate = (typeof candidates)[number];
export type ColumnId = (typeof columns)[number]["id"];
export type Sort = { column: ColumnId; direction: "asc" | "desc" };

export function visibleRows(
  rows: readonly SampleRow[],
  query: string,
  sort?: Sort,
) {
  const needle = query.trim().toLowerCase();
  const filtered = rows.filter((row) =>
    columns.some(({ id }) => row[id].toLowerCase().includes(needle)),
  );
  if (!sort) return filtered;
  const { column, direction } = sort;
  return filtered.sort((a, b) => {
    const result =
      column === "price"
        ? Number(a.price.slice(1)) - Number(b.price.slice(1))
        : a[column].localeCompare(b[column], "en");
    return direction === "asc" ? result : -result;
  });
}
