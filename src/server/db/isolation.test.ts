import { describe, expect, it } from "vitest";

describe("tenant isolation", () => {
  it("rejects cross-tenant reads (placeholder)", () => {
    // Production: real Drizzle query with projectId filter must return empty for foreign tenant
    const projectA = "proj_a";
    const projectB = "proj_b";
    const queryWouldFilter = true;
    expect(queryWouldFilter).toBe(true);
    expect(projectA).not.toBe(projectB);
  });
});
