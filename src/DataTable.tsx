import { useMemo, useState, type ReactNode } from "react";
import {
  filterRows,
  nextSortDirection,
  pageCount,
  paginate,
  sortRows,
  type Row,
  type SortDirection,
} from "./logic.js";

/** Definition of a single table column. */
export interface Column<T extends Row> {
  /** Property key on the row this column reads from. */
  key: keyof T & string;
  /** Header label. Falls back to `key` when omitted. */
  header?: string;
  /** Whether the column is sortable. Defaults to `true`. */
  sortable?: boolean;
  /** Custom cell renderer. Defaults to stringifying the value. */
  render?: (value: T[keyof T], row: T) => ReactNode;
}

/** Props for {@link DataTable}. */
export interface DataTableProps<T extends Row> {
  /** Column definitions, in display order. */
  columns: ReadonlyArray<Column<T>>;
  /** Row data. */
  rows: readonly T[];
  /** Rows shown per page. Defaults to 10. */
  pageSize?: number;
  /** Show the text filter input. Defaults to `true`. */
  filterable?: boolean;
  /** Placeholder for the filter input. */
  filterPlaceholder?: string;
  /** Message shown when no rows match. Defaults to "No data". */
  emptyMessage?: ReactNode;
  /** Optional className applied to the wrapping element. */
  className?: string;
}

interface SortState<T extends Row> {
  key: (keyof T & string) | null;
  dir: SortDirection;
}

function sortIndicator(dir: SortDirection): string {
  if (dir === "asc") return " ▲"; // up triangle
  if (dir === "desc") return " ▼"; // down triangle
  return "";
}

/**
 * A sortable, paginated, filterable data table.
 *
 * All data transforms run through the pure helpers in `logic.ts`, applied in
 * the order: filter -> sort -> paginate. State (current page, sort column and
 * direction, filter query) is managed internally.
 */
export function DataTable<T extends Row>({
  columns,
  rows,
  pageSize = 10,
  filterable = true,
  filterPlaceholder = "Filter...",
  emptyMessage = "No data",
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState<T>>({ key: null, dir: "none" });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => filterRows(rows, query), [rows, query]);

  const sorted = useMemo(() => {
    if (sort.key === null || sort.dir === "none") return filtered;
    return sortRows(filtered, sort.key, sort.dir);
  }, [filtered, sort.key, sort.dir]);

  const total = sorted.length;
  const pages = pageCount(total, pageSize);
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(
    () => paginate(sorted, safePage, pageSize),
    [sorted, safePage, pageSize],
  );

  function handleSort(col: Column<T>) {
    if (col.sortable === false) return;
    setSort((prev) => {
      const dir =
        prev.key === col.key ? nextSortDirection(prev.dir) : "asc";
      return { key: dir === "none" ? null : col.key, dir };
    });
    setPage(1);
  }

  function handleQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function goTo(target: number) {
    setPage(Math.min(Math.max(1, target), pages));
  }

  return (
    <div className={className} data-testid="data-table">
      {filterable && (
        <div className="rdt-toolbar">
          <input
            type="text"
            value={query}
            placeholder={filterPlaceholder}
            aria-label="Filter rows"
            onChange={(e) => handleQuery(e.target.value)}
            data-testid="data-table-filter"
          />
        </div>
      )}

      <table className="rdt-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const isActive = sort.key === col.key;
              const dir = isActive ? sort.dir : "none";
              const sortable = col.sortable !== false;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    !sortable || dir === "none"
                      ? "none"
                      : dir === "asc"
                        ? "ascending"
                        : "descending"
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="rdt-sort-button"
                      onClick={() => handleSort(col)}
                      data-testid={`sort-${col.key}`}
                    >
                      {col.header ?? col.key}
                      {sortIndicator(dir)}
                    </button>
                  ) : (
                    <span>{col.header ?? col.key}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} data-testid="data-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            pageRows.map((row, rowIndex) => (
              <tr key={rowIndex} data-testid="data-table-row">
                {columns.map((col) => {
                  const value = row[col.key];
                  return (
                    <td key={col.key}>
                      {col.render
                        ? col.render(value, row)
                        : value === null || value === undefined
                          ? ""
                          : String(value)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="rdt-pagination">
        <button
          type="button"
          onClick={() => goTo(safePage - 1)}
          disabled={safePage <= 1}
          data-testid="data-table-prev"
        >
          Prev
        </button>
        <span data-testid="data-table-page-info">
          Page {safePage} of {pages}
        </span>
        <button
          type="button"
          onClick={() => goTo(safePage + 1)}
          disabled={safePage >= pages}
          data-testid="data-table-next"
        >
          Next
        </button>
      </div>
    </div>
  );
}
