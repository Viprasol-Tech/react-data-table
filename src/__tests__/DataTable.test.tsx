import { describe, it, expect } from "vitest";
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
});
