import { describe, expect, it } from "vitest";
import { cutoffDate, describeCleanup } from "./retention";

describe("retention", () => {
  it("computes cutoff in the past", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    const cutoff = cutoffDate(90, now);
    expect(cutoff.startsWith("2026-07-")).toBe(true);
  });

  it("describes all three policies", () => {
    const desc = describeCleanup();
    expect(desc.rawEventsBefore).toBeTruthy();
    expect(desc.aggregatesBefore).toBeTruthy();
    expect(desc.identitiesBefore).toBeTruthy();
  });
});
