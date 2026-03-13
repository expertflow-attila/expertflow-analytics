const POSTHOG_API_KEY = "phc_d0ILQSSxO0rsZpp9CxWlxoCZAHOxRATstluTD46BI0u";
const POSTHOG_HOST = "https://eu.i.posthog.com";
const PROJECT_ID = "110419";

export interface PageData {
  slug: string;
  label: string;
  color: string;
  url: string;
}

export const PAGES: PageData[] = [
  { slug: "expertflow-ugyfelszerzes", label: "Ügyfélszerzés (SALES)", color: "#33AAFF", url: "https://expertflow-ugyfelszerzes.vercel.app" },
  { slug: "expertflow-ugyfelkezeles", label: "Ügyfélkezelés (START)", color: "#22C55E", url: "https://expertflow-ugyfelkezeles.vercel.app" },
  { slug: "expertflow-hattermukodes", label: "Háttérműködés (FLOW)", color: "#8B5CF6", url: "https://expertflow-hattermukodes.vercel.app" },
  { slug: "ai-ready-kurzus", label: "AI Ready Kurzus", color: "#F59E0B", url: "https://ai-ready-kurzus.vercel.app" },
];

async function posthogQuery(query: string) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog query failed: ${res.status} ${text}`);
  }
  return res.json();
}

export interface OverviewStats {
  totalPageviews: number;
  totalVisitors: number;
  totalSessions: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export async function getOverviewStats(days: number = 30): Promise<OverviewStats> {
  try {
    const [pvResult, visitorResult] = await Promise.all([
      posthogQuery(`
        SELECT
          count() as pageviews,
          count(DISTINCT properties.$session_id) as sessions
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - interval ${days} day
      `),
      posthogQuery(`
        SELECT count(DISTINCT person_id) as visitors
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - interval ${days} day
      `),
    ]);

    const pvRow = pvResult.results?.[0] || [0, 0];
    const visitorRow = visitorResult.results?.[0] || [0];

    return {
      totalPageviews: Number(pvRow[0]) || 0,
      totalVisitors: Number(visitorRow[0]) || 0,
      totalSessions: Number(pvRow[1]) || 0,
      avgSessionDuration: 0,
      bounceRate: 0,
    };
  } catch {
    return { totalPageviews: 0, totalVisitors: 0, totalSessions: 0, avgSessionDuration: 0, bounceRate: 0 };
  }
}

export interface PageStats {
  page: string;
  pageviews: number;
  visitors: number;
}

export async function getPageStats(days: number = 30): Promise<PageStats[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        properties.$host as page,
        count() as pageviews,
        count(DISTINCT person_id) as visitors
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY page
      ORDER BY pageviews DESC
      LIMIT 20
    `);

    return (result.results || []).map((row: (string | number)[]) => ({
      page: String(row[0] || "unknown"),
      pageviews: Number(row[1]) || 0,
      visitors: Number(row[2]) || 0,
    }));
  } catch {
    return [];
  }
}

export interface DailyData {
  date: string;
  pageviews: number;
  visitors: number;
}

export async function getDailyTraffic(days: number = 30): Promise<DailyData[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        toDate(timestamp) as day,
        count() as pageviews,
        count(DISTINCT person_id) as visitors
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY day
      ORDER BY day ASC
    `);

    return (result.results || []).map((row: (string | number)[]) => ({
      date: String(row[0]),
      pageviews: Number(row[1]) || 0,
      visitors: Number(row[2]) || 0,
    }));
  } catch {
    return [];
  }
}

export interface TrafficSource {
  source: string;
  count: number;
  percentage: number;
}

export async function getTrafficSources(days: number = 30): Promise<TrafficSource[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        coalesce(nullIf(properties.$referring_domain, ''), 'Direct') as source,
        count() as cnt
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY source
      ORDER BY cnt DESC
      LIMIT 10
    `);

    const rows = result.results || [];
    const total = rows.reduce((s: number, r: (string | number)[]) => s + Number(r[1]), 0);

    return rows.map((row: (string | number)[]) => ({
      source: String(row[0]),
      count: Number(row[1]) || 0,
      percentage: total > 0 ? Math.round((Number(row[1]) / total) * 100) : 0,
    }));
  } catch {
    return [];
  }
}

export interface DeviceData {
  device: string;
  count: number;
  percentage: number;
}

export async function getDeviceBreakdown(days: number = 30): Promise<DeviceData[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        coalesce(properties.$device_type, 'Unknown') as device,
        count() as cnt
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY device
      ORDER BY cnt DESC
    `);

    const rows = result.results || [];
    const total = rows.reduce((s: number, r: (string | number)[]) => s + Number(r[1]), 0);

    return rows.map((row: (string | number)[]) => ({
      device: String(row[0]),
      count: Number(row[1]) || 0,
      percentage: total > 0 ? Math.round((Number(row[1]) / total) * 100) : 0,
    }));
  } catch {
    return [];
  }
}

export interface BrowserData {
  browser: string;
  count: number;
  percentage: number;
}

export async function getBrowserBreakdown(days: number = 30): Promise<BrowserData[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        coalesce(properties.$browser, 'Unknown') as browser,
        count() as cnt
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY browser
      ORDER BY cnt DESC
      LIMIT 8
    `);

    const rows = result.results || [];
    const total = rows.reduce((s: number, r: (string | number)[]) => s + Number(r[1]), 0);

    return rows.map((row: (string | number)[]) => ({
      browser: String(row[0]),
      count: Number(row[1]) || 0,
      percentage: total > 0 ? Math.round((Number(row[1]) / total) * 100) : 0,
    }));
  } catch {
    return [];
  }
}

export interface CityData {
  city: string;
  count: number;
}

export async function getTopCities(days: number = 30): Promise<CityData[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        coalesce(properties.$geoip_city_name, 'Ismeretlen') as city,
        count() as cnt
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY city
      ORDER BY cnt DESC
      LIMIT 10
    `);

    return (result.results || []).map((row: (string | number)[]) => ({
      city: String(row[0]),
      count: Number(row[1]) || 0,
    }));
  } catch {
    return [];
  }
}

export interface PagePerformance {
  host: string;
  path: string;
  pageviews: number;
  visitors: number;
}

export async function getTopPages(days: number = 30): Promise<PagePerformance[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        properties.$host as host,
        properties.$pathname as path,
        count() as pageviews,
        count(DISTINCT person_id) as visitors
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY host, path
      ORDER BY pageviews DESC
      LIMIT 15
    `);

    return (result.results || []).map((row: (string | number)[]) => ({
      host: String(row[0] || ""),
      path: String(row[1] || "/"),
      pageviews: Number(row[2]) || 0,
      visitors: Number(row[3]) || 0,
    }));
  } catch {
    return [];
  }
}

export interface EventData {
  event: string;
  count: number;
}

export async function getCustomEvents(days: number = 30): Promise<EventData[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        event,
        count() as cnt
      FROM events
      WHERE timestamp > now() - interval ${days} day
        AND event NOT LIKE '$%'
      GROUP BY event
      ORDER BY cnt DESC
      LIMIT 15
    `);

    return (result.results || []).map((row: (string | number)[]) => ({
      event: String(row[0]),
      count: Number(row[1]) || 0,
    }));
  } catch {
    return [];
  }
}

export interface PerPageDaily {
  host: string;
  date: string;
  pageviews: number;
}

export async function getDailyByPage(days: number = 30): Promise<PerPageDaily[]> {
  try {
    const result = await posthogQuery(`
      SELECT
        properties.$host as host,
        toDate(timestamp) as day,
        count() as pageviews
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval ${days} day
      GROUP BY host, day
      ORDER BY day ASC
    `);

    return (result.results || []).map((row: (string | number)[]) => ({
      host: String(row[0] || ""),
      date: String(row[1]),
      pageviews: Number(row[2]) || 0,
    }));
  } catch {
    return [];
  }
}
