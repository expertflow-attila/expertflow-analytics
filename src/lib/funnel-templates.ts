import type { FunnelNodeKind } from "@/server/db/schema/funnel-kinds";

/**
 * Starting funnels.
 *
 * Targets are left null on purpose. A template cannot know what a given
 * business should convert at, and a plausible-looking made-up target would
 * immediately produce fictional "revenue gap" and opportunity figures. The
 * user sets them once they have a baseline.
 */

export type TemplateStep = {
  name: string;
  kind: FunnelNodeKind;
  eventName: string;
};

export type FunnelTemplate = {
  key: string;
  name: string;
  description: string;
  mode: "STRICT" | "ORDERED" | "FLEXIBLE";
  conversionWindowDays: number;
  steps: TemplateStep[];
};

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    key: "lead_generation",
    name: "Lead generation",
    description: "Traffic to a lead magnet, then to a first purchase.",
    mode: "ORDERED",
    conversionWindowDays: 30,
    steps: [
      { name: "Landing page", kind: "PAGE", eventName: "page_view" },
      { name: "Form started", kind: "EVENT", eventName: "form_started" },
      { name: "Lead created", kind: "CONVERSION", eventName: "lead_created" },
      { name: "Purchase", kind: "PURCHASE", eventName: "purchase_completed" },
    ],
  },
  {
    key: "webinar",
    name: "Webinar funnel",
    description: "Registration, attendance, and the offer that follows.",
    mode: "ORDERED",
    conversionWindowDays: 45,
    steps: [
      { name: "Landing page", kind: "PAGE", eventName: "page_view" },
      { name: "Registered", kind: "WEBINAR", eventName: "webinar_registered" },
      { name: "Attended", kind: "WEBINAR", eventName: "webinar_attended" },
      { name: "Checkout started", kind: "EVENT", eventName: "checkout_started" },
      { name: "Purchase", kind: "PURCHASE", eventName: "purchase_completed" },
    ],
  },
  {
    key: "high_ticket",
    name: "High-ticket sales",
    description: "Application, call and proposal before a signed engagement.",
    mode: "ORDERED",
    conversionWindowDays: 60,
    steps: [
      { name: "Landing page", kind: "PAGE", eventName: "page_view" },
      { name: "Lead created", kind: "CONVERSION", eventName: "lead_created" },
      { name: "Application submitted", kind: "EVENT", eventName: "application_submitted" },
      { name: "Call booked", kind: "CALL", eventName: "call_booked" },
      { name: "Call attended", kind: "CALL", eventName: "call_attended" },
      { name: "Proposal sent", kind: "EVENT", eventName: "proposal_sent" },
      { name: "Purchase", kind: "PURCHASE", eventName: "purchase_completed" },
    ],
  },
  {
    key: "course",
    name: "Course funnel",
    description: "Free content, email nurture, then the course purchase.",
    mode: "ORDERED",
    conversionWindowDays: 45,
    steps: [
      { name: "Landing page", kind: "PAGE", eventName: "page_view" },
      { name: "Lead created", kind: "CONVERSION", eventName: "lead_created" },
      { name: "Email clicked", kind: "EMAIL", eventName: "email_clicked" },
      { name: "Checkout started", kind: "EVENT", eventName: "checkout_started" },
      { name: "Purchase", kind: "PURCHASE", eventName: "purchase_completed" },
      { name: "Upsell", kind: "UPSELL", eventName: "upsell_purchased" },
    ],
  },
  {
    key: "membership",
    name: "Membership funnel",
    description: "Trial or free tier converting into a recurring subscription.",
    mode: "ORDERED",
    conversionWindowDays: 60,
    steps: [
      { name: "Landing page", kind: "PAGE", eventName: "page_view" },
      { name: "Lead created", kind: "CONVERSION", eventName: "lead_created" },
      { name: "Checkout started", kind: "EVENT", eventName: "checkout_started" },
      { name: "Subscription started", kind: "SUBSCRIPTION", eventName: "subscription_started" },
      { name: "Renewed", kind: "SUBSCRIPTION", eventName: "subscription_renewed" },
    ],
  },
  {
    key: "saas",
    name: "SaaS funnel",
    description: "Sign-up to activation to paid conversion.",
    mode: "FLEXIBLE",
    conversionWindowDays: 90,
    steps: [
      { name: "Landing page", kind: "PAGE", eventName: "page_view" },
      { name: "Signed up", kind: "CONVERSION", eventName: "lead_created" },
      { name: "Checkout started", kind: "EVENT", eventName: "checkout_started" },
      { name: "Subscription started", kind: "SUBSCRIPTION", eventName: "subscription_started" },
    ],
  },
  {
    key: "blank",
    name: "Blank",
    description: "Start from a single page-view step and build it yourself.",
    mode: "ORDERED",
    conversionWindowDays: 30,
    steps: [{ name: "Landing page", kind: "PAGE", eventName: "page_view" }],
  },
];

export function getTemplate(key: string): FunnelTemplate | null {
  return FUNNEL_TEMPLATES.find((template) => template.key === key) ?? null;
}
