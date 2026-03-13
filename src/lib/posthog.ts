// =====================================================
// Expert Flow Analytics — Deterministic Demo Data
// Realistic 45-day traffic across 4 landing pages
// =====================================================

export interface PageData {
  slug: string;
  label: string;
  url: string;
}

export const PAGES: PageData[] = [
  { slug: "expertflow-ugyfelszerzes", label: "Ugyfelszerzes (SALES)", url: "https://expertflow-ugyfelszerzes.vercel.app" },
  { slug: "expertflow-ugyfelkezeles", label: "Ugyfelkezeles (START)", url: "https://expertflow-ugyfelkezeles.vercel.app" },
  { slug: "expertflow-hattermukodes", label: "Hattermukodes (FLOW)", url: "https://expertflow-hattermukodes.vercel.app" },
  { slug: "ai-ready-kurzus", label: "AI Ready Kurzus", url: "https://ai-ready-kurzus.vercel.app" },
];

// Seeded pseudo-random number generator for deterministic data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = seededRandom(20260313);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Generate 45 days of daily data for a page
function generateDailyForPage(baseDaily: number, growthFactor: number): { pageviews: number; visitors: number }[] {
  const days: { pageviews: number; visitors: number }[] = [];
  for (let i = 0; i < 45; i++) {
    const dayOfWeek = (i + 3) % 7; // Start on a Wednesday-ish
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const weekendDip = isWeekend ? 0.6 : 1.0;
    const growth = 1 + (i / 45) * growthFactor;
    const noise = 0.8 + rng() * 0.4;
    const pv = Math.round(baseDaily * growth * weekendDip * noise);
    const vis = Math.round(pv * (0.35 + rng() * 0.1));
    days.push({ pageviews: pv, visitors: vis });
  }
  return days;
}

// Pre-generate all page data
const pageConfigs = [
  { slug: "expertflow-ugyfelszerzes.vercel.app", label: "Ugyfelszerzes (SALES)", baseDaily: 55, growth: 0.35 },
  { slug: "expertflow-ugyfelkezeles.vercel.app", label: "Ugyfelkezeles (START)", baseDaily: 42, growth: 0.25 },
  { slug: "expertflow-hattermukodes.vercel.app", label: "Hattermukodes (FLOW)", baseDaily: 35, growth: 0.20 },
  { slug: "ai-ready-kurzus.vercel.app", label: "AI Ready Kurzus", baseDaily: 48, growth: 0.30 },
];

const allPageDaily = pageConfigs.map(pc => ({
  ...pc,
  daily: generateDailyForPage(pc.baseDaily, pc.growth),
}));

// Generate date strings (45 days ending "today")
function getDates(): string[] {
  const dates: string[] = [];
  const now = new Date(2026, 2, 13); // 2026-03-13
  for (let i = 44; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const DATES = getDates();

// ============== Public API (same interface as before) ==============

export interface OverviewStats {
  totalPageviews: number;
  totalVisitors: number;
  totalSessions: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export async function getOverviewStats(_days: number = 30): Promise<OverviewStats> {
  let totalPv = 0;
  let totalVis = 0;
  for (const page of allPageDaily) {
    for (const d of page.daily) {
      totalPv += d.pageviews;
      totalVis += d.visitors;
    }
  }
  return {
    totalPageviews: totalPv,
    totalVisitors: totalVis,
    totalSessions: Math.round(totalPv * 0.54),
    avgSessionDuration: 127,
    bounceRate: 42,
  };
}

export interface PageStats {
  page: string;
  pageviews: number;
  visitors: number;
}

export async function getPageStats(_days: number = 30): Promise<PageStats[]> {
  return allPageDaily.map(p => {
    const pv = p.daily.reduce((s, d) => s + d.pageviews, 0);
    const vis = p.daily.reduce((s, d) => s + d.visitors, 0);
    return { page: p.slug, pageviews: pv, visitors: vis };
  });
}

export interface DailyData {
  date: string;
  pageviews: number;
  visitors: number;
}

export async function getDailyTraffic(_days: number = 30): Promise<DailyData[]> {
  return DATES.map((date, i) => {
    let pv = 0;
    let vis = 0;
    for (const page of allPageDaily) {
      pv += page.daily[i].pageviews;
      vis += page.daily[i].visitors;
    }
    return { date, pageviews: pv, visitors: vis };
  });
}

export interface TrafficSource {
  source: string;
  count: number;
  percentage: number;
}

export async function getTrafficSources(_days: number = 30): Promise<TrafficSource[]> {
  const overview = await getOverviewStats();
  const total = overview.totalPageviews;
  const sources = [
    { source: "Google", percentage: 38 },
    { source: "Direct", percentage: 25 },
    { source: "Facebook", percentage: 15 },
    { source: "LinkedIn", percentage: 12 },
    { source: "Instagram", percentage: 5 },
    { source: "Egyéb", percentage: 5 },
  ];
  return sources.map(s => ({
    source: s.source,
    count: Math.round(total * s.percentage / 100),
    percentage: s.percentage,
  }));
}

export interface DeviceData {
  device: string;
  count: number;
  percentage: number;
}

export async function getDeviceBreakdown(_days: number = 30): Promise<DeviceData[]> {
  const overview = await getOverviewStats();
  const total = overview.totalPageviews;
  const devices = [
    { device: "Desktop", percentage: 62 },
    { device: "Mobile", percentage: 33 },
    { device: "Tablet", percentage: 5 },
  ];
  return devices.map(d => ({
    device: d.device,
    count: Math.round(total * d.percentage / 100),
    percentage: d.percentage,
  }));
}

export interface BrowserData {
  browser: string;
  count: number;
  percentage: number;
}

export async function getBrowserBreakdown(_days: number = 30): Promise<BrowserData[]> {
  const overview = await getOverviewStats();
  const total = overview.totalPageviews;
  const browsers = [
    { browser: "Chrome", percentage: 55 },
    { browser: "Safari", percentage: 22 },
    { browser: "Firefox", percentage: 10 },
    { browser: "Edge", percentage: 8 },
    { browser: "Egyéb", percentage: 5 },
  ];
  return browsers.map(b => ({
    browser: b.browser,
    count: Math.round(total * b.percentage / 100),
    percentage: b.percentage,
  }));
}

export interface CityData {
  city: string;
  count: number;
}

export async function getTopCities(_days: number = 30): Promise<CityData[]> {
  const overview = await getOverviewStats();
  const total = overview.totalVisitors;
  const cities = [
    { city: "Budapest", pct: 45 },
    { city: "Debrecen", pct: 12 },
    { city: "Szeged", pct: 8 },
    { city: "Miskolc", pct: 6 },
    { city: "Pecs", pct: 5 },
    { city: "Gyor", pct: 5 },
    { city: "Wien", pct: 4 },
    { city: "Bratislava", pct: 3 },
    { city: "Munchen", pct: 2 },
    { city: "Egyéb", pct: 10 },
  ];
  return cities.map(c => ({
    city: c.city,
    count: Math.round(total * c.pct / 100),
  }));
}

export interface PagePerformance {
  host: string;
  path: string;
  pageviews: number;
  visitors: number;
}

export async function getTopPages(_days: number = 30): Promise<PagePerformance[]> {
  const pages = await getPageStats();
  const paths = [
    { path: "/", pctPv: 0.55, pctVis: 0.6 },
    { path: "/pricing", pctPv: 0.18, pctVis: 0.2 },
    { path: "/features", pctPv: 0.15, pctVis: 0.12 },
    { path: "/contact", pctPv: 0.12, pctVis: 0.08 },
  ];
  const result: PagePerformance[] = [];
  for (const page of pages) {
    for (const p of paths) {
      result.push({
        host: page.page,
        path: p.path,
        pageviews: Math.round(page.pageviews * p.pctPv),
        visitors: Math.round(page.visitors * p.pctVis),
      });
    }
  }
  result.sort((a, b) => b.pageviews - a.pageviews);
  return result.slice(0, 12);
}

export interface EventData {
  event: string;
  count: number;
}

export async function getCustomEvents(_days: number = 30): Promise<EventData[]> {
  return [
    { event: "cta_click", count: 1842 },
    { event: "section_view", count: 4521 },
    { event: "pricing_view", count: 1356 },
    { event: "form_start", count: 687 },
    { event: "form_submit", count: 423 },
    { event: "video_play", count: 312 },
    { event: "scroll_75", count: 2891 },
    { event: "social_click", count: 198 },
    { event: "faq_open", count: 567 },
    { event: "testimonial_view", count: 1204 },
  ];
}

export async function getTrafficSourcesByPage(_days: number = 30): Promise<Record<string, TrafficSource[]>> {
  const pages = await getPageStats();
  const result: Record<string, TrafficSource[]> = {};

  const sourceVariations: Record<string, number[]> = {
    "expertflow-ugyfelszerzes.vercel.app": [42, 22, 14, 12, 5, 5],
    "expertflow-ugyfelkezeles.vercel.app": [35, 28, 16, 11, 5, 5],
    "expertflow-hattermukodes.vercel.app": [32, 30, 12, 14, 6, 6],
    "ai-ready-kurzus.vercel.app": [40, 20, 18, 10, 7, 5],
  };

  for (const page of pages) {
    const total = page.pageviews;
    const pcts = sourceVariations[page.page] || [38, 25, 15, 12, 5, 5];
    const sourceNames = ["Google", "Direct", "Facebook", "LinkedIn", "Instagram", "Egyéb"];
    result[page.page] = sourceNames.map((source, i) => ({
      source,
      count: Math.round(total * pcts[i] / 100),
      percentage: pcts[i],
    }));
  }
  return result;
}

export async function getDevicesByPage(_days: number = 30): Promise<Record<string, DeviceData[]>> {
  const pages = await getPageStats();
  const result: Record<string, DeviceData[]> = {};

  const deviceVariations: Record<string, number[]> = {
    "expertflow-ugyfelszerzes.vercel.app": [58, 37, 5],
    "expertflow-ugyfelkezeles.vercel.app": [65, 30, 5],
    "expertflow-hattermukodes.vercel.app": [70, 25, 5],
    "ai-ready-kurzus.vercel.app": [55, 38, 7],
  };

  for (const page of pages) {
    const total = page.pageviews;
    const pcts = deviceVariations[page.page] || [62, 33, 5];
    const deviceNames = ["Desktop", "Mobile", "Tablet"];
    result[page.page] = deviceNames.map((device, i) => ({
      device,
      count: Math.round(total * pcts[i] / 100),
      percentage: pcts[i],
    }));
  }
  return result;
}

export async function getBrowsersByPage(_days: number = 30): Promise<Record<string, BrowserData[]>> {
  const pages = await getPageStats();
  const result: Record<string, BrowserData[]> = {};

  for (const page of pages) {
    const total = page.pageviews;
    const browsers = [
      { browser: "Chrome", percentage: 52 + Math.round((rng() - 0.5) * 10) },
      { browser: "Safari", percentage: 22 + Math.round((rng() - 0.5) * 6) },
      { browser: "Firefox", percentage: 10 + Math.round((rng() - 0.5) * 4) },
      { browser: "Edge", percentage: 8 + Math.round((rng() - 0.5) * 4) },
    ];
    const remaining = 100 - browsers.reduce((s, b) => s + b.percentage, 0);
    browsers.push({ browser: "Egyéb", percentage: remaining });

    result[page.page] = browsers.map(b => ({
      browser: b.browser,
      count: Math.round(total * b.percentage / 100),
      percentage: b.percentage,
    }));
  }
  return result;
}

export async function getEventsByPage(_days: number = 30): Promise<Record<string, EventData[]>> {
  const pages = await getPageStats();
  const result: Record<string, EventData[]> = {};

  const baseEvents = [
    { event: "cta_click", base: 1842 },
    { event: "section_view", base: 4521 },
    { event: "pricing_view", base: 1356 },
    { event: "form_start", base: 687 },
    { event: "form_submit", base: 423 },
    { event: "video_play", base: 312 },
    { event: "scroll_75", base: 2891 },
    { event: "social_click", base: 198 },
    { event: "faq_open", base: 567 },
    { event: "testimonial_view", base: 1204 },
  ];

  const totalPv = pages.reduce((s, p) => s + p.pageviews, 0);

  for (const page of pages) {
    const ratio = page.pageviews / totalPv;
    result[page.page] = baseEvents.map(e => ({
      event: e.event,
      count: Math.round(e.base * ratio * (0.8 + rng() * 0.4)),
    }));
  }
  return result;
}

export interface PerPageDaily {
  host: string;
  date: string;
  pageviews: number;
}

export async function getDailyByPage(_days: number = 30): Promise<PerPageDaily[]> {
  const result: PerPageDaily[] = [];
  for (const page of allPageDaily) {
    for (let i = 0; i < 45; i++) {
      result.push({
        host: page.slug,
        date: DATES[i],
        pageviews: page.daily[i].pageviews,
      });
    }
  }
  return result;
}
