"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  ExternalLink,
  Eye,
  GitBranch,
  Globe2,
  LayoutDashboard,
  Monitor,
  Moon,
  MousePointer2,
  Plug,
  Smartphone,
  Sun,
  Tablet,
  Users,
  Zap,
} from "lucide-react";
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

const number = (value: number) =>
  value.toLocaleString("hu-HU", { useGrouping: true });
const percent = (value: number) =>
  `${value.toLocaleString("hu-HU", { maximumFractionDigits: 1 })}%`;
const labels: Record<string, string> = {
  "businessnative.hu": "Főoldal",
  "businessnative.hu/tudastar": "Tudástár",
  "businessnative.hu/ai-diagnozis": "AI-diagnózis",
  "businessnative.hu/arak": "Árak",
};
const navigation = [
  { id: "attekintes", label: "Áttekintés", icon: LayoutDashboard },
  { id: "forgalom", label: "Forgalom", icon: BarChart3 },
  { id: "funnel", label: "Funnel", icon: GitBranch },
  { id: "oldalak", label: "Oldalak", icon: Globe2 },
  { id: "reszletek", label: "Közönség", icon: Users },
  { id: "esemenyek", label: "Események", icon: MousePointer2 },
  { id: "meroeszkozok", label: "Mérőeszközök", icon: Plug },
];
const funnel = [
  { label: "Weboldal-látogatás", short: "Látogatás", value: 2400 },
  { label: "AI-diagnózis kitöltve", short: "AI-diagnózis", value: 640 },
  { label: "Email-kurzus feliratkozás", short: "Feliratkozás", value: 210 },
  { label: "A 7. levélig eljutott", short: "Kurzus vége", value: 96 },
  { label: "Konzultáció lefoglalva", short: "Konzultáció", value: 34 },
];
const eventLabels: Record<string, string> = {
  cta_click: "CTA-kattintás",
  section_view: "Szekció megtekintése",
  pricing_view: "Árak megtekintése",
  form_start: "Űrlap megkezdése",
  form_submit: "Űrlap elküldése",
  video_play: "Videó indítása",
  scroll_75: "75%-os görgetés",
  social_click: "Közösségi link",
  faq_open: "GYIK megnyitása",
  testimonial_view: "Vélemény megtekintése",
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
  sourcesByPage: Record<string, TrafficSource[]>;
  devicesByPage: Record<string, DeviceData[]>;
  browsersByPage: Record<string, BrowserData[]>;
  eventsByPage: Record<string, EventData[]>;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme === "dark";
  return (
    <button
      className="icon-button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Világos mód bekapcsolása" : "Sötét mód bekapcsolása"}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values),
    range = Math.max(...values) - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 110},${32 - ((v - min) / range) * 26}`,
    )
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 110 38" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrafficChart({
  data,
  metric,
}: {
  data: DailyData[];
  metric: "pageviews" | "visitors";
}) {
  const id = useId().replace(/:/g, "");
  const [hovered, setHovered] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const labelInterval = Math.max(
    1,
    Math.ceil(data.length / (width < 500 ? 3 : 5)),
  );
  const height = 230,
    left = 38,
    right = 12,
    top = 16,
    bottom = 30;
  const innerW = width - left - right,
    innerH = height - top - bottom;
  const max = Math.ceil(Math.max(...data.map((d) => d[metric]), 1) / 100) * 100;
  const point = (d: DailyData, i: number) => ({
    x: left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: top + innerH * (1 - d[metric] / max),
  });
  const points = data.map(point);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const selected = hovered === null ? null : data[hovered];
  return (
    <div className="traffic-chart" ref={container}>
      <div className="chart-readout" aria-live="polite">
        {selected
          ? `${selected.date} · ${number(selected[metric])} ${metric === "pageviews" ? "megtekintés" : "látogató"}`
          : "Napi bontás · a részletekhez mutass a grafikonra"}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${id}-title`}
        onMouseLeave={() => setHovered(null)}
      >
        <title
          id={`${id}-title`}
        >{`${metric === "pageviews" ? "Oldalmegtekintések" : "Látogatók"} napi alakulása, ${data.length} nap mintaadatai`}</title>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--plot)" stopOpacity=".24" />
            <stop offset="100%" stopColor="var(--plot)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={left}
              x2={width - right}
              y1={top + innerH * ratio}
              y2={top + innerH * ratio}
              className="chart-gridline"
            />
            <text
              x={left - 10}
              y={top + innerH * ratio + 4}
              textAnchor="end"
              className="chart-label"
            >
              {Math.round(max * (1 - ratio))}
            </text>
          </g>
        ))}
        {points.length > 0 && (
          <>
            <path
              d={`${path} L${points[points.length - 1].x},${height - bottom} L${left},${height - bottom} Z`}
              fill={`url(#${id})`}
            />
            <path
              d={path}
              fill="none"
              stroke="var(--plot)"
              strokeWidth="2.3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {data.map(
          (d, i) =>
            ((i % labelInterval === 0 && i < data.length - labelInterval / 2) ||
              i === data.length - 1) && (
              <text
                key={d.date}
                x={points[i].x}
                y={height - 5}
                textAnchor={
                  i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"
                }
                className="chart-label"
              >
                {d.date.slice(5).replace("-", ". ") + "."}
              </text>
            ),
        )}
        {selected && hovered !== null && (
          <g>
            <line
              x1={points[hovered].x}
              x2={points[hovered].x}
              y1={top}
              y2={height - bottom}
              stroke="var(--plot)"
              strokeDasharray="3 4"
              opacity=".5"
            />
            <circle
              cx={points[hovered].x}
              cy={points[hovered].y}
              r="4"
              fill="var(--plot)"
            />
          </g>
        )}
        <rect
          x={left}
          y={top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={(event) => {
            const bounds =
              event.currentTarget.ownerSVGElement!.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / bounds.width) * width;
            setHovered(
              Math.max(
                0,
                Math.min(
                  data.length - 1,
                  Math.round(((x - left) / innerW) * (data.length - 1)),
                ),
              ),
            );
          }}
        />
      </svg>
      <details className="chart-data">
        <summary>Napi adatok táblázatban</summary>
        <div className="table-scroll">
          <table>
            <caption>A grafikon napi mintaadatai</caption>
            <thead>
              <tr>
                <th scope="col">Dátum</th>
                <th scope="col">Megtekintések</th>
                <th scope="col">Látogatók</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{number(d.pageviews)}</td>
                  <td>{number(d.visitors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Bars({
  rows,
  suffix = "",
}: {
  rows: { label: string; value: number }[];
  suffix?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="bar-list">
      {rows.map((row, i) => (
        <div className="bar-item" key={row.label}>
          <div className="bar-label">
            <span>
              <span className="row-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              {row.label}
            </span>
            <span className="numeric">
              {number(row.value)}
              {suffix}
            </span>
          </div>
          <div className="bar-track">
            <div style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
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
  const [selectedPage, setSelectedPage] = useState("all");
  const [metric, setMetric] = useState<"pageviews" | "visitors">("pageviews");
  const [activeSection, setActiveSection] = useState("attekintes");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < 30) {
          setActiveSection("attekintes");
          return;
        }
        for (const entry of entries)
          if (entry.isIntersecting) setActiveSection(entry.target.id);
      },
      { rootMargin: "-15% 0px -60% 0px" },
    );
    navigation.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);
  const filtered = selectedPage !== "all";
  const activeSources = filtered
    ? (sourcesByPage[selectedPage] ?? [])
    : sources;
  const activeDevices = filtered
    ? (devicesByPage[selectedPage] ?? [])
    : devices;
  const activeBrowsers = filtered
    ? (browsersByPage[selectedPage] ?? [])
    : browsers;
  const activeEvents = filtered ? (eventsByPage[selectedPage] ?? []) : events;
  const activeTopPages = filtered
    ? topPages.filter((p) => p.host === selectedPage)
    : topPages;
  const scope = filtered
    ? (labels[selectedPage] ?? selectedPage)
    : "Összes oldal";
  const dateRange = daily.length
    ? `${daily[0].date.replaceAll("-", ". ")}. – ${daily[daily.length - 1].date.slice(5).replace("-", ". ")}.`
    : "Nincs adat";
  const sortedPages = [...pages].sort((a, b) => b.pageviews - a.pageviews);
  const totalDevices = activeDevices.reduce((sum, d) => sum + d.count, 0);
  const metrics = [
    {
      label: "Oldalmegtekintés",
      value: number(overview.totalPageviews),
      caption: `${daily.length} nap összesen`,
      icon: Eye,
      series: daily.slice(-14).map((d) => d.pageviews),
    },
    {
      label: "Látogató",
      value: number(overview.totalVisitors),
      caption: "A mintaadatok alapján",
      icon: Users,
      series: daily.slice(-14).map((d) => d.visitors),
    },
    {
      label: "Munkamenet",
      value: number(overview.totalSessions),
      caption: "Összesített mintaérték",
      icon: MousePointer2,
      series: daily.slice(-14).map((d) => Math.round(d.pageviews * 0.54)),
    },
    {
      label: "Átlagos munkamenet",
      value: `${Math.floor(overview.avgSessionDuration / 60)}:${String(overview.avgSessionDuration % 60).padStart(2, "0")}`,
      caption: `${percent(overview.bounceRate)} visszafordulás`,
      icon: Clock3,
      series: [],
    },
  ];
  const largestDrop = funnel
    .slice(1)
    .map((step, i) => ({
      from: funnel[i].short,
      to: step.short,
      loss: 1 - step.value / funnel[i].value,
    }))
    .sort((a, b) => b.loss - a.loss)[0];

  return (
    <div className="analytics-app">
      <a className="skip-link" href="#attekintes">
        Ugrás a tartalomra
      </a>
      <aside className="sidebar" aria-label="Oldalsáv">
        <a
          href="#attekintes"
          className="brand"
          aria-label="Business Native – áttekintés"
        >
          <span>
            business native
            <span className="brand-subtitle">ANALITIKAI RUTIN</span>
          </span>
        </a>
        <div className="workspace-card">
          <span className="workspace-icon">
            <Globe2 size={16} />
          </span>
          <div>
            <strong>businessnative.hu</strong>
            <span>Saját weboldal · demo</span>
          </div>
        </div>
        <p className="nav-label">MUNKATERÜLET</p>
        <nav className="side-nav" aria-label="Dashboard navigáció">
          {navigation.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-label={label}
              aria-current={activeSection === id ? "location" : undefined}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "funnel" && <span className="nav-count">05</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="status-dot" />
            <strong>Demo munkaterület</strong>
            <p>Ismerd meg a számok mögötti történetet, mintaadatokkal.</p>
          </div>
          <a
            href="https://businessnative.hu"
            target="_blank"
            rel="noreferrer"
            className="website-link"
          >
            A Business Native oldala <ExternalLink size={14} />
          </a>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <a href="#attekintes" className="brand compact-brand">
            <span>
              business native
              <span className="brand-subtitle">ANALITIKAI RUTIN</span>
            </span>
          </a>
          <div className="breadcrumb">
            Munkaterület <span>/</span> <strong>Analitika</strong>
          </div>
          <div className="topbar-actions">
            <span className="sample-badge">
              <span /> Mintaadatok
            </span>
            <ThemeToggle />
            <span className="avatar" aria-label="Business Native munkaterület">
              BN
            </span>
          </div>
        </header>
        <main className="dashboard-main">
          <section id="attekintes" aria-labelledby="overview-title">
            <div className="page-heading">
              <div>
                <p className="eyebrow">KEVESEBB TALÁLGATÁS. TÖBB RÁLÁTÁS.</p>
                <h1 id="overview-title">
                  Minden fontos szám.
                  <br className="mobile-break" /> Egy helyen<span>.</span>
                </h1>
                <p className="page-description">
                  Honnan érkeznek, merre mennek, hol akadnak el a látogatóid.
                </p>
              </div>
              <div className="date-chip">
                <CalendarDays size={15} />
                <span>{dateRange}</span>
              </div>
            </div>
            <div className="demo-notice">
              <span className="status-dot" />
              <span>
                Ez egy <strong>mintaadatokkal feltöltött előnézet</strong>, nem
                élő mérés.
              </span>
              <span className="notice-period">
                {daily.length} nap · {pages.length} oldal
              </span>
            </div>
            <div className="metric-grid">
              {metrics.map(
                ({ label, value, caption, icon: Icon, series }, index) => (
                  <article
                    className={`metric-card ${index === 0 ? "featured" : ""}`}
                    key={label}
                  >
                    <div className="metric-label">
                      {label}
                      <Icon size={16} />
                    </div>
                    <div className="metric-value numeric">{value}</div>
                    <div className="metric-bottom">
                      <span>{caption}</span>
                      {series.length > 0 && <Sparkline values={series} />}
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>

          <section
            id="forgalom"
            className="overview-grid"
            aria-label="Forgalom áttekintése"
          >
            <article className="panel traffic-panel">
              <PanelHeading
                eyebrow="A FORGALOM RITMUSA"
                title="Így alakult a látogatottság"
              >
                <span className="quiet-badge">Összes oldal</span>
              </PanelHeading>
              <div className="chart-toolbar">
                <div className="segmented" aria-label="Grafikon mutatója">
                  <button
                    aria-pressed={metric === "pageviews"}
                    onClick={() => setMetric("pageviews")}
                  >
                    Megtekintések
                  </button>
                  <button
                    aria-pressed={metric === "visitors"}
                    onClick={() => setMetric("visitors")}
                  >
                    Látogatók
                  </button>
                </div>
                <span className="chart-total numeric">
                  {number(daily.reduce((sum, d) => sum + d[metric], 0))}
                  <span> / {daily.length} nap</span>
                </span>
              </div>
              <TrafficChart data={daily} metric={metric} />
            </article>
            <article className="panel source-panel">
              <PanelHeading
                eyebrow="ELSŐ TALÁLKOZÁS"
                title="Honnan érkeznek?"
              />
              <p className="panel-description">
                Forgalmi források · összes oldal
              </p>
              <div className="source-list">
                {sources.map((source, i) => (
                  <div className="source-row" key={source.source}>
                    <span className={`source-icon source-${i}`}>
                      {source.source === "Direct" ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        source.source.slice(0, 1)
                      )}
                    </span>
                    <div className="source-content">
                      <div>
                        <span>
                          {source.source === "Direct"
                            ? "Közvetlen"
                            : source.source}
                        </span>
                        <strong className="numeric">
                          {percent(source.percentage)}
                        </strong>
                      </div>
                      <div className="bar-track">
                        <div style={{ width: `${source.percentage}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="panel-footnote">
                A minta forgalmi megoszlása <ArrowUpRight size={14} />
              </div>
            </article>
          </section>

          <section
            id="funnel"
            className="panel funnel-panel"
            aria-label="Konverziós funnel"
          >
            <PanelHeading
              eyebrow="LÁTOGATÓBÓL ÉRDEKLŐDŐ"
              title="Az út a konzultációig"
            >
              <span className="quiet-badge">Önálló mintafolyamat</span>
            </PanelHeading>
            <div className="funnel-grid">
              {funnel.map((step, i) => (
                <div className="funnel-step" key={step.label}>
                  <div className="funnel-step-top">
                    <span className="step-number">0{i + 1}</span>
                    {i > 0 && (
                      <span className="step-conversion numeric">
                        {percent((step.value / funnel[i - 1].value) * 100)}{" "}
                        továbbjutott
                      </span>
                    )}
                  </div>
                  <div className="funnel-value numeric">
                    {number(step.value)}
                  </div>
                  <div className="funnel-label">{step.label}</div>
                  <div className="funnel-bar-space">
                    <div
                      className="funnel-column"
                      style={{
                        height: `${Math.max((step.value / funnel[0].value) * 100, 6)}%`,
                      }}
                    />
                  </div>
                  {i < funnel.length - 1 && (
                    <ArrowRight className="funnel-arrow" size={15} />
                  )}
                </div>
              ))}
            </div>
            <div className="funnel-note">
              <span className="insight-icon">
                <Zap size={16} />
              </span>
              <p>
                <strong>Itt érdemes közelebbről megnézni.</strong> A legnagyobb
                lemorzsolódás a{" "}
                <span>
                  {largestDrop.from} → {largestDrop.to}
                </span>{" "}
                lépésnél látszik:{" "}
                <strong>{percent(largestDrop.loss * 100)}</strong>. A fenti
                értékek külön funnel-mintaadatok.
              </p>
              <span className="funnel-rate">
                <strong className="numeric">
                  {percent(
                    (funnel[funnel.length - 1].value / funnel[0].value) * 100,
                  )}
                </strong>
                <span>teljes konverzió</span>
              </span>
            </div>
          </section>

          <section
            id="oldalak"
            className="panel"
            aria-label="Oldalak teljesítménye"
          >
            <PanelHeading
              eyebrow="MI KÖTI LE A FIGYELMET?"
              title="Oldalaid egy pillantásra"
            >
              <span className="quiet-badge">{pages.length} oldal</span>
            </PanelHeading>
            <div className="table-scroll">
              <table className="pages-table">
                <caption>
                  Oldalak összesített mintaadatai a teljes időszakban
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Oldal</th>
                    <th scope="col">
                      Megtekintés <ArrowDown size={11} />
                    </th>
                    <th scope="col">Látogató</th>
                    <th scope="col">Forgalmi arány</th>
                    <th scope="col">Részletek</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.map((page, i) => (
                    <tr
                      key={page.page}
                      className={
                        selectedPage === page.page ? "selected-row" : ""
                      }
                    >
                      <td>
                        <div className="page-cell">
                          <span className="page-index">0{i + 1}</span>
                          <div>
                            <strong>{labels[page.page] ?? page.page}</strong>
                            <span>
                              {page.page === "businessnative.hu"
                                ? "/"
                                : page.page.replace("businessnative.hu", "")}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="numeric">{number(page.pageviews)}</td>
                      <td className="numeric muted">{number(page.visitors)}</td>
                      <td>
                        <div className="share-cell">
                          <div className="bar-track">
                            <div
                              style={{
                                width: `${(page.pageviews / Math.max(overview.totalPageviews, 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="numeric">
                            {percent(
                              (page.pageviews /
                                Math.max(overview.totalPageviews, 1)) *
                                100,
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <a
                          className="icon-button row-action"
                          href="#reszletek"
                          aria-label={`${labels[page.page] ?? page.page} részletei`}
                          onClick={() => setSelectedPage(page.page)}
                        >
                          <ArrowUpRight size={16} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="reszletek"
            className="detail-section"
            aria-labelledby="details-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">EGY SZINTTEL MÉLYEBBEN</p>
                <h2 id="details-title">Ismerd meg a közönséged</h2>
              </div>
              <div className="select-wrap">
                <label htmlFor="page-filter">Részletek szűrése</label>
                <div>
                  <select
                    id="page-filter"
                    value={selectedPage}
                    onChange={(event) => setSelectedPage(event.target.value)}
                  >
                    <option value="all">Összes oldal</option>
                    {pages.map((page) => (
                      <option key={page.page} value={page.page}>
                        {labels[page.page] ?? page.page}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
            <p className="scope-note" aria-live="polite">
              {scope} · a szűrő az alábbi forrásokra, eszközökre, böngészőkre,
              aloldalakra és eseményekre vonatkozik.
            </p>
            <div className="three-grid">
              <article className="panel">
                <PanelHeading title="Forgalmi források" />
                <Bars
                  rows={activeSources.map((s) => ({
                    label: s.source,
                    value: s.count,
                  }))}
                />
              </article>
              <article className="panel">
                <PanelHeading title="Eszközök" />
                <div
                  className="device-distribution"
                  role="img"
                  aria-label={activeDevices
                    .map(
                      (d) =>
                        `${d.device}: ${percent(totalDevices ? (d.count / totalDevices) * 100 : 0)}`,
                    )
                    .join(", ")}
                >
                  {activeDevices.map((device, i) => (
                    <div
                      key={device.device}
                      className={`device-segment device-${i}`}
                      style={{
                        width: `${totalDevices ? (device.count / totalDevices) * 100 : 0}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="device-list">
                  {activeDevices.map((device, i) => {
                    const Icon =
                      device.device === "Mobile"
                        ? Smartphone
                        : device.device === "Tablet"
                          ? Tablet
                          : Monitor;
                    return (
                      <div key={device.device}>
                        <span className={`device-icon device-${i}`}>
                          <Icon size={16} />
                        </span>
                        <span>
                          {device.device === "Desktop"
                            ? "Asztali gép"
                            : device.device === "Mobile"
                              ? "Mobil"
                              : "Tablet"}
                        </span>
                        <strong className="numeric">
                          {percent(
                            totalDevices
                              ? (device.count / totalDevices) * 100
                              : 0,
                          )}
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <p className="panel-description device-caption">
                  Az oldalmegtekintések megoszlása.
                </p>
              </article>
              <article className="panel">
                <PanelHeading title="Böngészők" />
                <Bars
                  rows={activeBrowsers.map((b) => ({
                    label: b.browser,
                    value: b.count,
                  }))}
                />
              </article>
            </div>
            <div className="two-grid">
              <article className="panel">
                <PanelHeading title="Városok">
                  <span className="quiet-badge">Mindig összes oldal</span>
                </PanelHeading>
                <Bars
                  rows={cities.map((c) => ({ label: c.city, value: c.count }))}
                />
              </article>
              <article className="panel">
                <PanelHeading title="Népszerű aloldalak">
                  <span className="quiet-badge">{scope}</span>
                </PanelHeading>
                <div className="subpage-list">
                  {activeTopPages.length ? (
                    activeTopPages.map((page, i) => (
                      <div key={`${page.host}${page.path}`}>
                        <span className="row-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{labels[page.host] ?? page.host}</strong>
                          <span>{page.path}</span>
                        </div>
                        <span className="numeric">
                          {number(page.pageviews)}
                          <small>{number(page.visitors)} látogató</small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">
                      Ehhez az oldalhoz nincs aloldaladat.
                    </p>
                  )}
                </div>
              </article>
            </div>
          </section>

          <section id="esemenyek" className="panel" aria-label="Események">
            <PanelHeading
              eyebrow="A KATTINTÁS MÖGÖTT"
              title="Mit csinálnak a látogatók?"
            >
              <span className="quiet-badge">{scope}</span>
            </PanelHeading>
            {activeEvents.length ? (
              <div className="events-grid">
                {activeEvents.map((event) => (
                  <div className="event-row" key={event.event}>
                    <MousePointer2 size={15} />
                    <div>
                      <strong>{eventLabels[event.event] ?? event.event}</strong>
                      <span>{event.event}</span>
                    </div>
                    <span className="numeric">{number(event.count)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                Ehhez az oldalhoz még nincs eseményadat.
              </p>
            )}
          </section>

          <section
            id="meroeszkozok"
            className="integrations-section"
            aria-labelledby="integrations-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">AZ ADATOK HELYE</p>
                <h2 id="integrations-title">Tervezett mérőeszközök</h2>
              </div>
              <span className="quiet-badge">Még nincsenek összekötve</span>
            </div>
            <div className="two-grid">
              {[
                {
                  name: "Google Analytics",
                  letter: "G",
                  description: "Részletes forgalmi és viselkedési adatok.",
                },
                {
                  name: "Plausible",
                  letter: "P",
                  description: "Gyors áttekintés, süti nélküli méréssel.",
                },
              ].map((tool) => (
                <article className="integration-card" key={tool.name}>
                  <span className="integration-icon">{tool.letter}</span>
                  <div>
                    <h3>{tool.name}</h3>
                    <p>{tool.description}</p>
                  </div>
                  <span className="quiet-badge">Tervezett</span>
                </article>
              ))}
            </div>
          </section>
          <footer className="dashboard-footer">
            <span>
              business native<span className="brand-dot">.</span>
            </span>
            <span>Analitikai rutin · illusztratív adatok</span>
            <a href="#attekintes">Vissza az áttekintéshez ↑</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
