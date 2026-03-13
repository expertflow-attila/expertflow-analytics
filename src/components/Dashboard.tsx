"use client";

import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
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
  "expertflow-ugyfelszerzes.vercel.app": "#E8E8E8",
  "expertflow-ugyfelkezeles.vercel.app": "#10B981",
  "expertflow-hattermukodes.vercel.app": "#8B5CF6",
  "ai-ready-kurzus.vercel.app": "#F59E0B",
};

const PAGE_LABELS: Record<string, string> = {
  "expertflow-ugyfelszerzes.vercel.app": "Ügyfélszerzés",
  "expertflow-ugyfelkezeles.vercel.app": "Ügyfélkezelés",
  "expertflow-hattermukodes.vercel.app": "Háttérműködés",
  "ai-ready-kurzus.vercel.app": "AI Ready Kurzus",
};

function SectionHeader({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className="mb-8"
    >
      <span className="num-label block mb-2">{num}</span>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>
      )}
    </motion.div>
  );
}

function ParallaxHeader() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <motion.header ref={ref} className="relative pt-24 pb-20 overflow-hidden" style={{ y, opacity }}>
      <div className="absolute inset-0 dot-grid opacity-30" />
      <div className="max-w-[1200px] mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="tag mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-(--color-success) pulse-soft" />
            Élő adatok
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] gradient-text max-w-xl">
            Analytics
          </h1>
          <p className="text-base mt-4 max-w-md leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Landing page teljesítmény és látogatói viselkedés valós időben. Minden adat, egy helyen.
          </p>
        </motion.div>
      </div>
    </motion.header>
  );
}

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
      color: PAGE_COLORS[p.page] || "#555",
    }));

  const deviceDonut = devices.map((d, i) => ({
    label: d.device,
    value: d.count,
    color: ["#E8E8E8", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"][i % 5],
  }));

  const sourceColors = ["#E8E8E8", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"];

  return (
    <div className="min-h-screen">
      {/* Sticky nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-(--color-border)">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold tracking-tight"
              style={{ background: "var(--color-text-primary)", color: "var(--color-bg-primary)" }}>
              EF
            </div>
            <span className="text-sm font-semibold tracking-tight">Expert Flow</span>
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>/</span>
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Analytics</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-(--color-success) pulse-soft" />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Utolsó 30 nap</span>
          </motion.div>
        </div>
      </nav>

      {/* Hero */}
      <ParallaxHeader />

      <main className="max-w-[1200px] mx-auto px-6 pb-24 space-y-20">
        {/* 01 — Overview */}
        <section>
          <SectionHeader num="01" title="Áttekintés" subtitle="Összesített teljesítménymutatók" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Oldalmegtekintés" value={overview.totalPageviews} index={0} accentColor="#E8E8E8" />
            <StatCard label="Egyedi látogató" value={overview.totalVisitors} index={1} accentColor="#10B981" />
            <StatCard label="Munkamenet" value={overview.totalSessions} index={2} accentColor="#8B5CF6" />
            <StatCard
              label="Aktív landing oldal"
              value={pages.filter((p) => PAGE_LABELS[p.page]).length}
              index={3}
              accentColor="#F59E0B"
            />
          </div>
        </section>

        <div className="section-divider" />

        {/* 02 — Traffic Trend */}
        <section>
          <SectionHeader num="02" title="Forgalom trend" subtitle="Napi oldalmegtekintések" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <AnimatedCard className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  MEGTEKINTÉSEK / NAP
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--color-text-dim)" }}>
                  {daily[0]?.date} — {daily[daily.length - 1]?.date}
                </span>
              </div>
              <MiniLineChart data={dailyPvs} height={160} showDots />
            </AnimatedCard>

            <AnimatedCard delay={0.1} className="lg:col-span-2">
              <span className="text-xs font-medium block mb-4" style={{ color: "var(--color-text-muted)" }}>
                OLDAL ELOSZLÁS
              </span>
              <DonutChart data={donutData} />
            </AnimatedCard>
          </div>
        </section>

        <div className="section-divider" />

        {/* 03 — Landing Pages */}
        <section>
          <SectionHeader num="03" title="Landing oldalak" subtitle="Teljesítmény összehasonlítás" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pages
              .filter((p) => PAGE_LABELS[p.page])
              .map((p, i) => {
                const ref = useRef(null);
                const isInView = useInView(ref, { once: true, margin: "-40px" });
                const color = PAGE_COLORS[p.page] || "#555";
                const maxPv = Math.max(...pages.map((x) => x.pageviews), 1);
                return (
                  <motion.div
                    key={p.page}
                    ref={ref}
                    initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                    animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                    transition={{ delay: i * 0.08, duration: 0.6 }}
                    className="card p-5 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 w-full h-px"
                      style={{ background: `linear-gradient(90deg, ${color}60, transparent)` }} />
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[13px] font-medium">{PAGE_LABELS[p.page]}</span>
                    </div>
                    <p className="text-3xl font-bold tabular-nums mb-1">{p.pageviews}</p>
                    <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>megtekintés</p>
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "var(--color-bg-secondary)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={isInView ? { width: `${(p.pageviews / maxPv) * 100}%` } : {}}
                        transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                    <div className="flex justify-between mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      <span>Látogatók</span>
                      <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>{p.visitors}</span>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </section>

        <div className="section-divider" />

        {/* 04 — Sources, Devices, Browsers */}
        <section>
          <SectionHeader num="04" title="Forgalom részletei" subtitle="Források, eszközök, böngészők" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <AnimatedCard>
              <span className="text-xs font-medium block mb-5" style={{ color: "var(--color-text-muted)" }}>
                FORGALMI FORRÁSOK
              </span>
              <div className="space-y-3.5">
                {sources.slice(0, 6).map((s, i) => (
                  <ProgressBar
                    key={s.source}
                    label={s.source}
                    value={s.count}
                    max={maxSourceCount}
                    color={sourceColors[i % 6]}
                    delay={i * 0.06}
                    suffix={` (${s.percentage}%)`}
                  />
                ))}
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.05}>
              <span className="text-xs font-medium block mb-5" style={{ color: "var(--color-text-muted)" }}>
                ESZKÖZÖK
              </span>
              <DonutChart data={deviceDonut} size={140} />
            </AnimatedCard>

            <AnimatedCard delay={0.1}>
              <span className="text-xs font-medium block mb-5" style={{ color: "var(--color-text-muted)" }}>
                BÖNGÉSZŐK
              </span>
              <BarChart
                data={browsers.slice(0, 6).map((b, i) => ({
                  label: b.browser,
                  value: b.count,
                  color: sourceColors[i % 6],
                }))}
              />
            </AnimatedCard>
          </div>
        </section>

        <div className="section-divider" />

        {/* 05 — Geography & Top Pages */}
        <section>
          <SectionHeader num="05" title="Részletes bontás" subtitle="Városok és legnépszerűbb oldalak" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AnimatedCard>
              <span className="text-xs font-medium block mb-5" style={{ color: "var(--color-text-muted)" }}>
                TOP VÁROSOK
              </span>
              <div className="space-y-3">
                {cities.slice(0, 8).map((c, i) => (
                  <ProgressBar
                    key={c.city}
                    label={c.city}
                    value={c.count}
                    max={maxCityCount}
                    color={i === 0 ? "#E8E8E8" : i === 1 ? "#999" : "#555"}
                    delay={i * 0.05}
                  />
                ))}
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.05}>
              <span className="text-xs font-medium block mb-5" style={{ color: "var(--color-text-muted)" }}>
                TOP OLDALAK
              </span>
              <div className="space-y-1">
                {topPages.slice(0, 8).map((p, i) => {
                  const ref = useRef(null);
                  const isInView = useInView(ref, { once: true });
                  return (
                    <motion.div
                      key={`${p.host}${p.path}`}
                      ref={ref}
                      initial={{ opacity: 0, x: -8 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-(--color-bg-card-hover) transition-colors"
                    >
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: PAGE_COLORS[p.host] || "var(--color-text-muted)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] truncate">{PAGE_LABELS[p.host] || p.host}</p>
                        <p className="text-[11px] truncate" style={{ color: "var(--color-text-dim)" }}>{p.path}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-bold tabular-nums">{p.pageviews}</p>
                        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{p.visitors} lát.</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatedCard>
          </div>
        </section>

        {/* 06 — Custom Events */}
        {events.length > 0 && (
          <>
            <div className="section-divider" />
            <section>
              <SectionHeader num="06" title="Egyedi események" subtitle="CTA kattintások és interakciók" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {events.slice(0, 10).map((e, i) => {
                  const ref = useRef(null);
                  const isInView = useInView(ref, { once: true });
                  return (
                    <motion.div
                      key={e.event}
                      ref={ref}
                      initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                      animate={isInView ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
                      transition={{ delay: i * 0.04 }}
                      className="card p-4 text-center group"
                    >
                      <p className="text-2xl font-bold tabular-nums">{e.count}</p>
                      <p className="text-[11px] mt-1.5 truncate" style={{ color: "var(--color-text-muted)" }}
                        title={e.event}>{e.event}</p>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-12 text-center"
        >
          <div className="section-divider mb-8" />
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold"
              style={{ background: "var(--color-text-primary)", color: "var(--color-bg-primary)" }}>EF</div>
            <span className="text-xs font-semibold">Expert Flow</span>
          </div>
          <p className="text-[11px]" style={{ color: "var(--color-text-dim)" }}>
            PostHog Analytics Dashboard — {new Date().getFullYear()}
          </p>
        </motion.footer>
      </main>
    </div>
  );
}
