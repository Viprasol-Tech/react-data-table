# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/); versioning
follows [SemVer](https://semver.org/).

## [0.2.0] - 2025

### Added
- **Multi-column sort** — click multiple headers to build an Excel-style sort
  chain with visible priority badges. New helpers `sortRowsMulti` and
  `toggleSortSpec`, plus the `SortSpec` type.
- **Per-column filters** — opt columns into their own filter input via
  `filterable` on the column. New helper `filterRowsByColumn` and the
  `ColumnFilters` type. Combined with the global filter using AND logic.
- **Row selection** — checkbox column with header select-all (tri-state /
  indeterminate), controlled (`selectedIds` + `onSelectionChange`) and
  uncontrolled modes, stable identity via `getRowId`. New helpers
  `toggleSelection`, `selectionState`, `setAllSelected`, `resolveRowId`.
- **Column visibility** — a `columnToggle` menu to show/hide columns at runtime,
  seeded by the per-column `hidden` flag.
- **CSV export** — an `exportable` toolbar button plus the pure `toCsv` /
  `escapeCsvValue` helpers (RFC 4180 quoting, custom delimiter, optional header).
- **Server-mode hooks** — `serverMode`, `totalRows`, `onStateChange`, `loading`
  for delegating sort/filter/pagination to a backend. New `TableState` type.
- **Page-size selector** with configurable `pageSizeOptions`.
- `Date` and `NaN` ordering rules in `compareValues`.
- Custom `render(value, row, rowIndex)` cell renderers and per-column `toCsv`.

### Changed
- Sort state is now a list of `SortSpec` entries rather than a single column.
- `aria-sort` and row `aria-selected` accessibility attributes added/expanded.

### Tests
- Test suite roughly doubled (now 76 tests) covering all new logic helpers and
  component interactions (selection, export, server mode, column toggle).

## [0.1.0] - 2025

### Added
- Initial release of react-data-table: Sortable, paginated, filterable data table component for React.
