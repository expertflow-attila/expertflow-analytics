"use client";

import { useEffect, useRef, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import type {
  OverviewStats,
  PageStats,
  DailyData,
  TrafficSource,
  DeviceData,
  BrowserData,
  CityData,
  PagePerformance,
  EventData,
} from "@/lib/posthog";

// ============================================================
// Hooks
// ============================================================

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// ============================================================
// AnimatedCounter (from Landing Design metrics-section pattern)
// ============================================================

function AnimatedCounter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return (
    <div ref={ref} className="font-display tracking-tight">
      {prefix}{count.toLocaleString("hu-HU")}{suffix}
    </div>
  );
}

// ============================================================
// SVG Charts — all custom, no external chart lib
// ============================================================

function SparkLine({ data, className = "" }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`${className}`} fill="none" preserveAspectRatio="none">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function LineChart({ data, height = 200 }: { data: { date: string; pageviews: number; visitors: number }[]; height?: number }) {
  if (data.length < 2) return null;
  const maxPv = Math.max(...data.map(d => d.pageviews));
  const w = 600;
  const h = height;
  const pad = { top: 10, right: 10, bottom: 30, left: 50 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const pvPoints = data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * cw;
    const y = pad.top + ch - (d.pageviews / maxPv) * ch;
    return `${x},${y}`;
  });

  const visPoints = data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * cw;
    const y = pad.top + ch - (d.visitors / maxPv) * ch;
    return `${x},${y}`;
  });

  // Area fill
  const areaPath = `M${pvPoints[0]} ${pvPoints.join(" L")} L${pad.left + cw},${pad.top + ch} L${pad.left},${pad.top + ch} Z`;

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    value: Math.round(maxPv * pct),
    y: pad.top + ch - pct * ch,
  }));

  // X-axis labels (show every ~10th)
  const xLabels = data.filter((_, i) => i % 10 === 0 || i === data.length - 1).map((d, _, arr) => {
    const idx = data.indexOf(d);
    return {
      label: d.date.slice(5),
      x: pad.left + (idx / (data.length - 1)) * cw,
    };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTicks.map(t => (
        <line key={t.value} x1={pad.left} y1={t.y} x2={pad.left + cw} y2={t.y}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth="1" />
      ))}
      {/* Y labels */}
      {yTicks.map(t => (
        <text key={`label-${t.value}`} x={pad.left - 8} y={t.y + 4}
          textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="currentColor" opacity={0.4}>
          {t.value}
        </text>
      ))}
      {/* X labels */}
      {xLabels.map(l => (
        <text key={l.label} x={l.x} y={h - 6}
          textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="currentColor" opacity={0.4}>
          {l.label}
        </text>
      ))}
      {/* Area fill */}
      <path d={areaPath} fill="currentColor" opacity={0.05} />
      {/* Visitor line */}
      <polyline points={visPoints.join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Pageview line */}
      <polyline points={pvPoints.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function DonutChart({ data, size = 120 }: { data: { label: string; value: number }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let cumAngle = -Math.PI / 2;
  const opacities = [1, 0.7, 0.5, 0.35, 0.2];

  const arcs = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(cumAngle);
    const startY = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const endX = cx + r * Math.cos(cumAngle);
    const endY = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${startX},${startY} A${r},${r} 0 ${largeArc},1 ${endX},${endY} Z`;
    return (
      <path key={d.label} d={path} fill="currentColor" opacity={opacities[i] ?? 0.15} />
    );
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
        {arcs}
        <circle cx={cx} cy={cy} r={r * 0.55} className="fill-background" />
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "currentColor", opacity: opacities[i] ?? 0.15 }} />
            <span className="text-muted-foreground truncate">{d.label}</span>
            <span className="font-mono text-xs ml-auto">{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBar({ label, value, max, delay = 0 }: { label: string; value: number; max: number; delay?: number }) {
  const { ref, isVisible } = useInView(0.1);
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-xs">{value.toLocaleString("hu-HU")}</span>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground/80 transition-all duration-1000 ease-out"
          style={{
            width: isVisible ? `${pct}%` : "0%",
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Section Header — Landing Design pattern
// ============================================================

function SectionHeader({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`mb-12 lg:mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
        <span className="w-8 h-px bg-foreground/30" />
        {num}
      </span>
      <h2 className="text-3xl lg:text-5xl font-display tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-lg text-muted-foreground mt-2">{subtitle}</p>
      )}
    </div>
  );
}

// ============================================================
// Page Labels & Colors
// ============================================================

const PAGE_LABELS: Record<string, string> = {
  "expertflow-ugyfelszerzes.vercel.app": "Ügyfélszerzés",
  "expertflow-ugyfelkezeles.vercel.app": "Ügyfélkezelés",
  "expertflow-hattermukodes.vercel.app": "Háttérműködés",
  "ai-ready-kurzus.vercel.app": "AI Ready Kurzus",
};

const PAGE_SHORT: Record<string, string> = {
  "expertflow-ugyfelszerzes.vercel.app": "SALES",
  "expertflow-ugyfelkezeles.vercel.app": "START",
  "expertflow-hattermukodes.vercel.app": "FLOW",
  "ai-ready-kurzus.vercel.app": "AI Ready",
};

const PAGE_HOSTS = [
  "expertflow-ugyfelszerzes.vercel.app",
  "expertflow-ugyfelkezeles.vercel.app",
  "expertflow-hattermukodes.vercel.app",
  "ai-ready-kurzus.vercel.app",
];

const PAGE_FILTER_LABELS: Record<string, string> = {
  all: "Összes",
  "expertflow-ugyfelszerzes.vercel.app": "SALES",
  "expertflow-ugyfelkezeles.vercel.app": "START",
  "expertflow-hattermukodes.vercel.app": "FLOW",
  "ai-ready-kurzus.vercel.app": "AI Ready",
};

// ============================================================
// Theme Toggle
// ============================================================

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="size-9" />;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="size-9 flex items-center justify-center rounded-md border border-foreground/10 hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

// ============================================================
// Page Filter Tabs
// ============================================================

function PageFilterTabs({ selected, onChange }: { selected: string; onChange: (v: string) => void }) {
  const options = ["all", ...PAGE_HOSTS];
  return (
    <div className="flex flex-wrap gap-2 mb-12">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-lg border text-sm font-mono transition-all duration-200 ${
            selected === opt
              ? "bg-foreground text-background border-foreground"
              : "border-foreground/10 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          }`}
        >
          {PAGE_FILTER_LABELS[opt]}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Dashboard
// ============================================================

interface DashboardProps {
  overview: OverviewStats;
  pages: PageStats[];
  daily: DailyData[];
  sources: TrafficSource[];
  devices: DeviceData[];
  browsers: BrowserData[];
  cities: CityData[];
  topPages: PagePerformance[];
  events: EventData[];
  sourcesByPage: Record<string, TrafficSource[]>;
  devicesByPage: Record<string, DeviceData[]>;
  browsersByPage: Record<string, BrowserData[]>;
  eventsByPage: Record<string, EventData[]>;
}

export function Dashboard({
  overview,
  pages,
  daily,
  sources,
  devices,
  browsers,
  cities,
  topPages,
  events,
  sourcesByPage,
  devicesByPage,
  browsersByPage,
  eventsByPage,
}: DashboardProps) {
  const [selectedPage, setSelectedPage] = useState<string>("all");

  const dailyPvs = daily.map(d => d.pageviews);
  const dailyVis = daily.map(d => d.visitors);
  const maxPagePv = Math.max(...pages.map(p => p.pageviews), 1);

  // Compute active data based on filter
  const activeSources = selectedPage === "all" ? sources : (sourcesByPage[selectedPage] || sources);
  const activeDevices = selectedPage === "all" ? devices : (devicesByPage[selectedPage] || devices);
  const activeBrowsers = selectedPage === "all" ? browsers : (browsersByPage[selectedPage] || browsers);
  const activeEvents = selectedPage === "all" ? events : (eventsByPage[selectedPage] || events);
  const activeTopPages = selectedPage === "all" ? topPages : topPages.filter(p => p.host === selectedPage);

  const maxSourceCount = Math.max(...activeSources.map(s => s.count), 1);
  const maxCityCount = Math.max(...cities.map(c => c.count), 1);
  const maxEventCount = Math.max(...activeEvents.map(e => e.count), 1);
  const maxBrowserCount = Math.max(...activeBrowsers.map(b => b.count), 1);

  const donutPages = pages.map(p => ({
    label: PAGE_SHORT[p.page] || p.page,
    value: p.pageviews,
  }));

  const donutDevices = activeDevices.map(d => ({
    label: d.device,
    value: d.count,
  }));

  const donutSources = activeSources.map(s => ({
    label: s.source,
    value: s.count,
  }));

  // Split daily into last-7 for sparklines
  const last7Pv = dailyPvs.slice(-7);
  const last7Vis = dailyVis.slice(-7);
  const last7Sessions = daily.slice(-7).map(d => Math.round(d.pageviews * 0.54));

  return (
    <div className="noise-overlay min-h-screen">
      {/* =============== Navigation =============== */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-foreground/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl tracking-tight">Expert Flow</span>
            <span className="font-mono text-xs text-muted-foreground mt-0.5">Analytics</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500 pulse-soft" />
              Utolsó 45 nap
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* =============== Hero =============== */}
      <header className="border-b border-foreground/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Dashboard
          </span>
          <h1 className="text-5xl lg:text-7xl font-display tracking-tight">
            Landing
            <br />
            <span className="text-muted-foreground">Teljesítmény.</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-lg">
            Minden adat, egy helyen. 4 landing oldal, 45 nap, valós látogatói viselkedés.
          </p>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">

        {/* =============== Section 00 — Kampány teljesítmény =============== */}
        <section className="py-24 lg:py-32 border-b border-foreground/10">
          <SectionHeader num="00" title="Kampány teljesítmény" subtitle="Egyedi landing oldalak összehasonlítása" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pages.map((p) => {
              const label = PAGE_LABELS[p.page] || p.page;
              const tag = PAGE_SHORT[p.page] || "";
              // Build a mini sparkline from the page's share of daily data
              const sparkData = daily.slice(-14).map(d => Math.round(d.pageviews * (p.pageviews / overview.totalPageviews)));
              return (
                <div
                  key={p.page}
                  className={`border rounded-lg p-6 transition-all duration-200 cursor-pointer ${
                    selectedPage === p.page
                      ? "border-foreground bg-foreground/5"
                      : "border-foreground/10 hover:border-foreground/30"
                  }`}
                  onClick={() => setSelectedPage(selectedPage === p.page ? "all" : p.page)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-muted-foreground px-2 py-0.5 border border-foreground/10 rounded-lg">{tag}</span>
                    <SparkLine data={sparkData} className="w-16 h-5 text-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{label}</p>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-2xl">{p.pageviews.toLocaleString("hu-HU")}</span>
                    <span className="text-xs text-muted-foreground">megtekintés</span>
                  </div>
                  <div className="mt-1">
                    <span className="font-mono text-sm text-muted-foreground">{p.visitors.toLocaleString("hu-HU")}</span>
                    <span className="text-xs text-muted-foreground ml-1">látogató</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =============== Section 01 — Áttekintés =============== */}
        <section className="py-24 lg:py-32 border-b border-foreground/10">
          <SectionHeader num="01" title="Áttekintés" subtitle="Összesített teljesítménymutatók" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-foreground/10">
            {/* Oldalmegtekintés */}
            <div className="bg-background p-8 lg:p-12">
              <div className="text-5xl lg:text-7xl">
                <AnimatedCounter end={overview.totalPageviews} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg text-muted-foreground">Oldalmegtekintés</span>
                <SparkLine data={last7Pv} className="w-20 h-6 text-foreground/40" />
              </div>
            </div>
            {/* Egyedi látogató */}
            <div className="bg-background p-8 lg:p-12">
              <div className="text-5xl lg:text-7xl">
                <AnimatedCounter end={overview.totalVisitors} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg text-muted-foreground">Egyedi látogató</span>
                <SparkLine data={last7Vis} className="w-20 h-6 text-foreground/40" />
              </div>
            </div>
            {/* Munkamenet */}
            <div className="bg-background p-8 lg:p-12">
              <div className="text-5xl lg:text-7xl">
                <AnimatedCounter end={overview.totalSessions} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg text-muted-foreground">Munkamenet</span>
                <SparkLine data={last7Sessions} className="w-20 h-6 text-foreground/40" />
              </div>
            </div>
            {/* Aktív landing oldal */}
            <div className="bg-background p-8 lg:p-12">
              <div className="text-5xl lg:text-7xl">
                <AnimatedCounter end={4} />
              </div>
              <div className="mt-3">
                <span className="text-lg text-muted-foreground">Aktív landing oldal</span>
              </div>
            </div>
          </div>
        </section>

        {/* =============== Section 02 — Forgalom trend =============== */}
        <section className="py-24 lg:py-32 border-b border-foreground/10">
          <SectionHeader num="02" title="Forgalom trend" subtitle="Napi oldalmegtekintések és látogatók" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Line chart */}
            <div className="lg:col-span-2 border border-foreground/10 rounded-lg p-6 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                  Megtekintések / nap
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {daily[0]?.date} — {daily[daily.length - 1]?.date}
                </span>
              </div>
              <LineChart data={daily} height={240} />
              <div className="flex gap-6 mt-4">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-0.5 bg-foreground rounded" /> Megtekintések
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-0.5 bg-foreground/25 rounded" /> Látogatók
                </span>
              </div>
            </div>

            {/* Page distribution donut */}
            <div className="border border-foreground/10 rounded-lg p-6 lg:p-8">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-6">
                Oldal eloszlás
              </span>
              <DonutChart data={donutPages} size={130} />
            </div>
          </div>
        </section>

        {/* =============== Page Filter =============== */}
        <div className="pt-24 lg:pt-32">
          <PageFilterTabs selected={selectedPage} onChange={setSelectedPage} />
        </div>

        {/* =============== Section 03 — Landing oldalak =============== */}
        <section className="pb-24 lg:pb-32 border-b border-foreground/10">
          <SectionHeader num="03" title="Landing oldalak" subtitle="Teljesítmény összehasonlítás" />

          <div>
            {pages.map((p, index) => {
              const label = PAGE_LABELS[p.page] || p.page;
              const tag = PAGE_SHORT[p.page] || "";
              const pct = (p.pageviews / maxPagePv) * 100;
              const isHighlighted = selectedPage === p.page;
              return (
                <PageBarRow
                  key={p.page}
                  number={String(index + 1).padStart(2, "0")}
                  label={label}
                  tag={tag}
                  pageviews={p.pageviews}
                  visitors={p.visitors}
                  percentage={pct}
                  delay={index * 100}
                  highlighted={isHighlighted}
                />
              );
            })}
          </div>
        </section>

        {/* =============== Section 04 — Forgalom részletei =============== */}
        <section className="py-24 lg:py-32 border-b border-foreground/10">
          <SectionHeader num="04" title="Forgalom részletei" subtitle="Források, eszközök, böngészők" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sources donut */}
            <div className="border border-foreground/10 rounded-lg p-6 lg:p-8">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-6">
                Forgalmi források
              </span>
              <DonutChart data={donutSources} size={130} />
            </div>

            {/* Devices donut */}
            <div className="border border-foreground/10 rounded-lg p-6 lg:p-8">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-6">
                Eszközök
              </span>
              <DonutChart data={donutDevices} size={130} />
            </div>

            {/* Browsers bar chart */}
            <div className="border border-foreground/10 rounded-lg p-6 lg:p-8">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-6">
                Böngészők
              </span>
              <div className="space-y-4">
                {activeBrowsers.map((b, i) => (
                  <HorizontalBar key={b.browser} label={b.browser} value={b.count} max={maxBrowserCount} delay={i * 80} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =============== Section 05 — Részletes bontás =============== */}
        <section className="py-24 lg:py-32 border-b border-foreground/10">
          <SectionHeader num="05" title="Részletes bontás" subtitle="Városok és legnépszerűbb oldalak" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top cities */}
            <div className="border border-foreground/10 rounded-lg p-6 lg:p-8">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-6">
                Top városok
              </span>
              <div className="space-y-4">
                {cities.map((c, i) => (
                  <HorizontalBar key={c.city} label={c.city} value={c.count} max={maxCityCount} delay={i * 60} />
                ))}
              </div>
            </div>

            {/* Top pages table */}
            <div className="border border-foreground/10 rounded-lg p-6 lg:p-8">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-6">
                Top oldalak
              </span>
              <div className="space-y-0">
                {activeTopPages.map((p, i) => (
                  <div key={`${p.host}${p.path}`}
                    className="flex items-center gap-4 py-3 border-b border-foreground/5 last:border-0">
                    <span className="font-mono text-xs text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{PAGE_LABELS[p.host] || p.host}</p>
                      <p className="text-xs text-muted-foreground truncate font-mono">{p.path}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm">{p.pageviews.toLocaleString("hu-HU")}</p>
                      <p className="text-xs text-muted-foreground">{p.visitors.toLocaleString("hu-HU")} lat.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =============== Section 06 — Egyedi események =============== */}
        {activeEvents.length > 0 && (
          <section className="py-24 lg:py-32 border-b border-foreground/10">
            <SectionHeader num="06" title="Egyedi események" subtitle="CTA kattintások és interakciók" />

            <div className="space-y-4">
              {activeEvents.map((e, i) => (
                <HorizontalBar key={e.event} label={e.event} value={e.count} max={maxEventCount} delay={i * 60} />
              ))}
            </div>
          </section>
        )}

        {/* =============== Footer =============== */}
        <footer className="py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="font-display text-lg tracking-tight">Expert Flow</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            PostHog Analytics Dashboard — 2026
          </p>
        </footer>
      </main>
    </div>
  );
}

// ============================================================
// Page bar row — Landing Design feature card pattern (numbered)
// ============================================================

function PageBarRow({
  number,
  label,
  tag,
  pageviews,
  visitors,
  percentage,
  delay,
  highlighted = false,
}: {
  number: string;
  label: string;
  tag: string;
  pageviews: number;
  visitors: number;
  percentage: number;
  delay: number;
  highlighted?: boolean;
}) {
  const { ref, isVisible } = useInView(0.2);

  return (
    <div
      ref={ref}
      className={`flex flex-col lg:flex-row gap-4 lg:gap-8 py-8 lg:py-12 border-b border-foreground/10 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${highlighted ? "bg-foreground/5 px-6 -mx-6 rounded-lg" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Number */}
      <div className="shrink-0 w-12">
        <span className="font-mono text-sm text-muted-foreground">{number}</span>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-baseline gap-3 mb-4">
          <h3 className="text-2xl lg:text-3xl font-display">{label}</h3>
          <span className="font-mono text-xs text-muted-foreground px-2 py-0.5 border border-foreground/10 rounded-lg">{tag}</span>
        </div>

        {/* Bar */}
        <div className="h-2 rounded-full bg-foreground/5 overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-1000 ease-out"
            style={{
              width: isVisible ? `${percentage}%` : "0%",
              transitionDelay: `${delay + 200}ms`,
            }}
          />
        </div>

        <div className="flex gap-8">
          <div>
            <span className="font-mono text-2xl">{pageviews.toLocaleString("hu-HU")}</span>
            <span className="text-sm text-muted-foreground ml-2">megtekintés</span>
          </div>
          <div>
            <span className="font-mono text-2xl">{visitors.toLocaleString("hu-HU")}</span>
            <span className="text-sm text-muted-foreground ml-2">látogató</span>
          </div>
        </div>
      </div>
    </div>
  );
}
