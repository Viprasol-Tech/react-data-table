import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataTable, type Column } from "../DataTable.js";

interface Person {
  name: string;
  age: number;
}

const columns: Column<Person>[] = [
  { key: "name", header: "Name" },
  { key: "age", header: "Age" },
];

const rows: Person[] = [
  { name: "Charlie", age: 30 },
  { name: "alice", age: 25 },
  { name: "Bob", age: 40 },
];

function cellTexts(): string[][] {
  return screen
    .getAllByTestId("data-table-row")
    .map((tr) => within(tr).getAllByRole("cell").map((td) => td.textContent ?? ""));
}

describe("<DataTable />", () => {
  it("renders headers and all rows when they fit on one page", () => {
    render(<DataTable columns={columns} rows={rows} pageSize={10} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getAllByTestId("data-table-row")).toHaveLength(3);
  });

  it("sorts ascending then descending when a header is clicked", () => {
    render(<DataTable columns={columns} rows={rows} pageSize={10} />);

    // First click on Name -> ascending (case-insensitive): alice, Bob, Charlie
    fireEvent.click(screen.getByTestId("sort-name"));
    expect(cellTexts().map((c) => c[0])).toEqual(["alice", "Bob", "Charlie"]);

    // Second click -> descending: Charlie, Bob, alice
    fireEvent.click(screen.getByTestId("sort-name"));
    expect(cellTexts().map((c) => c[0])).toEqual(["Charlie", "Bob", "alice"]);
  });

  it("advances to the next slice when paging", () => {
    render(<DataTable columns={columns} rows={rows} pageSize={2} filterable={false} />);

    // Page 1 shows the first two rows in original order.
    expect(cellTexts().map((c) => c[0])).toEqual(["Charlie", "alice"]);
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent(
      "Page 1 of 2",
    );

    fireEvent.click(screen.getByTestId("data-table-next"));

    // Page 2 shows the remaining row.
    expect(cellTexts().map((c) => c[0])).toEqual(["Bob"]);
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent(
      "Page 2 of 2",
    );
  });

  it("filters rows by the text input", () => {
    render(<DataTable columns={columns} rows={rows} pageSize={10} />);
    fireEvent.change(screen.getByTestId("data-table-filter"), {
      target: { value: "bob" },
    });
    const visible = cellTexts();
    expect(visible).toHaveLength(1);
    expect(visible[0][0]).toBe("Bob");
  });

  it("shows the empty message when no rows match", () => {
    render(<DataTable columns={columns} rows={rows} emptyMessage="Nothing here" />);
    fireEvent.change(screen.getByTestId("data-table-filter"), {
      target: { value: "zzz" },
    });
    expect(screen.getByTestId("data-table-empty")).toHaveTextContent(
      "Nothing here",
    );
  });

  it("uses a custom cell renderer", () => {
    const cols: Column<Person>[] = [
      { key: "name", header: "Name" },
      {
        key: "age",
        header: "Age",
        render: (value) => <strong>age:{String(value)}</strong>,
      },
    ];
    render(<DataTable columns={cols} rows={rows.slice(0, 1)} />);
    expect(screen.getByText("age:30")).toBeInTheDocument();
  });

  it("supports multi-column sort with priority indicators", () => {
    const data: Person[] = [
      { name: "Bob", age: 30 },
      { name: "Ann", age: 30 },
      { name: "Cy", age: 20 },
    ];
    render(<DataTable columns={columns} rows={data} pageSize={10} />);

    // Primary: age asc. Secondary: name asc.
    fireEvent.click(screen.getByTestId("sort-age"));
    fireEvent.click(screen.getByTestId("sort-name"));

    expect(cellTexts().map((c) => c[0])).toEqual(["Cy", "Ann", "Bob"]);
    // Both columns show a numeric priority badge.
    expect(screen.getByTestId("sort-age")).toHaveTextContent("1");
    expect(screen.getByTestId("sort-name")).toHaveTextContent("2");
  });

  it("filters by a per-column filter input", () => {
    const cols: Column<Person>[] = [
      { key: "name", header: "Name", filterable: true },
      { key: "age", header: "Age" },
    ];
    render(<DataTable columns={cols} rows={rows} filterable={false} />);
    fireEvent.change(screen.getByTestId("column-filter-name"), {
      target: { value: "ar" },
    });
    const visible = cellTexts();
    expect(visible).toHaveLength(1);
    expect(visible[0][0]).toBe("Charlie");
  });

  it("toggles column visibility", () => {
    render(<DataTable columns={columns} rows={rows} columnToggle />);
    expect(screen.getByRole("columnheader", { name: /Age/ })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("column-toggle-age"));
    expect(
      screen.queryByRole("columnheader", { name: /Age/ }),
    ).not.toBeInTheDocument();
    // Each remaining row now has a single cell.
    expect(within(screen.getAllByTestId("data-table-row")[0]).getAllByRole("cell")).toHaveLength(1);
  });

  it("hides a column flagged hidden by default", () => {
    const cols: Column<Person>[] = [
      { key: "name", header: "Name" },
      { key: "age", header: "Age", hidden: true },
    ];
    render(<DataTable columns={cols} rows={rows} columnToggle />);
    expect(
      screen.queryByRole("columnheader", { name: /Age/ }),
    ).not.toBeInTheDocument();
    // The toggle menu still lists it, unchecked.
    const toggle = screen.getByTestId("column-toggle-age") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it("changes page size via the selector", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        pageSize={2}
        pageSizeOptions={[2, 5]}
        filterable={false}
      />,
    );
    expect(screen.getAllByTestId("data-table-row")).toHaveLength(2);
    fireEvent.change(screen.getByTestId("data-table-page-size"), {
      target: { value: "5" },
    });
    expect(screen.getAllByTestId("data-table-row")).toHaveLength(3);
  });

  describe("selection", () => {
    it("toggles a single row and reports the count", () => {
      render(
        <DataTable
          columns={columns}
          rows={rows}
          selectable
          getRowId={(r) => r.name}
        />,
      );
      fireEvent.click(screen.getByTestId("select-row-Bob"));
      expect(screen.getByTestId("data-table-selected-count")).toHaveTextContent(
        "1 selected",
      );
    });

    it("select-all checks every visible row", () => {
      render(
        <DataTable
          columns={columns}
          rows={rows}
          selectable
          getRowId={(r) => r.name}
        />,
      );
      fireEvent.click(screen.getByTestId("select-all"));
      expect(screen.getByTestId("data-table-selected-count")).toHaveTextContent(
        "3 selected",
      );
      const selectAll = screen.getByTestId("select-all") as HTMLInputElement;
      expect(selectAll.checked).toBe(true);
    });

    it("invokes onSelectionChange for controlled selection", () => {
      const onChange = vi.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          selectable
          getRowId={(r) => r.name}
          selectedIds={new Set()}
          onSelectionChange={onChange}
        />,
      );
      fireEvent.click(screen.getByTestId("select-row-alice"));
      expect(onChange).toHaveBeenCalledTimes(1);
      const arg = onChange.mock.calls[0][0] as Set<string>;
      expect([...arg]).toEqual(["alice"]);
    });
  });

  describe("export", () => {
    it("renders an export button when exportable", () => {
      render(<DataTable columns={columns} rows={rows} exportable />);
      expect(screen.getByTestId("data-table-export")).toBeInTheDocument();
    });

    it("triggers a CSV download on click", () => {
      const createObjectURL = vi.fn(() => "blob:mock");
      const revokeObjectURL = vi.fn();
      // jsdom does not implement these.
      (URL as unknown as { createObjectURL: unknown }).createObjectURL =
        createObjectURL;
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL =
        revokeObjectURL;
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      render(<DataTable columns={columns} rows={rows} exportable />);
      fireEvent.click(screen.getByTestId("data-table-export"));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      clickSpy.mockRestore();
    });
  });

  describe("server mode", () => {
    it("renders rows verbatim without client-side filtering", () => {
      render(
        <DataTable
          columns={columns}
          rows={rows}
          serverMode
          totalRows={50}
          pageSize={3}
        />,
      );
      // Filtering should not drop rows in server mode.
      fireEvent.change(screen.getByTestId("data-table-filter"), {
        target: { value: "zzz" },
      });
      expect(screen.getAllByTestId("data-table-row")).toHaveLength(3);
      // Page count is derived from totalRows.
      expect(screen.getByTestId("data-table-page-info")).toHaveTextContent(
        "Page 1 of 17",
      );
    });

    it("reports state changes to onStateChange", () => {
      const onState = vi.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          serverMode
          totalRows={50}
          onStateChange={onState}
        />,
      );
      fireEvent.click(screen.getByTestId("sort-name"));
      expect(onState).toHaveBeenCalled();
      const state = onState.mock.calls.at(-1)?.[0];
      expect(state.sort).toEqual([{ key: "name", dir: "asc" }]);
    });

    it("shows a loading row when loading", () => {
      render(
        <DataTable
          columns={columns}
          rows={[]}
          serverMode
          totalRows={0}
          loading
        />,
      );
      expect(screen.getByTestId("data-table-loading")).toBeInTheDocument();
    });
  });
});
