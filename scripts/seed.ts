/**
 * Demo dataset generator.
 *
 * Models a realistic AI-consulting business over ~5 months so every analytics
 * surface has something meaningful to show. The data is deliberately imperfect:
 * it contains a genuine funnel leak, an attribution conflict, a channel that
 * looks expensive but produces the best customers, refunds, returning buyers
 * and a tracking problem. A clean dataset would make the product look like it
 * works while proving nothing.
 *
 * Run with: pnpm db:seed
 */
// Must precede every other import: the modules below read validated env at
// module scope, and ES import hoisting would otherwise run them first.
import "dotenv/config";

import { hash } from "bcryptjs";

import { classifyChannel } from "../src/lib/events/channel";
import { db } from "../src/server/db";
import { generateApiKey, hashApiKey } from "../src/server/crypto";
import {
  anonymousIdentities,
  apiKeys,
  attributionConfigs,
  funnelEdges,
  funnelNodes,
  funnels,
  events,
  memberships,
  orders,
  organizations,
  persons,
  projects,
  refunds,
  sessions,
  touchpoints,
  users,
} from "../src/server/db/schema";
import { newId } from "../src/server/db/schema/_helpers";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Deterministic PRNG so the demo dataset is reproducible across machines. */
let seedState = 42;
function random(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
function between(min: number, max: number): number {
  return min + random() * (max - min);
}
function chance(probability: number): boolean {
  return random() < probability;
}

const NOW = Date.now();
const START = NOW - 150 * DAY;

type ChannelSpec = {
  name: string;
  utmSource: string | null;
  utmMedium: string | null;
  referrer: string | null;
  weight: number;
  /** Multiplier applied to every downstream conversion rate. */
  quality: number;
  campaigns: string[];
};

/**
 * YouTube converts less often but produces far better customers than Meta —
 * exactly the pattern last-touch attribution hides and cohort LTV reveals.
 */
const CHANNELS: ChannelSpec[] = [
  {
    name: "meta",
    utmSource: "facebook",
    utmMedium: "paid",
    referrer: "https://facebook.com/",
    weight: 0.3,
    quality: 0.75,
    campaigns: ["webinar_august", "leadmagnet_evergreen", "retargeting_q3"],
  },
  {
    name: "google",
    utmSource: "google",
    utmMedium: "cpc",
    referrer: "https://google.com/",
    weight: 0.18,
    quality: 1.0,
    campaigns: ["brand", "ai_consulting_hu", "automation_generic"],
  },
  {
    name: "youtube",
    utmSource: "youtube",
    utmMedium: null,
    referrer: "https://youtube.com/",
    weight: 0.22,
    quality: 1.6,
    campaigns: ["channel_organic"],
  },
  {
    name: "newsletter",
    utmSource: "newsletter",
    utmMedium: "email",
    referrer: null,
    weight: 0.14,
    quality: 1.9,
    campaigns: ["weekly_issue", "launch_sequence"],
  },
  {
    name: "organic",
    utmSource: null,
    utmMedium: null,
    referrer: "https://google.com/",
    weight: 0.11,
    quality: 1.3,
    campaigns: [],
  },
  {
    // The tracking problem: real traffic arriving with no identifiable source.
    name: "untagged",
    utmSource: null,
    utmMedium: null,
    referrer: null,
    weight: 0.05,
    quality: 0.9,
    campaigns: [],
  },
];

function pickChannel(): ChannelSpec {
  const roll = random();
  let cumulative = 0;
  for (const channel of CHANNELS) {
    cumulative += channel.weight;
    if (roll <= cumulative) return channel;
  }
  return CHANNELS[CHANNELS.length - 1];
}

const DEVICES = ["desktop", "mobile", "mobile", "tablet"] as const;
const COUNTRIES = ["HU", "HU", "HU", "DE", "AT", "US", "GB"] as const;
const BROWSERS = ["Chrome", "Chrome", "Safari", "Firefox", "Edge"] as const;

const FIRST_NAMES = [
  "Anna", "Bence", "Csaba", "Dóra", "Eszter", "Ferenc", "Gábor", "Hanna",
  "István", "Judit", "Katalin", "László", "Márton", "Nóra", "Orsolya", "Péter",
  "Réka", "Sándor", "Tamás", "Viktória", "Zoltán", "Zsófia",
];
const LAST_NAMES = [
  "Nagy", "Kovács", "Tóth", "Szabó", "Horváth", "Varga", "Kiss", "Molnár",
  "Németh", "Farkas", "Balogh", "Papp", "Lukács", "Mészáros",
];

/**
 * Baseline conversion rates. `webinar_attended → call_booked` is the planted
 * leak: a 14% target against roughly 8% actual, which the Opportunity Engine
 * should surface as the single largest revenue upside.
 */
const RATES = {
  pageToLead: 0.32,
  leadToWebinarRegistered: 0.46,
  webinarRegisteredToAttended: 0.52,
  webinarAttendedToCall: 0.082,
  callToAttended: 0.74,
  callAttendedToProposal: 0.62,
  proposalToPurchase: 0.41,
  purchaseToUpsell: 0.23,
  refund: 0.05,
  repeatPurchase: 0.18,
};

const PRODUCTS = [
  { name: "AI Audit", priceMinor: 149_000 },
  { name: "Automation Sprint", priceMinor: 490_000 },
  { name: "AI Operations Retainer", priceMinor: 890_000 },
];
const UPSELL = { name: "Team Training Add-on", priceMinor: 220_000 };

type EventRow = typeof events.$inferInsert;
type TouchpointRow = typeof touchpoints.$inferInsert;
type SessionRow = typeof sessions.$inferInsert;

async function main() {
  console.log("Seeding demo dataset…");

  const passwordHash = await hash("demo1234", 10);

  const [user] = await db
    .insert(users)
    .values({
      email: "demo@funnelintelligence.dev",
      name: "Demo Analyst",
      passwordHash,
      emailVerifiedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash },
    })
    .returning();

  const [organization] = await db
    .insert(organizations)
    .values({
      name: "Northlight AI",
      slug: "northlight-ai",
      timezone: "Europe/Budapest",
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: "Northlight AI" },
    })
    .returning();

  await db
    .insert(memberships)
    .values({
      userId: user.id,
      organizationId: organization.id,
      role: "OWNER",
    })
    .onConflictDoNothing();

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: "Main website",
      slug: "main-website",
      baseCurrency: "EUR",
      // Drives the demo-data banner. Generated numbers must never be
      // presented as if they were measurements.
      settings: { demoDataset: true },
    })
    .onConflictDoUpdate({
      target: [projects.organizationId, projects.slug],
      set: { name: "Main website", settings: { demoDataset: true } },
    })
    .returning();

  // Clear prior demo rows so re-running the seed is idempotent.
  for (const table of [
    events, touchpoints, sessions, anonymousIdentities,
    refunds, orders, persons, funnelEdges, funnelNodes, funnels, apiKeys,
  ]) {
    await db.delete(table as never);
  }

  const publishable = generateApiKey("pk");
  const secret = generateApiKey("sk");

  await db.insert(apiKeys).values([
    {
      organizationId: organization.id,
      projectId: project.id,
      type: "PUBLISHABLE",
      name: "Website",
      keyPlain: publishable,
      keyLast4: publishable.slice(-4),
    },
    {
      organizationId: organization.id,
      projectId: project.id,
      type: "SECRET",
      name: "Server events",
      keyHash: hashApiKey(secret),
      keyLast4: secret.slice(-4),
    },
  ]);

  await db
    .insert(attributionConfigs)
    .values({
      organizationId: organization.id,
      projectId: project.id,
      model: "U_SHAPED",
      windowDays: 90,
    });

  const scope = { organizationId: organization.id, projectId: project.id };

  const eventRows: EventRow[] = [];
  const touchpointRows: TouchpointRow[] = [];
  const sessionRows: SessionRow[] = [];
  const personRows: (typeof persons.$inferInsert)[] = [];
  const anonRows: (typeof anonymousIdentities.$inferInsert)[] = [];
  const orderRows: (typeof orders.$inferInsert)[] = [];
  const refundRows: (typeof refunds.$inferInsert)[] = [];

  let visitorCount = 0;

  for (let day = 0; day < 150; day++) {
    const date = START + day * DAY;
    const dayOfWeek = new Date(date).getUTCDay();

    // Weekends are quieter, and traffic grows slowly over the period.
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.55 : 1;
    const growth = 1 + day / 300;
    // Sized so the period produces enough customers for cohort and payback
    // analysis to be meaningful — a high-ticket funnel converts around 0.12%
    // end to end, so a thin traffic figure yields single-digit orders.
    const dailyVisitors = Math.round(between(300, 460) * weekendFactor * growth);

    for (let v = 0; v < dailyVisitors; v++) {
      visitorCount += 1;
      const channel = pickChannel();
      const anonymousId = `anon_${newId("a").slice(2)}`;
      const sessionKey = `sess_${newId("s").slice(2)}`;
      const arrivedAt = new Date(date + between(6, 22) * HOUR);

      const device = pick(DEVICES);
      const country = pick(COUNTRIES);
      const browser = pick(BROWSERS);
      const campaign = channel.campaigns.length ? pick(channel.campaigns) : null;

      const derivedChannel = classifyChannel({
        utmSource: channel.utmSource,
        utmMedium: channel.utmMedium,
        referrer: channel.referrer,
        selfHost: "northlight.ai",
      });

      const common = {
        ...scope,
        anonymousId,
        sessionKey,
        utmSource: channel.utmSource,
        utmMedium: channel.utmMedium,
        utmCampaign: campaign,
        channel: derivedChannel,
        referrer: channel.referrer,
        deviceType: device,
        browser,
        country,
        source: "sdk" as const,
      };

      sessionRows.push({
        ...scope,
        sessionKey,
        anonymousId,
        startedAt: arrivedAt,
        endedAt: arrivedAt,
        entryPath: "/",
        referrer: channel.referrer,
        utmSource: channel.utmSource,
        utmMedium: channel.utmMedium,
        utmCampaign: campaign,
        channel: derivedChannel,
        deviceType: device,
        browser,
        country,
        eventCount: 1,
      });

      touchpointRows.push({
        ...scope,
        anonymousId,
        sessionKey,
        occurredAt: arrivedAt,
        channel: derivedChannel,
        source: channel.utmSource,
        medium: channel.utmMedium,
        campaign,
        landingPath: "/",
        isLeadConversion: "false",
      });

      const push = (
        name: string,
        offsetMs: number,
        extra: Partial<EventRow> = {},
      ) => {
        eventRows.push({
          eventId: `evt_${newId("e").slice(2)}`,
          eventName: name,
          eventVersion: 1,
          timestamp: new Date(arrivedAt.getTime() + offsetMs),
          pagePath: "/",
          properties: {},
          ...common,
          ...extra,
        });
      };

      push("session_started", 0);
      push("page_view", 1000, { pagePath: "/" });

      // Mobile visitors convert notably worse — a real, findable pattern.
      const deviceFactor = device === "mobile" ? 0.69 : 1;
      const quality = channel.quality * deviceFactor;

      if (!chance(RATES.pageToLead * Math.min(1.4, quality))) continue;

      const person = buildPerson(scope, arrivedAt);
      personRows.push(person);
      anonRows.push({
        ...scope,
        anonymousId,
        personId: person.id!,
        firstSeenAt: arrivedAt,
        lastSeenAt: arrivedAt,
      });

      const withPerson = { personId: person.id! };
      push("form_submitted", 4 * 60_000, withPerson);
      push("lead_created", 5 * 60_000, withPerson);

      touchpointRows.push({
        ...scope,
        anonymousId,
        personId: person.id!,
        sessionKey,
        occurredAt: new Date(arrivedAt.getTime() + 5 * 60_000),
        channel: derivedChannel,
        source: channel.utmSource,
        medium: channel.utmMedium,
        campaign,
        landingPath: "/",
        isLeadConversion: "true",
      });

      if (!chance(RATES.leadToWebinarRegistered * Math.min(1.3, quality))) continue;
      push("webinar_registered", 2 * DAY, withPerson);

      // A second touch before the webinar creates the attribution conflict:
      // acquisition channel and last-touch channel routinely disagree.
      if (chance(0.55)) {
        const secondChannel = pickChannel();
        touchpointRows.push({
          ...scope,
          anonymousId,
          personId: person.id!,
          occurredAt: new Date(arrivedAt.getTime() + 3 * DAY),
          channel: classifyChannel({
            utmSource: secondChannel.utmSource,
            utmMedium: secondChannel.utmMedium,
            referrer: secondChannel.referrer,
            selfHost: "northlight.ai",
          }),
          source: secondChannel.utmSource,
          medium: secondChannel.utmMedium,
          campaign: secondChannel.campaigns.length
            ? pick(secondChannel.campaigns)
            : null,
          landingPath: "/webinar",
          isLeadConversion: "false",
        });
        push("email_clicked", 3 * DAY, withPerson);
      }

      if (!chance(RATES.webinarRegisteredToAttended)) continue;
      push("webinar_attended", 5 * DAY, withPerson);

      // The planted leak.
      if (!chance(RATES.webinarAttendedToCall * Math.min(1.5, quality))) continue;
      push("call_booked", 6 * DAY, withPerson);

      if (!chance(RATES.callToAttended)) {
        push("call_no_show", 8 * DAY, withPerson);
        continue;
      }
      push("call_attended", 8 * DAY, withPerson);

      if (!chance(RATES.callAttendedToProposal)) continue;
      push("proposal_sent", 9 * DAY, withPerson);
      push("proposal_viewed", 9 * DAY + 3 * HOUR, withPerson);

      if (!chance(RATES.proposalToPurchase * Math.min(1.4, quality))) continue;

      const product = pick(PRODUCTS);
      const purchasedAt = new Date(arrivedAt.getTime() + 12 * DAY);
      if (purchasedAt.getTime() > NOW) continue;

      const orderId = newId("ord");
      orderRows.push({
        id: orderId,
        ...scope,
        personId: person.id!,
        externalId: `ch_${newId("x").slice(2)}`,
        source: "STRIPE",
        occurredAt: purchasedAt,
        grossMinor: product.priceMinor,
        currency: "EUR",
        productName: product.name,
        orderIndex: 1,
      });

      push("purchase_completed", 12 * DAY, {
        ...withPerson,
        revenueMinor: product.priceMinor,
        currency: "EUR",
        properties: { product: product.name },
      });

      person.lifetimeRevenueMinor = product.priceMinor;

      if (chance(RATES.refund)) {
        const refundedAt = new Date(purchasedAt.getTime() + 9 * DAY);
        if (refundedAt.getTime() <= NOW) {
          refundRows.push({
            ...scope,
            orderId,
            personId: person.id!,
            externalId: `re_${newId("x").slice(2)}`,
            amountMinor: product.priceMinor,
            currency: "EUR",
            occurredAt: refundedAt,
            reason: "requested_by_customer",
          });
          push("refund_created", 21 * DAY, withPerson);
          person.lifetimeRevenueMinor = 0;
          continue;
        }
      }

      if (chance(RATES.purchaseToUpsell * Math.min(1.5, quality))) {
        const upsellAt = new Date(purchasedAt.getTime() + 18 * DAY);
        if (upsellAt.getTime() <= NOW) {
          orderRows.push({
            ...scope,
            personId: person.id!,
            externalId: `ch_${newId("x").slice(2)}`,
            source: "STRIPE",
            occurredAt: upsellAt,
            grossMinor: UPSELL.priceMinor,
            currency: "EUR",
            productName: UPSELL.name,
            orderIndex: 2,
          });
          push("upsell_purchased", 30 * DAY, {
            ...withPerson,
            revenueMinor: UPSELL.priceMinor,
            currency: "EUR",
          });
          person.lifetimeRevenueMinor! += UPSELL.priceMinor;
        }
      }
    }
  }

  console.log(
    `Generated ${visitorCount} visitors, ${eventRows.length} events, ` +
      `${personRows.length} people, ${orderRows.length} orders.`,
  );

  await insertInChunks(persons, personRows);
  await insertInChunks(sessions, sessionRows);
  await insertInChunks(anonymousIdentities, anonRows);
  await insertInChunks(events, eventRows);
  await insertInChunks(touchpoints, touchpointRows);
  await insertInChunks(orders, orderRows);
  await insertInChunks(refunds, refundRows);

  await seedFunnel(scope);

  console.log("\nDone.\n");
  console.log("  Sign in:        demo@funnelintelligence.dev / demo1234");
  console.log(`  Publishable key: ${publishable}`);
  console.log(`  Secret key:      ${secret}`);
  console.log("\n  The secret key is shown once here only — it is stored hashed.\n");

  process.exit(0);
}

function buildPerson(
  scope: { organizationId: string; projectId: string },
  seenAt: Date,
): typeof persons.$inferInsert {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const id = newId("per");

  return {
    id,
    ...scope,
    email: `${first.toLowerCase()}.${last.toLowerCase()}.${id.slice(-6)}@example.com`,
    name: `${first} ${last}`,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    lifetimeRevenueMinor: 0,
  };
}

/** Postgres caps parameters per statement, so large inserts must be chunked. */
async function insertInChunks<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  chunkSize = 500,
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db
      .insert(table)
      .values(rows.slice(i, i + chunkSize) as never)
      .onConflictDoNothing();
  }
}

async function seedFunnel(scope: {
  organizationId: string;
  projectId: string;
}) {
  const [funnel] = await db
    .insert(funnels)
    .values({
      ...scope,
      name: "High-ticket consulting funnel",
      description:
        "Traffic through webinar to booked call and signed engagement.",
      mode: "ORDERED",
      conversionWindowSeconds: 30 * 24 * 60 * 60,
      templateKey: "high_ticket",
    })
    .returning();

  // `target` is the planned conversion rate FROM this node TO the next one,
  // which is how the engine reads it. The final node has no target because
  // there is no step after it.
  const steps: Array<{
    name: string;
    kind: (typeof funnelNodes.$inferInsert)["kind"];
    eventName: string;
    target?: number;
  }> = [
    { name: "Landing page", kind: "PAGE", eventName: "page_view", target: 0.35 },
    { name: "Lead created", kind: "CONVERSION", eventName: "lead_created", target: 0.5 },
    { name: "Webinar registered", kind: "WEBINAR", eventName: "webinar_registered", target: 0.55 },
    // The planted leak: planned 14%, actual around 8-10%.
    { name: "Webinar attended", kind: "WEBINAR", eventName: "webinar_attended", target: 0.14 },
    { name: "Call booked", kind: "CALL", eventName: "call_booked", target: 0.8 },
    { name: "Call attended", kind: "CALL", eventName: "call_attended", target: 0.65 },
    { name: "Proposal sent", kind: "EVENT", eventName: "proposal_sent", target: 0.45 },
    { name: "Purchase", kind: "PURCHASE", eventName: "purchase_completed" },
  ];

  const nodeRows = await db
    .insert(funnelNodes)
    .values(
      steps.map((step, index) => ({
        ...scope,
        funnelId: funnel.id,
        name: step.name,
        kind: step.kind,
        stepIndex: index,
        matchRule: { eventName: step.eventName },
        targetConversionRate: step.target ?? null,
        positionX: 80 + index * 260,
        positionY: 160 + (index % 2) * 40,
      })),
    )
    .returning();

  await db.insert(funnelEdges).values(
    nodeRows.slice(0, -1).map((node, index) => ({
      ...scope,
      funnelId: funnel.id,
      sourceNodeId: node.id,
      targetNodeId: nodeRows[index + 1].id,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
