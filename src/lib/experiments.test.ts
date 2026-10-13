import { describe, expect, it } from "vitest";
import { observedChangeLabel, canClaimCausality, summarizeExperiments, type Experiment } from "./experiments";

describe("experiments", () => {
  it("labels observed change without claiming causality", () => {
    expect(observedChangeLabel(0.12)).toBe("+12.0% observed");
    expect(observedChangeLabel(-0.03)).toBe("-3.0% observed");
    expect(canClaimCausality({ id: "1", name: "x", hypothesis: "", metric: "", status: "completed" })).toBe(false);
  });

  it("summarizes a list", () => {
    const list: Experiment[] = [
      { id: "1", name: "A", hypothesis: "", metric: "cvr", status: "running" },
      { id: "2", name: "B", hypothesis: "", metric: "cvr", status: "completed", observedChange: 0.08 }
    ];
    const s = summarizeExperiments(list);
    expect(s.total).toBe(2);
    expect(s.running).toBe(1);
    expect(s.withSignal).toBe(1);
  });
});
