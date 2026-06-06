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
 * A single entry in a multi-column sort. Columns are applied in array order:
 * the first entry is the primary sort key, the next is the tiebreaker, etc.
 */
export interface SortSpec<T extends Row> {
  key: keyof T & string;
  dir: Exclude<SortDirection, "none">;
}

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
 *  - `Date` values compare chronologically.
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

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
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
 * Sort rows by multiple columns at once.
 *
 * The `specs` array is applied in order: the first spec is the primary key, the
 * next breaks ties, and so on. An empty `specs` array returns a shallow copy in
 * original order. The sort is stable across equal-on-all-keys rows.
 */
export function sortRowsMulti<T extends Row>(
  rows: readonly T[],
  specs: ReadonlyArray<SortSpec<T>>,
): T[] {
  if (specs.length === 0) return rows.slice();

  const decorated = rows.map((row, index) => ({ row, index }));

  decorated.sort((a, b) => {
    for (const { key, dir } of specs) {
      const cmp = compareValues(a.row[key], b.row[key]);
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return a.index - b.index; // stable tiebreak
  });

  return decorated.map((d) => d.row);
}

/**
 * Toggle a column into / out of a multi-sort spec list.
 *
 * - If the column is not present, it is appended as ascending.
 * - If present and ascending, it flips to descending.
 * - If present and descending, it is removed entirely.
 *
 * The relative order of the other specs is preserved, so callers get an
 * Excel-like multi-sort experience when handling header clicks.
 */
export function toggleSortSpec<T extends Row>(
  specs: ReadonlyArray<SortSpec<T>>,
  key: keyof T & string,
): SortSpec<T>[] {
  const existing = specs.find((s) => s.key === key);
  if (!existing) return [...specs, { key, dir: "asc" }];
  if (existing.dir === "asc") {
    return specs.map((s) => (s.key === key ? { key, dir: "desc" } : s));
  }
  return specs.filter((s) => s.key !== key);
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

/**
 * A map of column key -> per-column filter query. Keys not present (or with
 * empty / whitespace values) impose no constraint.
 */
export type ColumnFilters<T extends Row> = Partial<Record<keyof T & string, string>>;

/**
 * Filter rows so that every non-empty per-column query is satisfied (AND logic).
 *
 * Each column query is a case-insensitive substring match against that column's
 * stringified value. Null / undefined cells never match a non-empty query.
 */
export function filterRowsByColumn<T extends Row>(
  rows: readonly T[],
  filters: ColumnFilters<T>,
): T[] {
  const active = Object.entries(filters)
    .map(([key, value]) => [key, String(value ?? "").trim().toLowerCase()] as const)
    .filter(([, needle]) => needle !== "");

  if (active.length === 0) return rows.slice();

  return rows.filter((row) =>
    active.every(([key, needle]) => {
      const value = row[key as keyof T];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(needle);
    }),
  );
}

/**
 * Escape a single value for inclusion in a CSV field per RFC 4180.
 *
 * Fields containing a comma, double-quote, CR or LF are wrapped in double
 * quotes and any embedded quotes are doubled. Null / undefined become "".
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Options controlling CSV generation. */
export interface CsvOptions {
  /** Field delimiter. Defaults to ",". */
  delimiter?: string;
  /** Whether to emit a header row. Defaults to `true`. */
  includeHeader?: boolean;
}

/**
 * Serialize rows to an RFC-4180 CSV string.
 *
 * `columns` controls which keys are exported, their order, and their header
 * labels. Rows are emitted in the order given. Lines are joined with CRLF.
 */
export function toCsv<T extends Row>(
  rows: readonly T[],
  columns: ReadonlyArray<{ key: keyof T & string; header?: string }>,
  options: CsvOptions = {},
): string {
  const { delimiter = ",", includeHeader = true } = options;
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(
      columns.map((c) => escapeCsvValue(c.header ?? c.key)).join(delimiter),
    );
  }

  for (const row of rows) {
    lines.push(
      columns.map((c) => escapeCsvValue(row[c.key])).join(delimiter),
    );
  }

  return lines.join("\r\n");
}

/**
 * Resolve a stable identity for a row, used by selection logic.
 *
 * When `getRowId` is provided it is used; otherwise the row's positional index
 * (stringified) is returned. Centralizing this keeps selection helpers and the
 * component in agreement about row identity.
 */
export function resolveRowId<T extends Row>(
  row: T,
  index: number,
  getRowId?: (row: T, index: number) => string,
): string {
  return getRowId ? getRowId(row, index) : String(index);
}

/**
 * Toggle a single id within a selection set, returning a new set.
 */
export function toggleSelection(
  selected: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Compute the "select all" state for a set of visible ids.
 *
 * Returns `"all"` when every visible id is selected (and there is at least one),
 * `"none"` when none are, and `"some"` for a partial selection. The `"some"`
 * state maps directly onto a checkbox's `indeterminate` property.
 */
export function selectionState(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
): "all" | "some" | "none" {
  if (visibleIds.length === 0) return "none";
  let count = 0;
  for (const id of visibleIds) {
    if (selected.has(id)) count++;
  }
  if (count === 0) return "none";
  return count === visibleIds.length ? "all" : "some";
}

/**
 * Select or deselect every id in `visibleIds` at once, preserving any
 * selections outside the visible set.
 */
export function setAllSelected(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
  value: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const id of visibleIds) {
    if (value) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  return next;
}
