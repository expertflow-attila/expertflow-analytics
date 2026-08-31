/**
 * Simulation engine — what-if arithmetic.
 *
 * This is NOT a forecast. It answers "what would the numbers be if these
 * inputs held", using the same funnel arithmetic the reporting layer uses. It
 * makes no claim about whether the inputs are achievable, and the UI must not
 * present its output as a prediction.
 */

export type SimulationInputs = {
  /** Actors entering the top of the funnel over the period. */
  traffic: number;
  /** Per-step conversion rates, in order. Length = number of steps − 1. */
  stepConversionRates: number[];
  averageOrderValueMinor: number;
  /** Additional lifetime revenue per customer beyond the first order. */
  expansionRevenuePerCustomerMinor?: number;
  /** Total marketing spend for the period. */
  adSpendMinor?: number;
};

export type SimulationResult = {
  stepVolumes: number[];
  customers: number;
  grossRevenueMinor: number;
  lifetimeRevenueMinor: number;
  profitMinor: number | null;
  cacMinor: number | null;
  roas: number | null;
  revenuePerVisitorMinor: number;
};

export function simulate(inputs: SimulationInputs): SimulationResult {
  const volumes: number[] = [inputs.traffic];

  for (const rate of inputs.stepConversionRates) {
    const previous = volumes[volumes.length - 1];
    volumes.push(previous * Math.max(0, Math.min(1, rate)));
  }

  const customers = volumes[volumes.length - 1];
  const gross = customers * inputs.averageOrderValueMinor;
  const lifetime =
    gross + customers * (inputs.expansionRevenuePerCustomerMinor ?? 0);

  const spend = inputs.adSpendMinor ?? null;

  return {
    stepVolumes: volumes.map((v) => Math.round(v * 100) / 100),
    customers: Math.round(customers * 100) / 100,
    grossRevenueMinor: Math.round(gross),
    lifetimeRevenueMinor: Math.round(lifetime),
    profitMinor: spend === null ? null : Math.round(gross - spend),
    cacMinor: spend === null || customers === 0 ? null : Math.round(spend / customers),
    roas: spend === null || spend === 0 ? null : Math.round((gross / spend) * 100) / 100,
    revenuePerVisitorMinor:
      inputs.traffic === 0 ? 0 : Math.round(gross / inputs.traffic),
  };
}

export type Scenario = {
  name: string;
  inputs: SimulationInputs;
  result: SimulationResult;
};

export function compareScenarios(
  base: SimulationInputs,
  variants: Array<{ name: string; overrides: Partial<SimulationInputs> }>,
): Scenario[] {
  return [
    { name: "Current", inputs: base, result: simulate(base) },
    ...variants.map(({ name, overrides }) => {
      const inputs = { ...base, ...overrides };
      return { name, inputs, result: simulate(inputs) };
    }),
  ];
}
