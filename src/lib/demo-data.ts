import type { FunnelStep } from "./analytics";

export const funnelSteps: FunnelStep[] = [
  { id: "visit", label: "Website visit", shortLabel: "Visit", visitors: 18420, targetRate: 100, revenue: 184750, trend: 12.4, x: 24, y: 70 },
  { id: "lead", label: "Lead captured", shortLabel: "Lead", visitors: 588, targetRate: 4.2, revenue: 184750, trend: 8.1, x: 260, y: 70 },
  { id: "workshop", label: "Workshop attended", shortLabel: "Workshop", visitors: 214, targetRate: 42, revenue: 178400, trend: -6.8, x: 496, y: 70 },
  { id: "application", label: "Application submitted", shortLabel: "Application", visitors: 96, targetRate: 52, revenue: 171200, trend: 4.2, x: 732, y: 70 },
  { id: "call", label: "Sales call attended", shortLabel: "Call", visitors: 61, targetRate: 70, revenue: 164900, trend: -11.6, x: 968, y: 70 },
  { id: "sale", label: "Purchase completed", shortLabel: "Sale", visitors: 42, targetRate: 72, revenue: 152400, trend: 7.5, x: 1204, y: 70 },
  { id: "upsell", label: "Upsell purchased", shortLabel: "Upsell", visitors: 14, targetRate: 40, revenue: 32350, trend: 16.7, x: 1440, y: 70 }
];

export const revenueSeries = [
  { date: "Jun 08", revenue: 29800, previous: 26700 },
  { date: "Jun 15", revenue: 34100, previous: 30900 },
  { date: "Jun 22", revenue: 31500, previous: 32400 },
  { date: "Jun 29", revenue: 39600, previous: 35200 },
  { date: "Jul 06", revenue: 42200, previous: 36800 },
  { date: "Jul 13", revenue: 38400, previous: 37100 },
  { date: "Jul 20", revenue: 46800, previous: 40900 },
  { date: "Jul 27", revenue: 49200, previous: 42800 }
];

export const channels = [
  { name: "YouTube / Organic", revenue: 68400, customers: 14, cac: 0, ltv: 7860, first: 73400, last: 51200, linear: 65800, u: 70400 },
  { name: "Newsletter", revenue: 42900, customers: 11, cac: 86, ltv: 6280, first: 29800, last: 55700, linear: 44200, u: 40200 },
  { name: "Google Search", revenue: 32750, customers: 8, cac: 412, ltv: 5940, first: 38100, last: 28400, linear: 33100, u: 35700 },
  { name: "Meta Ads", revenue: 25800, customers: 6, cac: 928, ltv: 7420, first: 36900, last: 17400, linear: 24700, u: 29100 },
  { name: "Partner referral", revenue: 14900, customers: 3, cac: 120, ltv: 8110, first: 6500, last: 32100, linear: 17050, u: 9350 }
];

export const opportunities = [
  { rank: 1, title: "Workshop → Application", subtitle: "Raise conversion from 44.9% to the 52% target", upside: 18600, score: 91, confidence: "High", reach: "214 people / month", effort: "Medium", evidence: "The drop is concentrated on mobile and increased after the form redesign." },
  { rank: 2, title: "Call → Sale", subtitle: "Recover the previous 73% close rate", upside: 11700, score: 83, confidence: "High", reach: "61 calls / month", effort: "Low", evidence: "No-show is stable; proposal viewing fell 12% while call quality stayed flat." },
  { rank: 3, title: "Visit → Lead", subtitle: "Improve lead capture by +0.5 percentage points", upside: 8400, score: 74, confidence: "Medium", reach: "18.4k visitors / month", effort: "Medium", evidence: "Organic traffic grew, but mobile landing conversion trails desktop by 31%." },
  { rank: 4, title: "Sale → Upsell", subtitle: "Move take rate from 33.3% to 40%", upside: 4860, score: 62, confidence: "Medium", reach: "42 buyers / month", effort: "Low", evidence: "The upsell is only shown after card payments; invoice buyers never see it." }
];

export const journeys = [
  { id: "cust_2041", customer: "Maya Chen", first: "YouTube", lead: "AI Systems Guide", last: "Newsletter", revenue: 6400, ltv: 9800, length: 12, status: "Customer", path: ["YouTube", "Guide", "Newsletter", "Workshop", "Call", "Sale", "Upsell"] },
  { id: "cust_1988", customer: "Daniel Ortiz", first: "Meta Ads", lead: "Workshop", last: "Direct", revenue: 4200, ltv: 6720, length: 8, status: "Customer", path: ["Meta Ads", "Landing", "Workshop", "Application", "Call", "Sale"] },
  { id: "cust_1942", customer: "Amelia Brooks", first: "Google", lead: "AI Guide", last: "YouTube", revenue: 3800, ltv: 5940, length: 15, status: "Customer", path: ["Google", "Guide", "Email", "YouTube", "Workshop", "Call", "Sale"] },
  { id: "lead_4112", customer: "Noah Williams", first: "Newsletter", lead: "Workshop", last: "Newsletter", revenue: 0, ltv: 0, length: 6, status: "Open lead", path: ["Newsletter", "Workshop", "Application", "Call"] },
  { id: "lead_4079", customer: "Sofia Laurent", first: "Partner", lead: "Consultation", last: "Direct", revenue: 0, ltv: 0, length: 5, status: "Open lead", path: ["Partner", "Case study", "Application", "Call"] }
];

export const cohorts = [
  { month: "March 2026", customers: 31, cac: 442, ltv30: 1920, ltv90: 4860, ltv180: 7120, payback: "41 days" },
  { month: "April 2026", customers: 38, cac: 475, ltv30: 1840, ltv90: 5210, ltv180: 7480, payback: "45 days" },
  { month: "May 2026", customers: 34, cac: 521, ltv30: 1730, ltv90: 4930, ltv180: 6810, payback: "52 days" },
  { month: "June 2026", customers: 41, cac: 498, ltv30: 2110, ltv90: 5540, ltv180: null, payback: "38 days" },
  { month: "July 2026", customers: 42, cac: 487, ltv30: 2260, ltv90: null, ltv180: null, payback: "36 days" }
];

export const trackingIssues = [
  { severity: "warning", title: "Unknown source is rising", value: "11.4%", affected: "2,098 sessions", fix: "Persist UTM parameters and preserve the original referrer across the consent redirect." },
  { severity: "warning", title: "Stripe customers not matched", value: "7", affected: "€8,420 revenue", fix: "Send the internal person_id into Stripe checkout metadata before creating the session." },
  { severity: "info", title: "Delayed email events", value: "3.2%", affected: "487 events", fix: "Use provider event time instead of webhook received_at when mapping email activity." }
];

export const experiments = [
  { id: "exp-01", name: "Shorter workshop application", node: "Workshop → Application", metric: "Application rate", baseline: 44.9, target: 52, observed: 49.8, status: "Running", dates: "Aug 12 – Sep 02" },
  { id: "exp-02", name: "Proposal follow-up at 24h", node: "Call → Sale", metric: "Close rate", baseline: 68.9, target: 73, observed: 72.1, status: "Running", dates: "Aug 18 – Sep 08" },
  { id: "exp-03", name: "Mobile hero proof block", node: "Visit → Lead", metric: "Mobile lead rate", baseline: 2.4, target: 3.1, observed: 3.0, status: "Completed", dates: "Jul 07 – Jul 28" }
];
