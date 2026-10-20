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
    name: "Érdeklődőszerzés",
    description: "Látogatóból érdeklődő, majd első vásárló.",
    mode: "ORDERED",
    conversionWindowDays: 30,
    steps: [
      { name: "Érkezőoldal", kind: "PAGE", eventName: "page_view" },
      { name: "Űrlap megkezdése", kind: "EVENT", eventName: "form_started" },
      {
        name: "Érdeklődő létrejötte",
        kind: "CONVERSION",
        eventName: "lead_created",
      },
      { name: "Vásárlás", kind: "PURCHASE", eventName: "purchase_completed" },
    ],
  },
  {
    key: "webinar",
    name: "Webinárium-tölcsér",
    description: "Regisztráció, részvétel és az azt követő ajánlat.",
    mode: "ORDERED",
    conversionWindowDays: 45,
    steps: [
      { name: "Érkezőoldal", kind: "PAGE", eventName: "page_view" },
      {
        name: "Regisztráció",
        kind: "WEBINAR",
        eventName: "webinar_registered",
      },
      { name: "Részvétel", kind: "WEBINAR", eventName: "webinar_attended" },
      {
        name: "Fizetés megkezdése",
        kind: "EVENT",
        eventName: "checkout_started",
      },
      { name: "Vásárlás", kind: "PURCHASE", eventName: "purchase_completed" },
    ],
  },
  {
    key: "high_ticket",
    name: "Nagy értékű értékesítés",
    description: "Jelentkezés, konzultáció és ajánlat a szerződés előtt.",
    mode: "ORDERED",
    conversionWindowDays: 60,
    steps: [
      { name: "Érkezőoldal", kind: "PAGE", eventName: "page_view" },
      {
        name: "Érdeklődő létrejötte",
        kind: "CONVERSION",
        eventName: "lead_created",
      },
      {
        name: "Jelentkezés elküldése",
        kind: "EVENT",
        eventName: "application_submitted",
      },
      { name: "Konzultáció foglalása", kind: "CALL", eventName: "call_booked" },
      {
        name: "Részvétel konzultáción",
        kind: "CALL",
        eventName: "call_attended",
      },
      { name: "Ajánlat elküldése", kind: "EVENT", eventName: "proposal_sent" },
      { name: "Vásárlás", kind: "PURCHASE", eventName: "purchase_completed" },
    ],
  },
  {
    key: "course",
    name: "Kurzusértékesítés",
    description:
      "Ingyenes tartalom, e-mailes utánkövetés, majd kurzusvásárlás.",
    mode: "ORDERED",
    conversionWindowDays: 45,
    steps: [
      { name: "Érkezőoldal", kind: "PAGE", eventName: "page_view" },
      {
        name: "Érdeklődő létrejötte",
        kind: "CONVERSION",
        eventName: "lead_created",
      },
      { name: "E-mailes kattintás", kind: "EMAIL", eventName: "email_clicked" },
      {
        name: "Fizetés megkezdése",
        kind: "EVENT",
        eventName: "checkout_started",
      },
      { name: "Vásárlás", kind: "PURCHASE", eventName: "purchase_completed" },
      {
        name: "Kiegészítő ajánlat",
        kind: "UPSELL",
        eventName: "upsell_purchased",
      },
    ],
  },
  {
    key: "membership",
    name: "Tagsági előfizetés",
    description: "Próbaidőszak vagy ingyenes csomag után ismétlődő előfizetés.",
    mode: "ORDERED",
    conversionWindowDays: 60,
    steps: [
      { name: "Érkezőoldal", kind: "PAGE", eventName: "page_view" },
      {
        name: "Érdeklődő létrejötte",
        kind: "CONVERSION",
        eventName: "lead_created",
      },
      {
        name: "Fizetés megkezdése",
        kind: "EVENT",
        eventName: "checkout_started",
      },
      {
        name: "Előfizetés indítása",
        kind: "SUBSCRIPTION",
        eventName: "subscription_started",
      },
      {
        name: "Megújítás",
        kind: "SUBSCRIPTION",
        eventName: "subscription_renewed",
      },
    ],
  },
  {
    key: "saas",
    name: "SaaS-tölcsér",
    description: "Regisztrációtól az aktiváláson át a fizető ügyfélig.",
    mode: "FLEXIBLE",
    conversionWindowDays: 90,
    steps: [
      { name: "Érkezőoldal", kind: "PAGE", eventName: "page_view" },
      { name: "Regisztráció", kind: "CONVERSION", eventName: "lead_created" },
      {
        name: "Fizetés megkezdése",
        kind: "EVENT",
        eventName: "checkout_started",
      },
      {
        name: "Előfizetés indítása",
        kind: "SUBSCRIPTION",
        eventName: "subscription_started",
      },
    ],
  },
  {
    key: "blank",
    name: "Üres tölcsér",
    description:
      "Indulj egy oldalmegtekintési lépéssel, és építsd fel a saját tölcséredet.",
    mode: "ORDERED",
    conversionWindowDays: 30,
    steps: [{ name: "Érkezőoldal", kind: "PAGE", eventName: "page_view" }],
  },
];

export function getTemplate(key: string): FunnelTemplate | null {
  return FUNNEL_TEMPLATES.find((template) => template.key === key) ?? null;
}
