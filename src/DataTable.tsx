import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  filterRows,
  filterRowsByColumn,
  pageCount,
  paginate,
  resolveRowId,
  selectionState,
  setAllSelected,
  sortRowsMulti,
  toCsv,
  toggleSelection,
  toggleSortSpec,
  type ColumnFilters,
  type Row,
  type SortDirection,
  type SortSpec,
} from "./logic.js";

/** Definition of a single table column. */
export interface Column<T extends Row> {
  /** Property key on the row this column reads from. */
  key: keyof T & string;
  /** Header label. Falls back to `key` when omitted. */
  header?: string;
  /** Whether the column is sortable. Defaults to `true`. */
  sortable?: boolean;
  /** Whether the column has its own filter input. Defaults to `false`. */
  filterable?: boolean;
  /** Placeholder for this column's filter input. */
  filterPlaceholder?: string;
  /** Hide the column initially. Toggleable via the column-visibility menu. */
  hidden?: boolean;
  /** Custom cell renderer. Defaults to stringifying the value. */
  render?: (value: T[keyof T], row: T, rowIndex: number) => ReactNode;
  /** Custom CSV serializer. Defaults to the raw cell value. */
  toCsv?: (value: T[keyof T], row: T) => string;
}

/** State emitted to the server-mode `onStateChange` callback. */
export interface TableState<T extends Row> {
  /** Active multi-column sort, primary key first. */
  sort: ReadonlyArray<SortSpec<T>>;
  /** Global text filter query. */
  query: string;
  /** Per-column filter queries. */
  columnFilters: ColumnFilters<T>;
  /** Current 1-based page. */
  page: number;
  /** Rows per page. */
  pageSize: number;
}

/** Props for {@link DataTable}. */
export interface DataTableProps<T extends Row> {
  /** Column definitions, in display order. */
  columns: ReadonlyArray<Column<T>>;
  /** Row data. In server mode this is just the current page's rows. */
  rows: readonly T[];
  /** Rows shown per page. Defaults to 10. */
  pageSize?: number;
  /** Options offered in the page-size selector. Set to `[]` to hide it. */
  pageSizeOptions?: readonly number[];
  /** Show the global text filter input. Defaults to `true`. */
  filterable?: boolean;
  /** Placeholder for the global filter input. */
  filterPlaceholder?: string;
  /** Show the column-visibility toggle menu. Defaults to `false`. */
  columnToggle?: boolean;
  /** Show a "Export CSV" button. Defaults to `false`. */
  exportable?: boolean;
  /** File name used by the CSV export. Defaults to "table.csv". */
  exportFileName?: string;
  /** Enable per-row selection checkboxes. Defaults to `false`. */
  selectable?: boolean;
  /** Stable id for a row. Defaults to the row's index. */
  getRowId?: (row: T, index: number) => string;
  /** Controlled set of selected row ids. */
  selectedIds?: ReadonlySet<string>;
  /** Called with the next selection whenever it changes. */
  onSelectionChange?: (ids: Set<string>) => void;
  /**
   * Server mode. When `true`, the component does NOT filter, sort or paginate
   * `rows` itself; it renders them as-is and instead reports state changes via
   * {@link onStateChange} so the host can fetch the right slice.
   */
  serverMode?: boolean;
  /** Total row count, required in server mode to compute the page count. */
  totalRows?: number;
  /** Called whenever sort / filter / page / page-size changes. */
  onStateChange?: (state: TableState<T>) => void;
  /** Renders an in-table loading indicator (server mode). */
  loading?: boolean;
  /** Message shown when no rows match. Defaults to "No data". */
  emptyMessage?: ReactNode;
  /** Optional className applied to the wrapping element. */
  className?: string;
}

function sortIndicator(dir: SortDirection, order?: number): string {
  const arrow = dir === "asc" ? " ▲" : dir === "desc" ? " ▼" : "";
  if (arrow === "" || order === undefined) return arrow;
  return `${arrow}${order}`; // e.g. " ▲1" to show multi-sort priority
}

/** Trigger a client-side download of `text` as a file. */
function downloadCsv(fileName: string, text: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * A sortable, paginated, filterable data table.
 *
 * In the default (client) mode all data transforms run through the pure helpers
 * in `logic.ts`, applied in the order: global filter -> column filters -> sort
 * -> paginate. Set `serverMode` to delegate those transforms to the host via
 * `onStateChange`, in which case `rows` is rendered verbatim.
 */
export function DataTable<T extends Row>({
  columns,
  rows,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  filterable = true,
  filterPlaceholder = "Filter...",
  columnToggle = false,
  exportable = false,
  exportFileName = "table.csv",
  selectable = false,
  getRowId,
  selectedIds,
  onSelectionChange,
  serverMode = false,
  totalRows,
  onStateChange,
  loading = false,
  emptyMessage = "No data",
  className,
}: DataTableProps<T>) {
  const [sortSpecs, setSortSpecs] = useState<SortSpec<T>[]>([]);
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters<T>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Column visibility, seeded from each column's `hidden` flag.
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.hidden).map((c) => c.key)),
  );

  // Uncontrolled selection fallback.
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    () => new Set(),
  );
  const selected = selectedIds ?? internalSelected;

  const applySelection = useCallback(
    (next: Set<string>) => {
      if (selectedIds === undefined) setInternalSelected(next);
      onSelectionChange?.(next);
    },
    [selectedIds, onSelectionChange],
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden],
  );

  // --- Data pipeline (client mode only) -----------------------------------
  const processed = useMemo(() => {
    if (serverMode) return rows.slice();
    const globallyFiltered = filterRows(rows, query);
    const columnFiltered = filterRowsByColumn(globallyFiltered, columnFilters);
    return sortRowsMulti(columnFiltered, sortSpecs);
  }, [serverMode, rows, query, columnFilters, sortSpecs]);

  const total = serverMode ? (totalRows ?? rows.length) : processed.length;
  const pages = pageCount(total, pageSize);
  const safePage = Math.min(page, pages);

  const pageRows = useMemo(() => {
    if (serverMode) return rows.slice();
    return paginate(processed, safePage, pageSize);
  }, [serverMode, rows, processed, safePage, pageSize]);

  // --- Server-mode state reporting ----------------------------------------
  const notify = onStateChange;
  const stateSignature = useMemo(
    () => ({
      sort: sortSpecs,
      query,
      columnFilters,
      page: safePage,
      pageSize,
    }),
    [sortSpecs, query, columnFilters, safePage, pageSize],
  );
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    notify?.(stateSignature);
  }, [notify, stateSignature]);

  // --- Selection ----------------------------------------------------------
  const visibleIds = useMemo(
    () => pageRows.map((row, i) => resolveRowId(row, i, getRowId)),
    [pageRows, getRowId],
  );
  const headerSelection = selectionState(selected, visibleIds);
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = headerSelection === "some";
    }
  }, [headerSelection, visibleIds]);

  // --- Handlers -----------------------------------------------------------
  function handleSort(col: Column<T>) {
    if (col.sortable === false) return;
    setSortSpecs((prev) => toggleSortSpec(prev, col.key));
    setPage(1);
  }

  function handleQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleColumnFilter(key: keyof T & string, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handlePageSize(e: ChangeEvent<HTMLSelectElement>) {
    setPageSize(Number(e.target.value));
    setPage(1);
  }

  function goTo(target: number) {
    setPage(Math.min(Math.max(1, target), pages));
  }

  function toggleColumn(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExport() {
    const source = serverMode ? rows : processed;
    const csv = toCsv(
      source,
      visibleColumns.map((c) => ({ key: c.key, header: c.header ?? c.key })),
    );
    downloadCsv(exportFileName, csv);
  }

  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const hasColumnFilters = columns.some((c) => c.filterable);
  const showToolbar = filterable || exportable || columnToggle;

  return (
    <div className={className} data-testid="data-table">
      {showToolbar && (
        <div className="rdt-toolbar">
          {filterable && (
            <input
              type="text"
              value={query}
              placeholder={filterPlaceholder}
              aria-label="Filter rows"
              onChange={(e) => handleQuery(e.target.value)}
              data-testid="data-table-filter"
            />
          )}
          {columnToggle && (
            <details className="rdt-column-toggle" data-testid="column-toggle">
              <summary>Columns</summary>
              <ul role="menu">
                {columns.map((col) => (
                  <li key={col.key} role="menuitemcheckbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={!hidden.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        data-testid={`column-toggle-${col.key}`}
                      />
                      {col.header ?? col.key}
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {exportable && (
            <button
              type="button"
              className="rdt-export"
              onClick={handleExport}
              data-testid="data-table-export"
            >
              Export CSV
            </button>
          )}
        </div>
      )}

      <table className="rdt-table">
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="rdt-select-cell">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={headerSelection === "all"}
                  onChange={(e) =>
                    applySelection(
                      setAllSelected(selected, visibleIds, e.target.checked),
                    )
                  }
                  data-testid="select-all"
                />
              </th>
            )}
            {visibleColumns.map((col) => {
              const spec = sortSpecs.find((s) => s.key === col.key);
              const dir: SortDirection = spec ? spec.dir : "none";
              const order =
                spec && sortSpecs.length > 1
                  ? sortSpecs.indexOf(spec) + 1
                  : undefined;
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
                      {sortIndicator(dir, order)}
                    </button>
                  ) : (
                    <span>{col.header ?? col.key}</span>
                  )}
                </th>
              );
            })}
          </tr>
          {hasColumnFilters && (
            <tr className="rdt-filter-row">
              {selectable && <th aria-hidden="true" />}
              {visibleColumns.map((col) => (
                <th key={col.key}>
                  {col.filterable ? (
                    <input
                      type="text"
                      value={columnFilters[col.key] ?? ""}
                      placeholder={col.filterPlaceholder ?? "Filter"}
                      aria-label={`Filter by ${col.header ?? col.key}`}
                      onChange={(e) =>
                        handleColumnFilter(col.key, e.target.value)
                      }
                      data-testid={`column-filter-${col.key}`}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan} data-testid="data-table-loading">
                Loading...
              </td>
            </tr>
          ) : pageRows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} data-testid="data-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            pageRows.map((row, rowIndex) => {
              const id = resolveRowId(row, rowIndex, getRowId);
              const isSelected = selected.has(id);
              return (
                <tr
                  key={id}
                  data-testid="data-table-row"
                  aria-selected={selectable ? isSelected : undefined}
                  className={isSelected ? "rdt-row-selected" : undefined}
                >
                  {selectable && (
                    <td className="rdt-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${rowIndex + 1}`}
                        checked={isSelected}
                        onChange={() =>
                          applySelection(toggleSelection(selected, id))
                        }
                        data-testid={`select-row-${id}`}
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => {
                    const value = row[col.key];
                    return (
                      <td key={col.key}>
                        {col.render
                          ? col.render(value, row, rowIndex)
                          : value === null || value === undefined
                            ? ""
                            : String(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
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
        {pageSizeOptions.length > 0 && (
          <select
            value={pageSize}
            aria-label="Rows per page"
            onChange={handlePageSize}
            data-testid="data-table-page-size"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </select>
        )}
        {selectable && (
          <span data-testid="data-table-selected-count">
            {selected.size} selected
          </span>
        )}
      </div>
    </div>
  );
}
