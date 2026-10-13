export type DailyAggregate = {
  date: string; // YYYY-MM-DD
  pageviews: number;
  visitors: number;
  sessions: number;
  revenue: number;
};

/**
 * Build daily aggregates from raw event-like rows.
 * In production this would be a materialized table refreshed by a worker.
 */
export function buildDailyAggregates(
  events: { timestamp: string; event_name: string; person_id?: string; properties?: { revenue?: number } }[],
  timezone = "UTC"
): DailyAggregate[] {
  const byDay = new Map<string, DailyAggregate>();
  for (const e of events) {
    const day = e.timestamp.slice(0, 10);
    let agg = byDay.get(day);
    if (!agg) {
      agg = { date: day, pageviews: 0, visitors: 0, sessions: 0, revenue: 0 };
      byDay.set(day, agg);
    }
    if (e.event_name === "pageview") agg.pageviews += 1;
    if (e.event_name === "session_start") agg.sessions += 1;
    if (e.person_id) agg.visitors += 1; // naive unique later
    if (typeof e.properties?.revenue === "number") agg.revenue += e.properties.revenue;
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function fillMissingDays(aggregates: DailyAggregate[], start: string, end: string): DailyAggregate[] {
  const map = new Map(aggregates.map((a) => [a.date, a]));
  const result: DailyAggregate[] = [];
  let current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    const key = current.toISOString().slice(0, 10);
    result.push(map.get(key) ?? { date: key, pageviews: 0, visitors: 0, sessions: 0, revenue: 0 });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}
