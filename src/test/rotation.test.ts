import { describe, expect, it } from "vitest";
import { getRotatingVjPicks, listVjs, rotationSeed } from "@/lib/luganda-movies";

describe("homepage rotation", () => {
  it("same seed gives the same picks, a new window gives different picks", () => {
    const vj = listVjs()[0]!.name;
    const a = getRotatingVjPicks(vj, 12, 100).map((m) => m.title);
    expect(getRotatingVjPicks(vj, 12, 100).map((m) => m.title)).toEqual(a);
    expect(getRotatingVjPicks(vj, 12, 101).map((m) => m.title)).not.toEqual(a);
  });
  it("seed changes every 3 hours", () => {
    expect(rotationSeed(0)).toBe(rotationSeed(3 * 3_600_000 - 1));
    expect(rotationSeed(3 * 3_600_000)).toBe(rotationSeed(0) + 1);
  });
});
