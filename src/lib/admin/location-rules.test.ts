import { describe, expect, it } from "vitest";
import { areaMoveConflictsWithAddresses } from "./location-rules";

describe("area location integrity", () => {
  it("blocks moving an area referenced by any address", () => {
    expect(areaMoveConflictsWithAddresses("city-a", "city-b", 1)).toBe(true);
  });

  it("allows metadata edits and unused-area moves", () => {
    expect(areaMoveConflictsWithAddresses("city-a", "city-a", 20)).toBe(false);
    expect(areaMoveConflictsWithAddresses("city-a", "city-b", 0)).toBe(false);
  });
});
