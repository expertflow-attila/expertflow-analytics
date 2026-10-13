/**
 * Standard event taxonomy.
 *
 * Custom event names are always allowed — this list exists so the product can
 * offer sensible funnel templates, know which events carry revenue, and warn
 * when a project has no lead or purchase signal at all.
 */
export const STANDARD_EVENTS = [
  "page_view",
  "session_started",

  "lead_created",
  "form_started",
  "form_submitted",

  "email_opened",
  "email_clicked",

  "webinar_registered",
  "webinar_attended",

  "application_started",
  "application_submitted",

  "call_booked",
  "call_cancelled",
  "call_attended",
  "call_no_show",

  "proposal_sent",
  "proposal_viewed",
  "proposal_accepted",

  "checkout_started",
  "purchase_completed",
  "refund_created",

  "subscription_started",
  "subscription_renewed",
  "subscription_cancelled",

  "upsell_purchased",
] as const;

export type StandardEvent = (typeof STANDARD_EVENTS)[number];

/** Events that may legitimately carry a `revenue` value. */
export const REVENUE_EVENTS = new Set<string>([
  "purchase_completed",
  "upsell_purchased",
  "subscription_started",
  "subscription_renewed",
]);

/** Events that mark a person becoming a known lead. */
export const LEAD_EVENTS = new Set<string>([
  "lead_created",
  "form_submitted",
  "application_submitted",
  "webinar_registered",
]);

export const EVENT_LABELS: Record<string, string> = {
  page_view: "Page view",
  session_started: "Session started",
  lead_created: "Lead created",
  form_started: "Form started",
  form_submitted: "Form submitted",
  email_opened: "Email opened",
  email_clicked: "Email clicked",
  webinar_registered: "Webinar registered",
  webinar_attended: "Webinar attended",
  application_started: "Application started",
  application_submitted: "Application submitted",
  call_booked: "Call booked",
  call_cancelled: "Call cancelled",
  call_attended: "Call attended",
  call_no_show: "Call no-show",
  proposal_sent: "Proposal sent",
  proposal_viewed: "Proposal viewed",
  proposal_accepted: "Proposal accepted",
  checkout_started: "Checkout started",
  purchase_completed: "Purchase completed",
  refund_created: "Refund created",
  subscription_started: "Subscription started",
  subscription_renewed: "Subscription renewed",
  subscription_cancelled: "Subscription cancelled",
  upsell_purchased: "Upsell purchased",
};

export function eventLabel(name: string): string {
  return EVENT_LABELS[name] ?? name;
}
