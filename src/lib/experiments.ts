export type ExperimentStatus = "draft" | "running" | "completed" | "stopped";

export type Experiment = {
  id: string;
  name: string;
  hypothesis: string;
  metric: string;
  status: ExperimentStatus;
  startedAt?: string;
  endedAt?: string;
  observedChange?: number; // relative, e.g. 0.12 = +12%
  confidence?: "low" | "medium" | "high";
  notes?: string;
};

export function observedChangeLabel(change?: number): string {
  if (change == null) return "Not measured";
  const pct = (change * 100).toFixed(1);
  return change >= 0 ? `+${pct}% observed` : `${pct}% observed`;
}

export function canClaimCausality(exp: Experiment): boolean {
  // The OS deliberately never claims causality from observational data alone
  return false;
}

export function summarizeExperiments(exps: Experiment[]) {
  const running = exps.filter((e) => e.status === "running").length;
  const completed = exps.filter((e) => e.status === "completed").length;
  const withSignal = exps.filter((e) => e.observedChange != null && Math.abs(e.observedChange) >= 0.05).length;
  return { total: exps.length, running, completed, withSignal };
}
