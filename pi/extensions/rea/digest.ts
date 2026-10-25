/** Compact preview of a JSON value: short strings, first items of arrays, bounded depth. */
const preview = (value: unknown, depth: number, items: number): unknown => {
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 160)}…(${value.length} chars)` : value;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    if (depth === 0) return `[${value.length} items]`;
    const head = value.slice(0, items).map((v) => preview(v, depth - 1, items));
    return value.length > items ? [...head, `…+${value.length - items} more`] : head;
  }
  const entries = Object.entries(value);
  if (depth === 0) return `{${entries.map(([k]) => k).join(",")}}`;
  // Limitation prose is long and generic; the count tells the model where to look.
  return Object.fromEntries(
    entries.map(([k, v]) => [k, k === "limitations" && Array.isArray(v) ? `[${v.length} items]` : preview(v, depth - 1, items)]),
  );
};

/** The value itself when it fits `budget` characters, otherwise the most detailed preview that does. */
export const digest = (value: unknown, budget: number) => {
  const whole = JSON.stringify(value);
  if (whole.length <= budget) return whole;
  for (const [depth, items] of [[5, 3], [4, 2], [3, 1], [2, 1], [1, 0]]) {
    const text = JSON.stringify(preview(value, depth, items));
    if (text.length <= budget) return text;
  }
  return `${JSON.stringify(preview(value, 1, 0)).slice(0, budget)}…`;
};
