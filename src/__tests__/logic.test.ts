import { describe, it, expect } from "vitest";
import {
  sortRows,
  paginate,
  filterRows,
  compareValues,
  nextSortDirection,
  pageCount,
  clampPage,
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
