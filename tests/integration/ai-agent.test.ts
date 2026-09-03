import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runAnalyst } from "@/server/ai/agent";
import type {
  AIProvider,
  ChatMessage,
  ChatResult,
} from "@/server/ai/provider";
import type { ToolContext } from "@/server/ai/tools";
import type { Db } from "@/server/db";
import { ingestEvents } from "@/server/ingest";
import { recordOrder } from "@/server/revenue/service";
import type { TenantContext } from "@/server/tenancy";

import {
  closeDatabase,
  createTenant,
  prepareDatabase,
  testDb,
  truncateAll,
} from "./setup";

const db = testDb as unknown as Db;

/**
 * A scripted provider.
 *
 * The agent loop, tool dispatch, argument validation, tenant scoping and trace
 * recording are all ours and are what these tests cover. The HTTP wire format
 * of the OpenAI and Anthropic adapters is not exercised here — that needs a
 * live provider.
 */
class ScriptedProvider implements AIProvider {
  readonly id = "scripted";
  readonly model = "scripted";
  readonly seen: ChatMessage[][] = [];

  constructor(private readonly script: ChatResult[]) {}

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    this.seen.push([...messages]);
    return (
      this.script.shift() ?? { content: "No more scripted turns.", toolCalls: [] }
    );
  }
}

let toolContext: ToolContext;
let ctx: TenantContext;

beforeAll(async () => {
  await prepareDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await truncateAll();
  const tenant = await createTenant("Analyst Co");

  ctx = {
    userId: "test-user",
    organizationId: tenant.organization.id,
    projectId: tenant.project.id,
    role: "OWNER",
    timezone: "UTC",
    baseCurrency: "EUR",
  };

  const to = new Date();
  toolContext = {
    ctx,
    defaultRange: { from: new Date(to.getTime() - 90 * 86_400_000), to },
  };
});

async function seedSomeRevenue() {
  await ingestEvents(
    db,
    {
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      baseCurrency: "EUR",
      selfHost: null,
      source: "sdk",
    },
    [
      {
        event_id: "evt_agent_view",
        event_name: "page_view",
        event_version: 1,
        anonymous_id: "anon_agent",
        utm: { source: "youtube" },
        properties: {},
      },
      {
        event_id: "evt_agent_lead",
        event_name: "lead_created",
        event_version: 1,
        anonymous_id: "anon_agent",
        identify: { email: "agent@example.com" },
        properties: {},
      },
    ] as never,
  );

  await recordOrder(
    db,
    {
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      baseCurrency: "EUR",
      source: "STRIPE",
    },
    {
      externalId: "cs_agent",
      occurredAt: new Date(),
      grossMinor: 45_000,
      currency: "EUR",
      customer: { email: "agent@example.com" },
    },
  );
}

describe("agent loop", () => {
  it("calls a tool, feeds the result back, and answers from it", async () => {
    await seedSomeRevenue();

    const provider = new ScriptedProvider([
      {
        content: "",
        toolCalls: [
          { id: "call_1", name: "get_overview_metrics", arguments: { days: 90 } },
        ],
      },
      { content: "What happened\nRevenue is 450.00 EUR.", toolCalls: [] },
    ]);

    const result = await runAnalyst(provider, toolContext, "How is revenue?");

    expect(result.toolsUsed).toEqual(["get_overview_metrics"]);
    expect(result.truncated).toBe(false);
    expect(result.answer).toContain("450.00");

    // The trace holds the real tool output, so the answer can be checked.
    const [entry] = result.trace;
    expect(entry.error).toBeUndefined();
    expect(entry.result).toMatchObject({
      customers: 1,
      grossRevenue: { minorUnits: 45_000 },
    });

    // The second turn must have seen the tool result.
    const secondTurn = provider.seen[1];
    const toolMessage = secondTurn.find((message) => message.role === "tool");
    expect(toolMessage).toBeDefined();
    expect(String((toolMessage as { content: string }).content)).toContain("45000");
  });

  it("chains several tools in one answer", async () => {
    await seedSomeRevenue();

    const provider = new ScriptedProvider([
      {
        content: "",
        toolCalls: [
          { id: "a", name: "get_overview_metrics", arguments: {} },
          { id: "b", name: "get_tracking_health", arguments: {} },
        ],
      },
      {
        content: "",
        toolCalls: [{ id: "c", name: "get_channel_performance", arguments: {} }],
      },
      { content: "Done.", toolCalls: [] },
    ]);

    const result = await runAnalyst(provider, toolContext, "Full picture?");

    expect(result.toolsUsed).toEqual([
      "get_overview_metrics",
      "get_tracking_health",
      "get_channel_performance",
    ]);
    expect(result.trace).toHaveLength(3);
  });

  it("hands a tool failure back to the model instead of throwing", async () => {
    const provider = new ScriptedProvider([
      {
        content: "",
        // days must be an integer between 1 and 730.
        toolCalls: [
          { id: "bad", name: "get_overview_metrics", arguments: { days: -5 } },
        ],
      },
      { content: "I could not read that period.", toolCalls: [] },
    ]);

    const result = await runAnalyst(provider, toolContext, "Last -5 days?");

    expect(result.trace[0].error).toBeDefined();
    expect(result.answer).toContain("could not");
  });

  it("tolerates the model inventing a tool that does not exist", async () => {
    const provider = new ScriptedProvider([
      {
        content: "",
        toolCalls: [
          { id: "x", name: "get_secret_competitor_data", arguments: {} },
        ],
      },
      { content: "No such data is available.", toolCalls: [] },
    ]);

    const result = await runAnalyst(provider, toolContext, "Competitors?");

    expect(result.trace[0].error).toBe("Unknown tool");
    expect(result.answer).toContain("No such data");
  });

  it("stops after the iteration cap rather than looping forever", async () => {
    // A model that only ever calls tools and never concludes.
    const provider = new ScriptedProvider(
      Array.from({ length: 20 }, (_, i) => ({
        content: "",
        toolCalls: [
          { id: `loop_${i}`, name: "get_overview_metrics", arguments: {} },
        ],
      })),
    );

    const result = await runAnalyst(provider, toolContext, "Loop please");

    expect(result.truncated).toBe(true);
    expect(result.trace.length).toBeLessThanOrEqual(6);
  });
});

describe("tenant scoping", () => {
  it("cannot read another organization's data, whatever it asks for", async () => {
    await seedSomeRevenue();

    // A second tenant with much larger revenue.
    const other = await createTenant("Rival Corp");
    await recordOrder(
      db,
      {
        organizationId: other.organization.id,
        projectId: other.project.id,
        baseCurrency: "EUR",
        source: "STRIPE",
      },
      {
        externalId: "cs_rival",
        occurredAt: new Date(),
        grossMinor: 9_999_900,
        currency: "EUR",
        customer: { email: "rival@example.com" },
      },
    );

    const provider = new ScriptedProvider([
      {
        content: "",
        toolCalls: [
          {
            id: "scoped",
            name: "get_overview_metrics",
            // Even a deliberate attempt to widen scope changes nothing: the
            // tool is bound to a TenantContext the model cannot influence.
            arguments: { days: 90, projectId: other.project.id },
          },
        ],
      },
      { content: "Reported.", toolCalls: [] },
    ]);

    const result = await runAnalyst(provider, toolContext, "Everything");

    expect(result.trace[0].result).toMatchObject({
      grossRevenue: { minorUnits: 45_000 },
    });
    expect(JSON.stringify(result.trace[0].result)).not.toContain("9999900");
  });
});

describe("tool outputs", () => {
  it("carries the caveats that stop a model overstating a finding", async () => {
    await seedSomeRevenue();

    const provider = new ScriptedProvider([
      {
        content: "",
        toolCalls: [
          { id: "1", name: "compare_attribution_models", arguments: {} },
          { id: "2", name: "get_cohorts", arguments: {} },
        ],
      },
      { content: "Noted.", toolCalls: [] },
    ]);

    const result = await runAnalyst(provider, toolContext, "Attribution?");

    const attribution = JSON.stringify(result.trace[0].result);
    expect(attribution).toContain("NOT a statistical confidence interval");

    const cohorts = JSON.stringify(result.trace[1].result);
    expect(cohorts).toContain("never estimated");
  });

  it("reports unavailable rather than zero when there is no data", async () => {
    const provider = new ScriptedProvider([
      {
        content: "",
        toolCalls: [{ id: "1", name: "get_tracking_health", arguments: {} }],
      },
      { content: "No data yet.", toolCalls: [] },
    ]);

    const result = await runAnalyst(provider, toolContext, "Health?");

    expect(result.trace[0].result).toMatchObject({ score: null });
    expect(JSON.stringify(result.trace[0].result)).toContain("no data to assess");
  });
});
