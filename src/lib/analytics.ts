export type AttributionModel = "first" | "last" | "linear" | "u-shaped";

export type FunnelStep = {
  id: string;
  label: string;
  shortLabel: string;
  visitors: number;
  targetRate: number;
  revenue: number;
  trend: number;
  x: number;
  y: number;
};

export type Touchpoint = { channel: string; role?: "lead" | "assist" };

export function rate(part: number, whole: number): number {
  return whole <= 0 ? 0 : (part / whole) * 100;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function transitionRate(steps: FunnelStep[], index: number): number {
  if (index === 0) return 100;
  return rate(steps[index].visitors, steps[index - 1].visitors);
}

export function calculateOpportunity(input: {
  eligibleUsers: number;
  currentRate: number;
  targetRate: number;
  downstreamRevenuePerConversion: number;
  confidence: number;
  effort: number;
}) {
  const improvement = Math.max(0, input.targetRate - input.currentRate) / 100;
  const additionalConversions = input.eligibleUsers * improvement;
  const monthlyUpside = additionalConversions * input.downstreamRevenuePerConversion;
  const reach = Math.min(1, input.eligibleUsers / 1000);
  const score = Math.min(100, Math.round((monthlyUpside / 500) * input.confidence * (0.55 + reach) / input.effort));
  return { additionalConversions, monthlyUpside, score };
}

export function attributeRevenue(touchpoints: Touchpoint[], revenue: number, model: AttributionModel) {
  if (!touchpoints.length) return [];
  const cents = Math.round(revenue * 100);
  const shares = new Array(touchpoints.length).fill(0);
  if (model === "first") shares[0] = cents;
  if (model === "last") shares[shares.length - 1] = cents;
  if (model === "linear") {
    const base = Math.floor(cents / shares.length);
    shares.fill(base);
    shares[shares.length - 1] += cents - base * shares.length;
  }
  if (model === "u-shaped") {
    if (shares.length === 1) shares[0] = cents;
    else if (shares.length === 2) {
      shares[0] = Math.floor(cents / 2);
      shares[1] = cents - shares[0];
    } else {
      shares[0] = Math.round(cents * 0.4);
      shares[shares.length - 1] = Math.round(cents * 0.4);
      const middle = cents - shares[0] - shares[shares.length - 1];
      const each = Math.floor(middle / (shares.length - 2));
      for (let i = 1; i < shares.length - 1; i += 1) shares[i] = each;
      shares[shares.length - 2] += middle - each * (shares.length - 2);
    }
  }
  const totals = new Map<string, number>();
  touchpoints.forEach((touch, index) => totals.set(touch.channel, (totals.get(touch.channel) ?? 0) + shares[index]));
  return [...totals.entries()].map(([channel, value]) => ({ channel, revenue: value / 100 }));
}

export function simulateRevenue(input: {
  traffic: number;
  leadRate: number;
  bookingRate: number;
  closeRate: number;
  averageOrderValue: number;
  adSpend: number;
}) {
  const leads = input.traffic * input.leadRate / 100;
  const calls = leads * input.bookingRate / 100;
  const customers = calls * input.closeRate / 100;
  const revenue = customers * input.averageOrderValue;
  return {
    leads,
    calls,
    customers,
    revenue,
    profit: revenue - input.adSpend,
    cac: customers ? input.adSpend / customers : 0,
    roas: input.adSpend ? revenue / input.adSpend : 0,
  };
}

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard"
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}
