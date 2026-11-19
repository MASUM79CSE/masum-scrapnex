export const ContentSignal = {
  text: 1,
  heading: 2,
  link: 4,
  image: 8,
} as const;
export interface Shape {
  root: string;
  tokens: ReadonlyMap<string, number>;
}

/** Multiset Jaccard; structural counts matter, DOM classes and raw text do not. */
export function similarity(a: Shape, b: Shape): number {
  if (a.root !== b.root) return 0;
  let intersection = 0;
  let union = 0;
  for (const [key, count] of a.tokens) {
    const other = b.tokens.get(key) ?? 0;
    intersection += Math.min(count, other);
    union += Math.max(count, other);
  }
  for (const [key, count] of b.tokens) if (!a.tokens.has(key)) union += count;
  return union ? intersection / union : 1;
}

export function alignedFieldCoverage(masks: readonly number[]): number {
  if (!masks.length) return 0;
  const fields = Object.values(ContentSignal).map(
    (bit) => masks.filter((mask) => (mask & bit) !== 0).length / masks.length,
  );
  // Only recurring signals count; breadth saturates at three categories.
  return Math.min(
    1,
    fields.filter((rate) => rate >= 0.65).reduce((sum, rate) => sum + rate, 0) /
      3,
  );
}

export function structureScore(signals: {
  similarity: number;
  alignment: number;
  content: number;
  count: number;
  visibility: number;
  penalty: number;
}): number {
  const repetition = Math.min(
    1,
    Math.log2(Math.max(1, signals.count)) / Math.log2(12),
  );
  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        30 * signals.similarity +
          25 * signals.alignment +
          20 * signals.content +
          15 * repetition +
          10 * signals.visibility -
          signals.penalty,
      ),
    ),
  );
}
