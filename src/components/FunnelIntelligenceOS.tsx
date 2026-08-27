"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  AlertTriangle, AreaChart, ArrowRight, BarChart3, Beaker, Bell,
  Bot, Boxes, Braces, Check, ChevronDown, CircleDollarSign, Clipboard,
  Code2, Database, Download, FlaskConical, GitBranch, HeartPulse, Lightbulb,
  Menu, Moon, Network, PanelLeftClose, Play, Plus, RefreshCw,
  Route, Search, Send, Settings, ShieldCheck, Sparkles, Sun, Target,
  TrendingDown, TrendingUp, Upload, UserRoundSearch, Users, Webhook,
  type LucideIcon
} from "lucide-react";
import { ReactFlow, Background, Controls, MarkerType, MiniMap, type Edge, type Node } from "@xyflow/react";
import {
  Area, AreaChart as ReAreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  channels, cohorts, experiments as initialExperiments, funnelSteps, journeys,
  opportunities, revenueSeries, trackingIssues
} from "@/lib/demo-data";
import {
  formatCurrency, formatNumber, simulateRevenue, transitionRate,
  type AttributionModel
} from "@/lib/analytics";

type PageId = "overview" | "funnels" | "journeys" | "opportunities" | "attribution" | "cohorts" | "revenue" | "experiments" | "tracking" | "ai" | "integrations" | "settings";

const nav: { section: string; items: { id: PageId; label: string; icon: LucideIcon }[] }[] = [
  { section: "Decide", items: [
    { id: "overview", label: "Overview", icon: AreaChart },
    { id: "funnels", label: "Funnels", icon: GitBranch },
    { id: "journeys", label: "Customer journeys", icon: Route },
    { id: "opportunities", label: "Opportunities", icon: Target }
  ]},
  { section: "Analyze", items: [
    { id: "attribution", label: "Attribution lab", icon: Network },
    { id: "cohorts", label: "Cohorts & LTV", icon: Users },
    { id: "revenue", label: "Revenue", icon: CircleDollarSign },
    { id: "experiments", label: "Experiments", icon: Beaker },
    { id: "tracking", label: "Tracking health", icon: HeartPulse }
  ]},
  { section: "Operate", items: [
    { id: "ai", label: "AI analyst", icon: Sparkles },
    { id: "integrations", label: "Integrations", icon: Boxes },
    { id: "settings", label: "Settings", icon: Settings }
  ]}
];

const pageMeta: Record<PageId, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "Decision center", title: "Know what to fix next.", description: "A calm view of revenue, funnel movement, data quality and the highest-value next action." },
  funnels: { eyebrow: "Live funnel model", title: "See where revenue leaks.", description: "Your planned journey and its observed performance, connected in one interactive canvas." },
  journeys: { eyebrow: "Journey explorer", title: "Follow the path to purchase.", description: "Understand how real people move across channels, content, email, calls and revenue events." },
  opportunities: { eyebrow: "Opportunity engine", title: "Prioritize impact, not drop-off.", description: "Rank funnel improvements by estimated downstream revenue, confidence, reach and effort." },
  attribution: { eyebrow: "Attribution lab", title: "Compare the stories models tell.", description: "Inspect how first-touch, last-touch, linear and U-shaped models distribute revenue." },
  cohorts: { eyebrow: "Customer economics", title: "Find the customers that compound.", description: "Compare acquisition cohorts by CAC, LTV and payback without hiding incomplete windows." },
  revenue: { eyebrow: "Revenue intelligence", title: "Connect activity to money.", description: "Track gross and net revenue, recurring value, refunds and scenario changes." },
  experiments: { eyebrow: "Experiment ledger", title: "Turn insights into measured action.", description: "Record hypotheses and observed changes without claiming causality the data cannot support." },
  tracking: { eyebrow: "Data quality", title: "Know when the numbers deserve trust.", description: "Surface identity gaps, missing source data, reconciliation issues and concrete fixes." },
  ai: { eyebrow: "Tool-using analyst", title: "Ask the data, not a generic chatbot.", description: "The demo analyst uses deterministic analytics tools and always exposes the evidence trace." },
  integrations: { eyebrow: "Data connections", title: "Bring the customer journey together.", description: "Connect browser, server and revenue events through provider-agnostic ingestion points." },
  settings: { eyebrow: "Project settings", title: "Control the analytical contract.", description: "Set currency, timezone, retention, attribution defaults and privacy-oriented behavior." }
};

function PageHeader({ page, actions }: { page: PageId; actions?: React.ReactNode }) {
  const meta = pageMeta[page];
  return <div className="page-head"><div><div className="eyebrow">{meta.eyebrow}</div><h1>{meta.title}</h1><p>{meta.description}</p></div>{actions ? <div className="head-actions">{actions}</div> : null}</div>;
}

function Kpi({ label, value, delta, icon: Icon, direction = "up" }: { label: string; value: string; delta: string; icon: LucideIcon; direction?: "up" | "down" | "neutral" }) {
  return <div className="card kpi"><div className="kpi-top"><span>{label}</span><Icon /></div><div className="kpi-value">{value}</div><div className={`delta ${direction}`}>{direction === "up" ? "↗" : direction === "down" ? "↘" : "—"} {delta}</div></div>;
}

function RevenueChart({ height = 270 }: { height?: number }) {
  return <div className="chart-box" style={{ height }}><ResponsiveContainer width="100%" height="100%"><ReAreaChart data={revenueSeries} margin={{ top: 8, right: 2, left: -16, bottom: 0 }}>
    <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-strong)" stopOpacity={0.22}/><stop offset="100%" stopColor="var(--accent-strong)" stopOpacity={0}/></linearGradient></defs>
    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
    <XAxis dataKey="date" tick={{ fill: "var(--dim)", fontSize: 9 }} axisLine={false} tickLine={false} />
    <YAxis tickFormatter={(v) => `€${v / 1000}k`} tick={{ fill: "var(--dim)", fontSize: 9 }} axisLine={false} tickLine={false} />
    <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="chart-tooltip"><b>{label}</b><br/>{formatCurrency(Number(payload[0].value))}</div> : null} />
    <Area type="monotone" dataKey="previous" stroke="var(--dim)" strokeDasharray="4 5" fill="transparent" strokeWidth={1.2} />
    <Area type="monotone" dataKey="revenue" stroke="var(--accent-strong)" fill="url(#revenueFill)" strokeWidth={2} />
  </ReAreaChart></ResponsiveContainer></div>;
}

function OverviewPage({ navigate }: { navigate: (page: PageId) => void }) {
  return <><PageHeader page="overview" actions={<button className="button" onClick={() => navigate("ai")}><Sparkles/>Ask analyst</button>} />
    <section className="summary-card"><div className="summary-label">Executive summary · last 30 days</div><h2>Revenue is up 8.4%, but Workshop → Application is now the largest recoverable leak.</h2><p>Improving that step from 44.9% to its 52% target is estimated to add €18.6k in monthly revenue. Mobile conversion and a longer application form are the strongest observed drivers. Evidence quality is high.</p></section>
    <div className="kpi-grid"><Kpi label="Net revenue" value="€184.8k" delta="8.4% vs prior" icon={CircleDollarSign}/><Kpi label="Customers" value="42" delta="7.7% vs prior" icon={Users}/><Kpi label="Leads" value="588" delta="5.9% vs prior" icon={UserRoundSearch}/><Kpi label="Visitor → sale" value="0.23%" delta="0.02 pp" icon={GitBranch}/><Kpi label="CAC" value="€487" delta="3.1% lower" icon={Target}/><Kpi label="90-day LTV" value="€6.24k" delta="6.8% vs prior" icon={TrendingUp}/></div>
    <div className="dashboard-grid"><section className="card panel"><div className="panel-head"><div><h3>Revenue movement</h3><p>Net recognized revenue · demo workspace</p></div><div className="legend"><span><i style={{background:"var(--accent-strong)"}}/>Current</span><span><i style={{background:"var(--dim)"}}/>Previous</span></div></div><RevenueChart/></section>
      <section className="card panel"><div className="panel-head"><div><h3>Largest opportunity</h3><p>Ranked by value × confidence × reach ÷ effort</p></div><Target size={17}/></div><div className="opportunity-hero"><strong>Workshop → Application</strong><p>Close the 7.1 percentage-point gap to target.</p><div className="opportunity-value"><div><b>€18.6k</b><div className="panel-kicker">Estimated monthly upside</div></div><span className="confidence">High confidence</span></div></div><ul className="insight-list"><li><TrendingDown/><span>Mobile application rate is 31% below desktop.</span><time>2h</time></li><li><AlertTriangle/><span>Unknown source rose to 11.4% of sessions.</span><time>6h</time></li><li><TrendingUp/><span>YouTube leads have the strongest 90-day LTV.</span><time>1d</time></li></ul><button className="button" style={{marginTop:14}} onClick={() => navigate("opportunities")}>Open opportunity <ArrowRight/></button></section>
    </div></>;
}

function FunnelCardLabel({ index, selected }: { index: number; selected: boolean }) {
  const step = funnelSteps[index]; const rateValue = transitionRate(funnelSteps, index); const leak = step.id === "workshop" || step.id === "call";
  return <div className={`flow-node ${selected ? "selected" : ""} ${leak ? "revenue-leak" : ""}`}><div className="flow-label">{step.label}</div><div className="flow-metrics"><span><strong>{formatNumber(step.visitors)}</strong> people</span><b>{index === 0 ? "Entry" : `${rateValue.toFixed(1)}%`}</b></div><div className="flow-trend"><span className={step.trend >= 0 ? "delta up" : "delta down"}>{step.trend >= 0 ? "↗" : "↘"} {Math.abs(step.trend)}%</span>{leak ? <span className="leak-tag">Revenue leak</span> : null}</div></div>;
}

function FunnelPage() {
  const [selected, setSelected] = useState("workshop");
  const nodes: Node[] = useMemo(() => funnelSteps.map((step, index) => ({ id: step.id, position: { x: index * 234, y: step.y }, data: { label: <FunnelCardLabel index={index} selected={selected === step.id}/> }, style: { border: 0, padding: 0, width: 194, background: "transparent" }, draggable: false })), [selected]);
  const edges: Edge[] = useMemo(() => funnelSteps.slice(1).map((step, index) => ({ id: `e-${index}`, source: funnelSteps[index].id, target: step.id, animated: index === 1 || index === 3, markerEnd: { type: MarkerType.ArrowClosed, color: "var(--dim)" }, style: { stroke: "var(--dim)", strokeWidth: 1.2 }, label: `${transitionRate(funnelSteps, index + 1).toFixed(1)}%`, labelStyle: { fill: "var(--muted)", fontSize: 9 } })), []);
  const index = Math.max(0, funnelSteps.findIndex((s) => s.id === selected)); const step = funnelSteps[index]; const conversion = transitionRate(funnelSteps, index);
  return <><PageHeader page="funnels" actions={<><button className="button"><Plus/>Add step</button><button className="button primary"><Check/>Save funnel</button></>} /><div className="funnel-shell"><section className="card canvas-card"><div className="canvas-toolbar"><div><strong>High-ticket consulting funnel</strong><br/><span>Ordered funnel · 30-day window</span></div><span>Updated 2 min ago</span></div><div className="flow-wrap"><ReactFlow nodes={nodes} edges={edges} onNodeClick={(_, node) => setSelected(node.id)} fitView fitViewOptions={{ padding: .12 }} minZoom={0.45} maxZoom={1.5} nodesConnectable={false} elementsSelectable><Background color="transparent"/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor="var(--accent)" maskColor="color-mix(in srgb, var(--surface) 75%, transparent)"/></ReactFlow></div></section>
    <aside className="card node-detail"><div className="panel-kicker">Selected node</div><h3>{step.label}</h3><p>{index ? `${funnelSteps[index - 1].label} → ${step.label}` : "Entry point"}</p><div className="detail-tabs"><button className="active">Overview</button><button>Revenue</button><button>Segments</button><button>Timeline</button></div><div className="detail-grid"><div className="detail-metric"><span>People reached</span><strong>{formatNumber(step.visitors)}</strong></div><div className="detail-metric"><span>Conversion</span><strong>{index ? `${conversion.toFixed(1)}%` : "100%"}</strong></div><div className="detail-metric"><span>Target</span><strong>{step.targetRate}%</strong></div><div className="detail-metric"><span>Downstream revenue</span><strong>{formatCurrency(step.revenue, true)}</strong></div></div><div style={{marginTop:18}}><div className="slider-head"><span>Target attainment</span><strong>{Math.min(100, Math.round(conversion / step.targetRate * 100))}%</strong></div><div className="progress"><i style={{width:`${Math.min(100, conversion / step.targetRate * 100)}%`}}/></div></div><div className="detail-note"><b>Evidence-based insight</b><br/>This step explains an estimated 38% of the current revenue gap. The signal is strongest on mobile traffic from paid campaigns.</div><button className="button accent" style={{marginTop:15,width:"100%",justifyContent:"center"}}><FlaskConical/>Create experiment</button></aside></div></>;
}

function JourneysPage() {
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState(journeys[0].id); const filtered = journeys.filter((j) => j.customer.toLowerCase().includes(query.toLowerCase())); const journey = journeys.find((j) => j.id === selected) ?? journeys[0];
  return <><PageHeader page="journeys" actions={<button className="button"><Download/>Export JSON</button>} /><section className="card table-card"><div className="table-tools"><div className="search"><Search/><input aria-label="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer or ID…"/></div><button className="button">All journeys <ChevronDown/></button></div><table className="data-table"><thead><tr><th>Customer</th><th>First touch</th><th>Lead source</th><th>Last touch</th><th>Revenue</th><th>LTV</th><th>Length</th><th>Status</th></tr></thead><tbody>{filtered.map((j) => <tr key={j.id} className={j.id === selected ? "selected" : ""} onClick={() => setSelected(j.id)}><td><strong>{j.customer}</strong><br/><small>{j.id}</small></td><td>{j.first}</td><td>{j.lead}</td><td>{j.last}</td><td><strong>{formatCurrency(j.revenue)}</strong></td><td>{formatCurrency(j.ltv)}</td><td>{j.length} touches</td><td><span className={`status ${j.status === "Open lead" ? "open" : ""}`}>{j.status}</span></td></tr>)}</tbody></table></section><section className="card journey-detail"><div className="panel-head"><div><h3>{journey.customer}&apos;s observed journey</h3><p>UTC event order · organization timezone: Europe/Budapest</p></div><span className="confidence">Identity linked</span></div><div className="timeline">{journey.path.map((step, i) => <div className="timeline-step" key={`${step}-${i}`}><strong>{step}</strong><span>{i === 0 ? "First touch" : i === journey.path.length - 1 ? "Latest event" : `Touch ${i + 1}`}</span></div>)}</div></section></>;
}

function OpportunitiesPage() {
  const [uplift, setUplift] = useState(5);
  return <><PageHeader page="opportunities" actions={<button className="button"><RefreshCw/>Recalculate</button>} /><section className="card panel" style={{marginBottom:14}}><div className="panel-head"><div><h3>Scenario assumption</h3><p>Apply a relative conversion improvement to compare opportunity size.</p></div><strong style={{color:"var(--ink)"}}>+{uplift}%</strong></div><input aria-label="Opportunity uplift" type="range" min="1" max="20" value={uplift} onChange={(e) => setUplift(Number(e.target.value))}/></section><div className="opportunity-list">{opportunities.map((o) => <article className="card opportunity-card" key={o.rank}><div className="rank">#{o.rank}</div><div><h3>{o.title}</h3><p>{o.subtitle}</p><div className="evidence"><Lightbulb/>{o.evidence}</div></div><div className="opportunity-numbers"><strong>{formatCurrency(o.upside * uplift / 5)}</strong><span>Estimated monthly upside</span><div className="score-row"><span>Score {o.score}</span><span className="confidence">{o.confidence}</span></div></div></article>)}</div></>;
}

function AttributionPage() {
  const [model, setModel] = useState<AttributionModel>("linear");
  const key = model === "first" ? "first" : model === "last" ? "last" : model === "u-shaped" ? "u" : "linear";
  const data = [...channels].sort((a,b) => b[key] - a[key]); const max = Math.max(...data.map((c) => c[key]));
  return <><PageHeader page="attribution" actions={<button className="button"><Settings/>Model settings</button>} /><div className="tabs">{(["first","last","linear","u-shaped"] as AttributionModel[]).map((m) => <button className={model === m ? "active" : ""} key={m} onClick={() => setModel(m)}>{m === "u-shaped" ? "U-shaped" : `${m[0].toUpperCase()}${m.slice(1)} touch`}</button>)}</div><div className="attribution-grid"><section className="card panel"><div className="panel-head"><div><h3>Attributed revenue by channel</h3><p>{model} model · 30-day attribution window</p></div><span className="panel-kicker">€184.8k assigned</span></div><div className="bar-list">{data.map((c) => <div className="bar-row" key={c.name}><span>{c.name}</span><div className="bar-track"><i style={{width:`${c[key] / max * 100}%`}}/></div><strong>{formatCurrency(c[key], true)}</strong></div>)}</div></section><aside className="card confidence-card"><div className="panel-kicker">Attribution confidence</div><div className="confidence-score"><b>LOW</b><span>Model disagreement: 63%</span></div><div className="progress"><i style={{width:"37%",background:"var(--warning)"}}/></div><p style={{color:"var(--muted)",fontSize:11,lineHeight:1.55,marginTop:16}}>First-touch and last-touch differ most for Meta Ads and partner referrals. Use attribution as directional evidence, not ground truth.</p><div className="detail-note"><b>Data quality context</b><br/>11.4% of sessions have unknown source. Revenue reconciliation is 96.2% complete.</div></aside></div></>;
}

function CohortsPage() {
  return <><PageHeader page="cohorts" actions={<button className="button"><Download/>Export CSV</button>} /><section className="card table-card"><table className="data-table"><thead><tr><th>Acquisition cohort</th><th>Customers</th><th>CAC</th><th>30d LTV</th><th>90d LTV</th><th>180d LTV</th><th>Payback</th></tr></thead><tbody>{cohorts.map((c) => <tr key={c.month}><td><strong>{c.month}</strong></td><td>{c.customers}</td><td>{formatCurrency(c.cac)}</td><td>{formatCurrency(c.ltv30)}</td><td>{c.ltv90 ? formatCurrency(c.ltv90) : <span className="status open">Incomplete</span>}</td><td>{c.ltv180 ? formatCurrency(c.ltv180) : <span className="status open">Incomplete</span>}</td><td>{c.payback}</td></tr>)}</tbody></table></section><section className="card panel" style={{marginTop:14}}><div className="panel-head"><div><h3>90-day LTV by acquisition month</h3><p>Incomplete cohorts are intentionally excluded.</p></div></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={cohorts.filter((c) => c.ltv90)} margin={{left:-14}}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="month" tick={{fill:"var(--dim)",fontSize:9}} axisLine={false}/><YAxis tickFormatter={(v)=>`€${v/1000}k`} tick={{fill:"var(--dim)",fontSize:9}} axisLine={false}/><Tooltip content={({active,payload,label})=>active&&payload?.length?<div className="chart-tooltip"><b>{label}</b><br/>{formatCurrency(Number(payload[0].value))}</div>:null}/><Bar dataKey="ltv90" radius={[5,5,0,0]}>{cohorts.map((_,i)=><Cell key={i} fill={i===3?"var(--accent-strong)":"var(--accent)"}/>)}</Bar></BarChart></ResponsiveContainer></div></section></>;
}

function RevenuePage() {
  const [traffic, setTraffic] = useState(18420); const [leadRate, setLeadRate] = useState(3.2); const [closeRate, setCloseRate] = useState(68.9);
  const scenario = simulateRevenue({ traffic, leadRate, bookingRate: 10.4, closeRate, averageOrderValue: 4400, adSpend: 20454 });
  return <><PageHeader page="revenue" actions={<button className="button"><Download/>Export report</button>} /><div className="kpi-grid"><Kpi label="Gross revenue" value="€192.4k" delta="9.1%" icon={CircleDollarSign}/><Kpi label="Refunded" value="€7.7k" delta="4.0% rate" icon={TrendingDown} direction="neutral"/><Kpi label="Net revenue" value="€184.8k" delta="8.4%" icon={TrendingUp}/><Kpi label="MRR" value="€31.2k" delta="5.2%" icon={RefreshCw}/><Kpi label="AOV" value="€4.4k" delta="1.9%" icon={BarChart3}/><Kpi label="Revenue / lead" value="€314" delta="2.3%" icon={Target}/></div><section className="card panel" style={{marginBottom:14}}><div className="panel-head"><div><h3>Net revenue trend</h3><p>Canonical purchase, recurring, upsell and refund events</p></div></div><RevenueChart height={300}/></section><div className="two-column"><section className="card panel"><div className="panel-head"><div><h3>What-if scenario</h3><p>Deterministic simulation — not a forecast</p></div></div>{[
      ["Monthly traffic",traffic,8000,30000,1000,setTraffic],
      ["Lead conversion",leadRate,1,8,.1,setLeadRate],
      ["Call close rate",closeRate,40,85,.5,setCloseRate]
    ].map(([label,value,min,max,step,setter]) => <div className="slider-row" key={String(label)}><div className="slider-head"><span>{String(label)}</span><strong>{String(label).includes("traffic") ? formatNumber(Number(value)) : `${Number(value).toFixed(1)}%`}</strong></div><input type="range" min={Number(min)} max={Number(max)} step={Number(step)} value={Number(value)} onChange={(e) => (setter as (n:number)=>void)(Number(e.target.value))}/></div>)}</section><aside className="card panel"><div className="panel-head"><div><h3>Scenario result</h3><p>Current assumptions</p></div></div><div className="scenario-results"><div className="detail-metric"><span>Leads</span><strong>{formatNumber(scenario.leads)}</strong></div><div className="detail-metric"><span>Customers</span><strong>{formatNumber(scenario.customers)}</strong></div><div className="detail-metric"><span>Revenue</span><strong>{formatCurrency(scenario.revenue,true)}</strong></div><div className="detail-metric"><span>Profit</span><strong>{formatCurrency(scenario.profit,true)}</strong></div><div className="detail-metric"><span>CAC</span><strong>{formatCurrency(scenario.cac)}</strong></div><div className="detail-metric"><span>ROAS</span><strong>{scenario.roas.toFixed(2)}×</strong></div></div></aside></div></>;
}

function ExperimentsPage() {
  const [experiments, setExperiments] = useState(initialExperiments);
  const toggle = (id: string) => setExperiments((items) => items.map((item) => item.id === id ? {...item,status:item.status === "Running" ? "Paused" : "Running"} : item));
  return <><PageHeader page="experiments" actions={<button className="button primary"><Plus/>New experiment</button>} /><section className="card table-card"><table className="data-table"><thead><tr><th>Experiment</th><th>Funnel node</th><th>Metric</th><th>Baseline</th><th>Target</th><th>Observed</th><th>Window</th><th>Status</th><th></th></tr></thead><tbody>{experiments.map((e) => <tr key={e.id}><td><strong>{e.name}</strong><br/><small>{e.id}</small></td><td>{e.node}</td><td>{e.metric}</td><td>{e.baseline}%</td><td>{e.target}%</td><td><strong>{e.observed}%</strong></td><td>{e.dates}</td><td><span className={`status ${e.status !== "Running" ? "open" : ""}`}>{e.status}</span></td><td><button className="icon-button" onClick={()=>toggle(e.id)} aria-label={`${e.status === "Running" ? "Pause" : "Resume"} ${e.name}`}>{e.status === "Running" ? <PanelLeftClose/> : <Play/>}</button></td></tr>)}</tbody></table></section><div className="detail-note"><b>Interpretation guardrail</b><br/>Observed change describes what happened during the test window. Funnel Intelligence OS does not claim the experiment caused the change without an appropriate statistical design.</div></>;
}

function TrackingPage() {
  return <><PageHeader page="tracking" actions={<button className="button"><RefreshCw/>Run diagnostics</button>} /><div className="two-column"><section className="card panel"><div className="panel-head"><div><h3>Tracking health</h3><p>Identity, source, revenue and schema completeness</p></div><span className="confidence">Good</span></div><div className="health-ring"><div><strong>92</strong><span>out of 100</span></div></div><div className="detail-grid"><div className="detail-metric"><span>Purchase reconciliation</span><strong>96.2%</strong></div><div className="detail-metric"><span>Duplicate events</span><strong>0.3%</strong></div><div className="detail-metric"><span>Known source</span><strong>88.6%</strong></div><div className="detail-metric"><span>Identity linked</span><strong>94.1%</strong></div></div></section><section className="card panel"><div className="panel-head"><div><h3>Issues requiring attention</h3><p>Each warning includes its affected data and fix.</p></div></div>{trackingIssues.map((issue) => <div className="issue" key={issue.title}><AlertTriangle/><div><h4>{issue.title}</h4><p>{issue.fix}</p><small>Affected: {issue.affected}</small></div><strong>{issue.value}</strong></div>)}</section></div></>;
}

const analystAnswers = {
  opportunity: { title: "The largest current opportunity is Workshop → Application.", body: "Conversion is 44.9% against a 52% target. Closing that gap is estimated to add €18.6k monthly revenue. Mobile visitors account for most of the variance; the signal is high-confidence because tracking completeness is 92/100.", tools: ["get_opportunities", "get_funnel_metrics", "compare_segments"] },
  revenue: { title: "Net revenue increased 8.4% in the current period.", body: "YouTube organic and Newsletter contributed most. Meta Ads brought fewer customers, but its 90-day LTV remains above average, so reducing spend based only on last-touch attribution would be premature.", tools: ["get_overview_metrics", "compare_periods", "compare_attribution_models"] },
  tracking: { title: "The data is usable, with two material caveats.", body: "Unknown source reached 11.4% and seven Stripe customers remain unmatched. Attribution insights should be treated as directional until those gaps are repaired; canonical net revenue is less affected.", tools: ["get_tracking_health", "get_channel_performance"] }
};

function AnalystPage() {
  const [input, setInput] = useState(""); const [question, setQuestion] = useState("Where is the biggest opportunity?"); const [answer, setAnswer] = useState(analystAnswers.opportunity);
  const ask = (value = input) => { const lower = value.toLowerCase(); setQuestion(value || "Where is the biggest opportunity?"); setAnswer(lower.includes("track") || lower.includes("trust") ? analystAnswers.tracking : lower.includes("revenue") || lower.includes("channel") ? analystAnswers.revenue : analystAnswers.opportunity); setInput(""); };
  return <><PageHeader page="ai" actions={<span className="demo-badge"><i/>Deterministic demo analyst</span>} /><div className="ai-layout"><section className="card analyst-card"><div className="analyst-header"><div className="analyst-identity"><div className="analyst-avatar"><Bot/></div><div><strong>Funnel Analyst</strong><span>Tool-based · evidence first</span></div></div><ShieldCheck size={17}/></div><div className="chat"><div className="message assistant">Ask about revenue, funnel performance, channels, tracking quality or the next best experiment. I will use analytics tools before responding.</div><div className="message user">{question}</div><div className="message assistant"><h4>{answer.title}</h4>{answer.body}<div className="trace"><code>Tools called</code>{answer.tools.map((tool) => <code key={tool}>✓ {tool}</code>)}<code>Range: Jul 28 – Aug 27 · Filters: all channels</code><code>Confidence source: sample size + tracking health + variance</code></div></div></div><form className="chat-input" onSubmit={(e)=>{e.preventDefault();ask();}}><input aria-label="Ask the funnel analyst" value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Ask a question about your funnel…"/><button className="button primary" type="submit" aria-label="Send question"><Send/></button></form></section><aside className="card quick-questions"><div className="panel-kicker">Suggested investigations</div>{["Where is the biggest opportunity?","Why did revenue change?","Can I trust the attribution data?","Which channel brings the best customers?"].map((q)=><button key={q} onClick={()=>ask(q)}>{q}<ArrowRight size={12}/></button>)}<div className="detail-note"><b>No invented metrics</b><br/>Business calculations come from deterministic functions. A connected LLM may interpret those results, but cannot replace them.</div></aside></div></>;
}

function IntegrationsPage() {
  const [copied, setCopied] = useState(false); const snippet = `<script src="https://your-domain.com/funnel-sdk.js" data-project-key="pk_live_••••"></script>`;
  const integrations = [
    { name:"JavaScript SDK", icon:Code2, text:"Page, identify and custom event tracking with batching, consent control and offline retry.", status:"Ready" },
    { name:"Server Events API", icon:Braces, text:"Validated, idempotent event ingestion for backend and CRM activity.", status:"Ready" },
    { name:"Generic webhook", icon:Webhook, text:"Map third-party payloads into the normalized Funnel Intelligence event envelope.", status:"Configure" },
    { name:"Stripe", icon:CircleDollarSign, text:"Canonical purchase, refund and recurring revenue reconciliation.", status:"Not connected" },
    { name:"CSV import", icon:Upload, text:"Preview and map customer, event and order columns before importing.", status:"Available" },
    { name:"PostgreSQL", icon:Database, text:"Tenant-scoped operational and event storage for self-hosted deployments.", status:"Demo mode" }
  ];
  return <><PageHeader page="integrations" actions={<button className="button primary"><Plus/>Add integration</button>} /><div className="integration-grid">{integrations.map(({name,icon:Icon,text,status})=><article className="card integration" key={name}><div className="integration-top"><div className="integration-icon"><Icon/></div><span className={`status ${status !== "Ready" && status !== "Available" ? "open" : ""}`}>{status}</span></div><h3>{name}</h3><p>{text}</p><button className="button">{status === "Ready" ? "View guide" : "Configure"}<ArrowRight/></button></article>)}</div><section className="card panel" style={{marginTop:14}}><div className="panel-head"><div><h3>Browser tracking quick start</h3><p>This key is illustrative. Create a real publishable project key in a connected workspace.</p></div><button className="button" onClick={async()=>{await navigator.clipboard.writeText(snippet);setCopied(true);setTimeout(()=>setCopied(false),1800);}}>{copied?<Check/>:<Clipboard/>}{copied?"Copied":"Copy"}</button></div><pre className="code-block">{snippet}{`\n\nfunnel.identify({ email: "person@example.com" })\nfunnel.track("lead_created", { leadMagnet: "AI Systems Guide" })`}</pre></section></>;
}

function SettingsPage() {
  return <><PageHeader page="settings" actions={<button className="button primary"><Check/>Save settings</button>} /><div className="two-column"><section className="card panel"><div className="panel-head"><div><h3>Project defaults</h3><p>These values define how analytical periods and money are interpreted.</p></div></div>{[["Project name","Business Native demo"],["Organization timezone","Europe/Budapest (UTC+02:00)"],["Base currency","EUR — Euro"],["Data retention","365 days"],["Default attribution","Linear · 30 days"]].map(([label,value])=><label key={label} style={{display:"block",marginBottom:14}}><span style={{display:"block",color:"var(--muted)",fontSize:10,marginBottom:6}}>{label}</span><input value={value} readOnly style={{width:"100%",height:39,border:"1px solid var(--border)",borderRadius:8,background:"var(--surface-2)",color:"var(--text)",padding:"0 11px",fontSize:11}}/></label>)}</section><aside className="card panel"><div className="panel-head"><div><h3>Privacy-oriented tracking</h3><p>Architecture controls — not a legal compliance claim.</p></div><ShieldCheck/></div>{["Respect consent before non-essential events","Anonymize IP addresses","Separate PII from event properties","Allow person export and deletion"].map((item)=><label key={item} style={{display:"flex",gap:9,alignItems:"center",padding:"11px 0",borderBottom:"1px solid var(--border)",fontSize:11,color:"var(--text)"}}><input type="checkbox" defaultChecked/>{item}</label>)}<div className="detail-note"><b>Security boundary</b><br/>Secret API keys belong server-side and are never written to browser storage. Demo mode does not enable public ingestion.</div></aside></div></>;
}

function PageContent({ page, navigate }: { page: PageId; navigate: (page: PageId) => void }) {
  switch (page) {
    case "overview": return <OverviewPage navigate={navigate}/>;
    case "funnels": return <FunnelPage/>;
    case "journeys": return <JourneysPage/>;
    case "opportunities": return <OpportunitiesPage/>;
    case "attribution": return <AttributionPage/>;
    case "cohorts": return <CohortsPage/>;
    case "revenue": return <RevenuePage/>;
    case "experiments": return <ExperimentsPage/>;
    case "tracking": return <TrackingPage/>;
    case "ai": return <AnalystPage/>;
    case "integrations": return <IntegrationsPage/>;
    case "settings": return <SettingsPage/>;
  }
}

export function FunnelIntelligenceOS() {
  const [page, setPage] = useState<PageId>("overview"); const [menuOpen, setMenuOpen] = useState(false); const { resolvedTheme, setTheme } = useTheme();
  const navigate = (next: PageId) => { setPage(next); setMenuOpen(false); window.scrollTo({top:0,behavior:"smooth"}); };
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? "open" : ""}`}><div className="brand"><div className="brand-word"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span>Funnel Intelligence OS</div><div className="brand-tag">Decisions from customer journeys</div></div><nav className="nav-scroll" aria-label="Main navigation">{nav.map((group)=><div key={group.section}><div className="nav-section">{group.section}</div>{group.items.map(({id,label,icon:Icon})=><button className={`nav-button ${page===id?"active":""}`} key={id} onClick={()=>navigate(id)}><Icon/>{label}</button>)}</div>)}</nav><div className="sidebar-bottom"><div className="theme-toggle" role="group" aria-label="Theme"><button className={resolvedTheme!=="dark"?"active":""} onClick={()=>setTheme("light")}><Sun size={11}/> Light</button><button className={resolvedTheme==="dark"?"active":""} onClick={()=>setTheme("dark")}><Moon size={11}/> Dark</button></div><div className="open-source">Open-source · self-hostable<br/>Demo workspace · v1.0</div></div></aside>{menuOpen?<button aria-label="Close navigation" onClick={()=>setMenuOpen(false)} style={{position:"fixed",inset:0,zIndex:40,border:0,background:"rgba(0,0,0,.25)"}}/>:null}<main className="main"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Open navigation"><Menu/></button><select className="workspace-select" aria-label="Workspace"><option>Business Native · Demo</option></select><span className="demo-badge"><i/>Seed dataset</span></div><div className="topbar-right"><select className="date-select" aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>This year</option></select><button className="icon-button" aria-label="Notifications"><Bell/></button></div></header><div className="content page-view" key={page}><PageContent page={page} navigate={navigate}/></div></main></div>;
}
