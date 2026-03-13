"use client";

import { motion } from "framer-motion";
import { StatCard } from "./StatCard";
import { AnimatedCard } from "./AnimatedCard";
import { BarChart } from "./BarChart";
import { ProgressBar } from "./ProgressBar";
import { DonutChart } from "./DonutChart";
import { MiniLineChart } from "./MiniLineChart";
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

const PAGE_COLORS: Record<string, string> = {
  "expertflow-ugyfelszerzes.vercel.app": "#33AAFF",
  "expertflow-ugyfelkezeles.vercel.app": "#22C55E",
  "expertflow-hattermukodes.vercel.app": "#8B5CF6",
  "ai-ready-kurzus.vercel.app": "#F59E0B",
};

const PAGE_LABELS: Record<string, string> = {
  "expertflow-ugyfelszerzes.vercel.app": "Ügyfélszerzés",
  "expertflow-ugyfelkezeles.vercel.app": "Ügyfélkezelés",
  "expertflow-hattermukodes.vercel.app": "Háttérműködés",
  "ai-ready-kurzus.vercel.app": "AI Ready",
};

const DEVICE_ICONS: Record<string, string> = {
  Desktop: "🖥",
  Mobile: "📱",
  Tablet: "📋",
  Unknown: "❓",
};

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
}

export function Dashboard({ overview, pages, daily, sources, devices, browsers, cities, topPages, events }: DashboardProps) {
  const maxSourceCount = Math.max(...sources.map((s) => s.count), 1);
  const maxCityCount = Math.max(...cities.map((c) => c.count), 1);
  const dailyPvs = daily.map((d) => d.pageviews);

  const donutData = pages
    .filter((p) => PAGE_LABELS[p.page])
    .map((p) => ({
      label: PAGE_LABELS[p.page] || p.page,
      value: p.pageviews,
      color: PAGE_COLORS[p.page] || "#666",
    }));

  const deviceDonut = devices.map((d, i) => ({
    label: d.device,
    value: d.count,
    color: ["#33AAFF", "#22C55E", "#8B5CF6", "#F59E0B", "#EF4444"][i % 5],
  }));

  return (
    <div className="min-h-screen bg-(--color-bg-primary) grid-bg">
      {/* Header */}
      <header className="border-b border-(--color-border) bg-(--color-bg-primary)/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ background: "linear-gradient(135deg, #33AAFF, #4700DE)" }}
            >
              EF
            </motion.div>
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-lg font-bold tracking-tight"
              >
                Expert Flow Analytics
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Landing Page Performance Dashboard
              </motion.p>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-(--color-success) pulse-dot" />
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Utolsó 30 nap
            </span>
          </motion.div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">
        {/* Overview Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Oldalmegtekintések" value={overview.totalPageviews} icon="👁" color="#33AAFF" delay={0} />
          <StatCard label="Egyedi látogatók" value={overview.totalVisitors} icon="👤" color="#22C55E" delay={0.1} />
          <StatCard label="Munkamenetek" value={overview.totalSessions} icon="🔄" color="#8B5CF6" delay={0.2} />
          <StatCard
            label="Landing oldalak"
            value={pages.filter((p) => PAGE_LABELS[p.page]).length}
            icon="📄"
            color="#F59E0B"
            delay={0.3}
          />
        </section>

        {/* Traffic Trend + Page Distribution */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <AnimatedCard delay={0.2} className="lg:col-span-3">
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Forgalom trend
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
              Napi oldalmegtekintések az elmúlt 30 napban
            </p>
            <MiniLineChart data={dailyPvs} height={140} />
            <div className="flex justify-between mt-2 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              <span>{daily[0]?.date || ""}</span>
              <span>{daily[daily.length - 1]?.date || ""}</span>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.3} className="lg:col-span-2">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Oldal eloszlás
            </h3>
            <DonutChart data={donutData} delay={0.4} />
          </AnimatedCard>
        </section>

        {/* Per-page performance bars */}
        <AnimatedCard delay={0.35}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Landing oldal teljesítmény
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pages
              .filter((p) => PAGE_LABELS[p.page])
              .map((p, i) => (
                <motion.div
                  key={p.page}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--color-bg-secondary)",
                    border: `1px solid ${PAGE_COLORS[p.page]}33`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: PAGE_COLORS[p.page] }} />
                    <span className="text-sm font-medium">{PAGE_LABELS[p.page]}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                    <span>Megtekintések</span>
                    <span className="font-bold text-(--color-text-primary)">{p.pageviews}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-primary)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(p.pageviews / Math.max(...pages.map((x) => x.pageviews), 1)) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ background: PAGE_COLORS[p.page] }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                    <span>Látogatók</span>
                    <span className="font-bold text-(--color-text-primary)">{p.visitors}</span>
                  </div>
                </motion.div>
              ))}
          </div>
        </AnimatedCard>

        {/* Traffic Sources + Devices + Browsers */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AnimatedCard delay={0.4}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Forgalmi források
            </h3>
            <div className="space-y-3">
              {sources.slice(0, 6).map((s, i) => (
                <ProgressBar
                  key={s.source}
                  label={s.source}
                  value={s.count}
                  max={maxSourceCount}
                  color={["#33AAFF", "#22C55E", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"][i % 6]}
                  delay={0.5 + i * 0.05}
                  suffix={` (${s.percentage}%)`}
                />
              ))}
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.45}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Eszközök
            </h3>
            <DonutChart data={deviceDonut} size={140} delay={0.5} />
          </AnimatedCard>

          <AnimatedCard delay={0.5}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Böngészők
            </h3>
            <BarChart
              data={browsers.slice(0, 6).map((b, i) => ({
                label: b.browser,
                value: b.count,
                color: ["#33AAFF", "#22C55E", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"][i % 6],
              }))}
              delay={0.55}
            />
          </AnimatedCard>
        </section>

        {/* Cities + Top Pages */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatedCard delay={0.55}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Top városok
            </h3>
            <div className="space-y-2.5">
              {cities.slice(0, 8).map((c, i) => (
                <ProgressBar
                  key={c.city}
                  label={`${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "}  ${c.city}`}
                  value={c.count}
                  max={maxCityCount}
                  color="#33AAFF"
                  delay={0.6 + i * 0.04}
                />
              ))}
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.6}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Top oldalak
            </h3>
            <div className="space-y-2">
              {topPages.slice(0, 8).map((p, i) => (
                <motion.div
                  key={`${p.host}${p.path}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.65 + i * 0.04 }}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg"
                  style={{ background: i % 2 === 0 ? "var(--color-bg-secondary)" : "transparent" }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: PAGE_COLORS[p.host] || "#666" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{PAGE_LABELS[p.host] || p.host}</p>
                    <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      {p.path}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums">{p.pageviews}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {p.visitors} látogató
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedCard>
        </section>

        {/* Custom Events */}
        {events.length > 0 && (
          <AnimatedCard delay={0.65}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Egyedi események
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {events.slice(0, 10).map((e, i) => (
                <motion.div
                  key={e.event}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.04 }}
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p className="text-xl font-bold tabular-nums">{e.count}</p>
                  <p className="text-xs mt-1 truncate" style={{ color: "var(--color-text-muted)" }} title={e.event}>
                    {e.event}
                  </p>
                </motion.div>
              ))}
            </div>
          </AnimatedCard>
        )}

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center py-8 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          Expert Flow Analytics — PostHog powered
        </motion.footer>
      </main>
    </div>
  );
}
