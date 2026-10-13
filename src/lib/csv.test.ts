import { describe, expect, it } from "vitest";
import { toCSV, parseCSV } from "./csv";

describe("CSV utilities", () => {
  it("round-trips simple rows", () => {
    const rows = [
      { id: "1", name: "Visit", visitors: 18420 },
      { id: "2", name: 'Lead "captured"', visitors: 588 }
    ];
    const csv = toCSV(rows);
    expect(csv).toContain("id,name,visitors");
    expect(csv).toContain('"Lead ""captured"""');
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].visitors).toBe("18420");
    expect(parsed[1].name).toBe('Lead "captured"');
  });

  it("handles empty and headers", () => {
    expect(toCSV([])).toBe("");
    expect(parseCSV("a,b\n1,2")).toEqual([{ a: "1", b: "2" }]);
  });
});
