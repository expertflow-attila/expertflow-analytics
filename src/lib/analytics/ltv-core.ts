/**
 * LTV, cohorts and payback — pure core.
 *
 * Cohort LTV is cumulative NET revenue (gross minus refunds) per acquired
 * customer, measured at fixed day offsets from acquisition. Refunds are
 * subtracted at the date they occurred, not the date of the original order:
 * back-dating them would make historical LTV silently drift.
 */

export type CustomerRecord = {
  personId: string;
  /** First revenue event; defines cohort membership. */
  acquiredAt: number;
  cohortKey: string;
  orders: Array<{ occurredAt: number; grossMinor: number }>;
  refunds: Array<{ occurredAt: number; amountMinor: number }>;
};

export const LTV_HORIZONS = [30, 60, 90, 180, 365] as const;
export type LtvHorizon = (typeof LTV_HORIZONS)[number];

export type CohortMetrics = {
  cohortKey: string;
  customers: number;
  /** Net revenue realised within N days of acquisition, per customer. */
  ltvByHorizon: Record<number, number | null>;
  lifetimeLtvMinor: number;
  totalNetRevenueMinor: number;
  acquisitionCostMinor: number | null;
  cac: number | null;
  /** Days until cumulative net revenue per customer exceeds CAC. */
  paybackDays: number | null;
  paybackStatus: "REACHED" | "NOT_REACHED" | "UNAVAILABLE";
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Net revenue realised by a customer within `days` of acquisition. */
function netRevenueWithin(customer: CustomerRecord, days: number): number {
  const cutoff = customer.acquiredAt + days * DAY_MS;

  const gross = customer.orders
    .filter((o) => o.occurredAt <= cutoff)
    .reduce((sum, o) => sum + o.grossMinor, 0);

  const refunded = customer.refunds
    .filter((r) => r.occurredAt <= cutoff)
    .reduce((sum, r) => sum + r.amountMinor, 0);

  return gross - refunded;
}

function lifetimeNet(customer: CustomerRecord): number {
  const gross = customer.orders.reduce((s, o) => s + o.grossMinor, 0);
  const refunded = customer.refunds.reduce((s, r) => s + r.amountMinor, 0);
  return gross - refunded;
}

export function calculateCohorts(
  customers: CustomerRecord[],
  options: {
    /** Spend attributed to each cohort. Absent keys yield CAC "Unavailable". */
    acquisitionCostByCohortMinor?: Record<string, number>;
    /** Analysis end date; horizons that have not fully elapsed report null. */
    asOf?: number;
  } = {},
): CohortMetrics[] {
  const asOf = options.asOf ?? Date.now();
  const groups = new Map<string, CustomerRecord[]>();

  for (const customer of customers) {
    const list = groups.get(customer.cohortKey) ?? [];
    list.push(customer);
    groups.set(customer.cohortKey, list);
  }

  return [...groups.entries()]
    .map(([cohortKey, members]) => {
      const ltvByHorizon: Record<number, number | null> = {};

      for (const horizon of LTV_HORIZONS) {
        // Only include customers whose horizon has actually elapsed. Averaging
        // a 365-day LTV over customers acquired last week understates it and
        // is one of the most common cohort-reporting mistakes.
        const mature = members.filter(
          (m) => m.acquiredAt + horizon * DAY_MS <= asOf,
        );

        ltvByHorizon[horizon] =
          mature.length === 0
            ? null
            : Math.round(
                mature.reduce((sum, m) => sum + netRevenueWithin(m, horizon), 0) /
                  mature.length,
              );
      }

      const totalNet = members.reduce((sum, m) => sum + lifetimeNet(m), 0);
      const lifetimeLtv = Math.round(totalNet / members.length);

      const spend = options.acquisitionCostByCohortMinor?.[cohortKey];
      const cac = spend === undefined ? null : Math.round(spend / members.length);

      let paybackDays: number | null = null;
      let paybackStatus: CohortMetrics["paybackStatus"] = "UNAVAILABLE";

      if (cac !== null && cac > 0) {
        paybackStatus = "NOT_REACHED";
        for (let day = 1; day <= 365; day++) {
          const mature = members.filter(
            (m) => m.acquiredAt + day * DAY_MS <= asOf,
          );
          if (mature.length === 0) break;

          const perCustomer =
            mature.reduce((sum, m) => sum + netRevenueWithin(m, day), 0) /
            mature.length;

          if (perCustomer >= cac) {
            paybackDays = day;
            paybackStatus = "REACHED";
            break;
          }
        }
      }

      return {
        cohortKey,
        customers: members.length,
        ltvByHorizon,
        lifetimeLtvMinor: lifetimeLtv,
        totalNetRevenueMinor: totalNet,
        acquisitionCostMinor: spend ?? null,
        cac,
        paybackDays,
        paybackStatus,
      } satisfies CohortMetrics;
    })
    .sort((a, b) => a.cohortKey.localeCompare(b.cohortKey));
}

export type RevenueSummary = {
  grossRevenueMinor: number;
  refundedRevenueMinor: number;
  netRevenueMinor: number;
  ordersCount: number;
  customersCount: number;
  averageOrderValueMinor: number | null;
  revenuePerCustomerMinor: number | null;
  mrrMinor: number;
  arrMinor: number;
};

export function summariseRevenue(input: {
  orders: Array<{ grossMinor: number; personId: string | null }>;
  refunds: Array<{ amountMinor: number }>;
  activeSubscriptionsMrrMinor: number;
}): RevenueSummary {
  const gross = input.orders.reduce((s, o) => s + o.grossMinor, 0);
  const refunded = input.refunds.reduce((s, r) => s + r.amountMinor, 0);
  const customers = new Set(
    input.orders.map((o) => o.personId).filter((id): id is string => !!id),
  ).size;

  return {
    grossRevenueMinor: gross,
    refundedRevenueMinor: refunded,
    netRevenueMinor: gross - refunded,
    ordersCount: input.orders.length,
    customersCount: customers,
    averageOrderValueMinor:
      input.orders.length === 0 ? null : Math.round(gross / input.orders.length),
    revenuePerCustomerMinor:
      customers === 0 ? null : Math.round((gross - refunded) / customers),
    mrrMinor: input.activeSubscriptionsMrrMinor,
    arrMinor: input.activeSubscriptionsMrrMinor * 12,
  };
}
