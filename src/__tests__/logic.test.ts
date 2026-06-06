import { describe, it, expect } from "vitest";
import {
  sortRows,
  sortRowsMulti,
  toggleSortSpec,
  paginate,
  filterRows,
  filterRowsByColumn,
  compareValues,
  nextSortDirection,
  pageCount,
  clampPage,
  toCsv,
  escapeCsvValue,
  resolveRowId,
  toggleSelection,
  selectionState,
  setAllSelected,
  type SortSpec,
} from "../logic.js";

interface Person {
  name: string;
  age: number;
  active?: boolean | null;
}

const people: Person[] = [
  { name: "Charlie", age: 30 },
  { name: "alice", age: 25 },
  { name: "Bob", age: 30 },
  { name: "dave", age: 22 },
];

describe("compareValues", () => {
  it("orders numbers numerically", () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues(10, 2)).toBeGreaterThan(0);
    expect(compareValues(5, 5)).toBe(0);
  });

  it("orders strings case-insensitively", () => {
    expect(compareValues("alice", "Bob")).toBeLessThan(0);
    expect(compareValues("Bob", "alice")).toBeGreaterThan(0);
  });

  it("sinks null and undefined to the end", () => {
    expect(compareValues(null, 1)).toBeGreaterThan(0);
    expect(compareValues(undefined, "x")).toBeGreaterThan(0);
    expect(compareValues(1, null)).toBeLessThan(0);
    expect(compareValues(null, undefined)).toBe(0);
  });

  it("orders booleans false < true", () => {
    expect(compareValues(false, true)).toBeLessThan(0);
    expect(compareValues(true, false)).toBeGreaterThan(0);
  });

  it("orders Date values chronologically", () => {
    const early = new Date("2020-01-01");
    const late = new Date("2024-06-15");
    expect(compareValues(early, late)).toBeLessThan(0);
    expect(compareValues(late, early)).toBeGreaterThan(0);
    expect(compareValues(early, new Date("2020-01-01"))).toBe(0);
  });

  it("orders NaN after real numbers", () => {
    expect(compareValues(NaN, 1)).toBeGreaterThan(0);
    expect(compareValues(1, NaN)).toBeLessThan(0);
    expect(compareValues(NaN, NaN)).toBe(0);
  });
});

describe("nextSortDirection", () => {
  it("cycles none -> asc -> desc -> none", () => {
    expect(nextSortDirection("none")).toBe("asc");
    expect(nextSortDirection("asc")).toBe("desc");
    expect(nextSortDirection("desc")).toBe("none");
  });
});

describe("sortRows", () => {
  it("sorts ascending by a numeric key", () => {
    const result = sortRows(people, "age", "asc");
    expect(result.map((p) => p.age)).toEqual([22, 25, 30, 30]);
  });

  it("sorts descending by a numeric key", () => {
    const result = sortRows(people, "age", "desc");
    expect(result.map((p) => p.age)).toEqual([30, 30, 25, 22]);
  });

  it("sorts ascending by a string key case-insensitively", () => {
    const result = sortRows(people, "name", "asc");
    expect(result.map((p) => p.name)).toEqual([
      "alice",
      "Bob",
      "Charlie",
      "dave",
    ]);
  });

  it("is stable for equal keys (Charlie before Bob at age 30)", () => {
    const result = sortRows(people, "age", "asc");
    const thirties = result.filter((p) => p.age === 30).map((p) => p.name);
    expect(thirties).toEqual(["Charlie", "Bob"]);
  });

  it("returns original order for direction none", () => {
    const result = sortRows(people, "age", "none");
    expect(result.map((p) => p.name)).toEqual([
      "Charlie",
      "alice",
      "Bob",
      "dave",
    ]);
  });

  it("does not mutate the input array", () => {
    const copy = people.slice();
    sortRows(people, "age", "desc");
    expect(people).toEqual(copy);
  });
});

describe("pageCount", () => {
  it("computes the number of pages", () => {
    expect(pageCount(10, 3)).toBe(4);
    expect(pageCount(9, 3)).toBe(3);
    expect(pageCount(0, 3)).toBe(1);
  });

  it("returns 1 for non-positive size", () => {
    expect(pageCount(10, 0)).toBe(1);
  });
});

describe("clampPage", () => {
  it("clamps below 1 up to 1", () => {
    expect(clampPage(0, 10, 3)).toBe(1);
    expect(clampPage(-5, 10, 3)).toBe(1);
  });

  it("clamps above the last page down", () => {
    expect(clampPage(99, 10, 3)).toBe(4);
  });

  it("passes through valid pages", () => {
    expect(clampPage(2, 10, 3)).toBe(2);
  });
});

describe("paginate", () => {
  const nums = Array.from({ length: 10 }, (_, i) => ({ n: i + 1 }));

  it("returns the first slice", () => {
    expect(paginate(nums, 1, 3).map((r) => r.n)).toEqual([1, 2, 3]);
  });

  it("returns a middle slice", () => {
    expect(paginate(nums, 2, 3).map((r) => r.n)).toEqual([4, 5, 6]);
  });

  it("returns the partial last slice", () => {
    expect(paginate(nums, 4, 3).map((r) => r.n)).toEqual([10]);
  });

  it("clamps out-of-range pages to the nearest valid slice", () => {
    expect(paginate(nums, 99, 3).map((r) => r.n)).toEqual([10]);
    expect(paginate(nums, 0, 3).map((r) => r.n)).toEqual([1, 2, 3]);
  });
});

describe("filterRows", () => {
  it("matches case-insensitively across all columns", () => {
    const result = filterRows(people, "BOB");
    expect(result.map((p) => p.name)).toEqual(["Bob"]);
  });

  it("matches numeric cell values", () => {
    const result = filterRows(people, "30");
    expect(result.map((p) => p.name)).toEqual(["Charlie", "Bob"]);
  });

  it("returns all rows for an empty/whitespace query", () => {
    expect(filterRows(people, "")).toHaveLength(4);
    expect(filterRows(people, "   ")).toHaveLength(4);
  });

  it("returns nothing when no row matches", () => {
    expect(filterRows(people, "zzz")).toHaveLength(0);
  });

  it("ignores null and undefined cell values without throwing", () => {
    const rows = [
      { name: "x", active: null },
      { name: "y", active: undefined },
    ];
    expect(filterRows(rows, "x")).toHaveLength(1);
  });
});

describe("sortRowsMulti", () => {
  it("sorts by the primary key then breaks ties with the secondary", () => {
    const specs: SortSpec<Person>[] = [
      { key: "age", dir: "asc" },
      { key: "name", dir: "asc" },
    ];
    const result = sortRowsMulti(people, specs);
    // age asc: 22(dave), 25(alice), 30(Bob), 30(Charlie) — name asc breaks the 30 tie
    expect(result.map((p) => `${p.age}-${p.name}`)).toEqual([
      "22-dave",
      "25-alice",
      "30-Bob",
      "30-Charlie",
    ]);
  });

  it("respects per-spec direction independently", () => {
    const specs: SortSpec<Person>[] = [
      { key: "age", dir: "asc" },
      { key: "name", dir: "desc" },
    ];
    const result = sortRowsMulti(people, specs);
    expect(result.map((p) => `${p.age}-${p.name}`)).toEqual([
      "22-dave",
      "25-alice",
      "30-Charlie",
      "30-Bob",
    ]);
  });

  it("returns a shallow copy in original order for empty specs", () => {
    const result = sortRowsMulti(people, []);
    expect(result.map((p) => p.name)).toEqual([
      "Charlie",
      "alice",
      "Bob",
      "dave",
    ]);
    expect(result).not.toBe(people);
  });

  it("does not mutate the input array", () => {
    const copy = people.slice();
    sortRowsMulti(people, [{ key: "age", dir: "desc" }]);
    expect(people).toEqual(copy);
  });
});

describe("toggleSortSpec", () => {
  it("appends a new column as ascending", () => {
    const next = toggleSortSpec<Person>([], "age");
    expect(next).toEqual([{ key: "age", dir: "asc" }]);
  });

  it("flips an existing ascending column to descending", () => {
    const next = toggleSortSpec<Person>([{ key: "age", dir: "asc" }], "age");
    expect(next).toEqual([{ key: "age", dir: "desc" }]);
  });

  it("removes a descending column on the third toggle", () => {
    const next = toggleSortSpec<Person>([{ key: "age", dir: "desc" }], "age");
    expect(next).toEqual([]);
  });

  it("preserves the order of other specs", () => {
    const specs: SortSpec<Person>[] = [
      { key: "name", dir: "asc" },
      { key: "age", dir: "asc" },
    ];
    const next = toggleSortSpec(specs, "age");
    expect(next).toEqual([
      { key: "name", dir: "asc" },
      { key: "age", dir: "desc" },
    ]);
  });
});

describe("filterRowsByColumn", () => {
  it("returns all rows when no filter is active", () => {
    expect(filterRowsByColumn(people, {})).toHaveLength(4);
    expect(filterRowsByColumn(people, { name: "  " })).toHaveLength(4);
  });

  it("applies a single column filter case-insensitively", () => {
    const result = filterRowsByColumn(people, { name: "A" });
    expect(result.map((p) => p.name).sort()).toEqual(["Charlie", "alice", "dave"].sort());
  });

  it("ANDs multiple column filters together", () => {
    const result = filterRowsByColumn(people, { name: "b", age: "30" });
    expect(result.map((p) => p.name)).toEqual(["Bob"]);
  });

  it("treats null/undefined cells as non-matching", () => {
    const rows = [{ name: "x", age: null }];
    expect(filterRowsByColumn(rows, { age: "5" })).toHaveLength(0);
  });
});

describe("escapeCsvValue", () => {
  it("passes plain values through unquoted", () => {
    expect(escapeCsvValue("hello")).toBe("hello");
    expect(escapeCsvValue(42)).toBe("42");
  });

  it("returns empty string for null/undefined", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("quotes and escapes commas, quotes and newlines", () => {
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
    expect(escapeCsvValue('she said "hi"')).toBe('"she said ""hi"""');
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("serializes Date as ISO", () => {
    expect(escapeCsvValue(new Date("2021-03-04T00:00:00.000Z"))).toBe(
      "2021-03-04T00:00:00.000Z",
    );
  });
});

describe("toCsv", () => {
  const cols = [
    { key: "name" as const, header: "Name" },
    { key: "age" as const, header: "Age" },
  ];

  it("emits a header row and CRLF-joined data rows", () => {
    const csv = toCsv(people, cols);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Age");
    expect(lines[1]).toBe("Charlie,30");
    expect(lines).toHaveLength(5);
  });

  it("can omit the header and use a custom delimiter", () => {
    const csv = toCsv([{ name: "a", age: 1 }], cols, {
      includeHeader: false,
      delimiter: ";",
    });
    expect(csv).toBe("a;1");
  });

  it("escapes fields needing quoting", () => {
    const csv = toCsv([{ name: "Doe, John", age: 1 }], cols, {
      includeHeader: false,
    });
    expect(csv).toBe('"Doe, John",1');
  });
});

describe("resolveRowId", () => {
  it("uses the index when no getRowId is provided", () => {
    expect(resolveRowId({ name: "x" }, 3)).toBe("3");
  });

  it("uses getRowId when provided", () => {
    expect(resolveRowId({ name: "x" }, 0, (r) => r.name as string)).toBe("x");
  });
});

describe("toggleSelection", () => {
  it("adds an absent id", () => {
    expect([...toggleSelection(new Set(), "a")]).toEqual(["a"]);
  });

  it("removes a present id", () => {
    expect([...toggleSelection(new Set(["a", "b"]), "a")]).toEqual(["b"]);
  });

  it("returns a new set without mutating the input", () => {
    const original = new Set(["a"]);
    const next = toggleSelection(original, "b");
    expect(original.size).toBe(1);
    expect(next.size).toBe(2);
  });
});

describe("selectionState", () => {
  it("returns none for an empty visible set", () => {
    expect(selectionState(new Set(["a"]), [])).toBe("none");
  });

  it("returns none when nothing visible is selected", () => {
    expect(selectionState(new Set(["x"]), ["a", "b"])).toBe("none");
  });

  it("returns some for a partial selection", () => {
    expect(selectionState(new Set(["a"]), ["a", "b"])).toBe("some");
  });

  it("returns all when every visible id is selected", () => {
    expect(selectionState(new Set(["a", "b"]), ["a", "b"])).toBe("all");
  });
});

describe("setAllSelected", () => {
  it("selects all visible ids while preserving outside selections", () => {
    const next = setAllSelected(new Set(["z"]), ["a", "b"], true);
    expect([...next].sort()).toEqual(["a", "b", "z"]);
  });

  it("deselects only the visible ids", () => {
    const next = setAllSelected(new Set(["a", "b", "z"]), ["a", "b"], false);
    expect([...next]).toEqual(["z"]);
  });
});
