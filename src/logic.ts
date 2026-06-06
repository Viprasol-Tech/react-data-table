/**
 * Pure, framework-agnostic data-table helpers.
 *
 * These functions never mutate their inputs; they always return new arrays so
 * they are safe to use directly inside React render / memo hooks.
 */

/** A row is any record keyed by string. */
export type Row = Record<string, unknown>;

/** Sort direction. `"none"` means the rows are returned in their original order. */
export type SortDirection = "asc" | "desc" | "none";

/**
 * Cycle a sort direction in the order none -> asc -> desc -> none.
 *
 * Useful for header click handlers where each click advances the state.
 */
export function nextSortDirection(current: SortDirection): SortDirection {
  switch (current) {
    case "none":
      return "asc";
    case "asc":
      return "desc";
    case "desc":
      return "none";
  }
}

/**
 * Compare two unknown values for sorting.
 *
 * Ordering rules (ascending):
 *  - `null` / `undefined` always sort last.
 *  - Numbers compare numerically.
 *  - Booleans compare as false < true.
 *  - Everything else compares via locale-aware case-insensitive string compare.
 *
 * Returns a negative number if `a` should come before `b`, positive if after,
 * and 0 if they are considered equal.
 */
export function compareValues(a: unknown, b: unknown): number {
  const aNil = a === null || a === undefined;
  const bNil = b === null || b === undefined;
  if (aNil && bNil) return 0;
  if (aNil) return 1; // nil values sink to the bottom
  if (bNil) return -1;

  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Sort rows by `key` in the given direction.
 *
 * A stable sort is guaranteed: rows that compare equal keep their relative
 * input order. When `dir` is `"none"` the original array order is preserved
 * (a shallow copy is still returned).
 */
export function sortRows<T extends Row>(
  rows: readonly T[],
  key: keyof T,
  dir: SortDirection,
): T[] {
  if (dir === "none") return rows.slice();

  // Decorate-sort-undecorate to keep the sort stable across all engines.
  const decorated = rows.map((row, index) => ({ row, index }));
  const sign = dir === "asc" ? 1 : -1;

  decorated.sort((a, b) => {
    const cmp = compareValues(a.row[key], b.row[key]);
    if (cmp !== 0) return cmp * sign;
    return a.index - b.index; // stable tiebreak
  });

  return decorated.map((d) => d.row);
}

/**
 * Total number of pages for `total` rows shown `size` per page.
 * Always at least 1 so the UI never reports "page 1 of 0".
 */
export function pageCount(total: number, size: number): number {
  if (size <= 0) return 1;
  return Math.max(1, Math.ceil(total / size));
}

/**
 * Clamp a 1-based page number into the valid range [1, pageCount].
 */
export function clampPage(page: number, total: number, size: number): number {
  const last = pageCount(total, size);
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.floor(page)), last);
}

/**
 * Return the slice of rows for a single (1-based) page.
 *
 * The `page` argument is clamped into range, so out-of-bounds pages return the
 * nearest valid slice rather than throwing or returning an empty array.
 */
export function paginate<T extends Row>(
  rows: readonly T[],
  page: number,
  size: number,
): T[] {
  if (size <= 0) return rows.slice();
  const safePage = clampPage(page, rows.length, size);
  const start = (safePage - 1) * size;
  return rows.slice(start, start + size);
}

/**
 * Case-insensitive text filter across all string-coercible cell values.
 *
 * A row matches when any of its values, stringified, contains `query` (after
 * trimming and lower-casing both sides). An empty / whitespace query returns
 * every row.
 */
export function filterRows<T extends Row>(
  rows: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return rows.slice();

  return rows.filter((row) =>
    Object.values(row).some((value) => {
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(needle);
    }),
  );
}
