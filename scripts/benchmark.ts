/**
 * Analytics benchmark and smoke check.
 *
 * Runs the real query layer against the seeded dataset, prints timings, and
 * verifies the engines produce coherent numbers. Results are recorded in
 * docs/architecture.md — the point is a measured figure, not a claimed SLA.
 *
 * Run with: pnpm tsx scripts/benchmark.ts
 */
import "dotenv/config";

import { eq } from "drizzle-orm";

import { attributeByChannel, attributionConfidence } from "@/lib/analytics/attribution-core";
import { calculateTrackingHealth } from "@/lib/analytics/anomaly-core";
import { calculateCohorts } from "@/lib/analytics/ltv-core";
import { rankOpportunities } from "@/lib/analytics/opportunity-core";
import { db } from "@/server/db";
import { funnels, projects } from "@/server/db/schema";
import {
  loadConversions,
  loadCustomers,
  loadFunnel,
  loadObservedPaths,
  loadOverview,
  loadTrackingHealthInput,
  rangeDays,
} from "@/server/analytics/queries";
import type { TenantContext } from "@/server/tenancy";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  console.log(`  ${label.padEnd(28)} ${ms.toFixed(0).padStart(6)} ms`);
  return result;
}

async function main() {
  const [project] = await db.select().from(projects).limit(1);
  if (!project) throw new Error("No project found — run pnpm db:seed first.");

  const ctx: TenantContext = {
    userId: "benchmark",
    organizationId: project.organizationId,
    projectId: project.id,
    role: "OWNER",
    timezone: "Europe/Budapest",
    baseCurrency: project.baseCurrency,
  };

  const range = {
    from: new Date(Date.now() - 150 * 86_400_000),
    to: new Date(),
  };

  console.log("\nQuery timings\n");

  const overview = await time("overview", () => loadOverview(ctx, range));
  const [funnel] = await db
    .select()
    .from(funnels)
    .where(eq(funnels.projectId, project.id))
    .limit(1);

  const funnelData = await time("funnel (8 steps)", () =>
    loadFunnel(ctx, funnel.id, range),
  );
  const { conversions, unattributableOrders } = await time("conversions", () =>
    loadConversions(ctx, range, 90),
  );
  const customers = await time("customers / cohorts", () =>
    loadCustomers(ctx, "month"),
  );
  const health = await time("tracking health", () =>
    loadTrackingHealthInput(ctx, range),
  );
  const paths = await time("observed paths", () =>
    loadObservedPaths(ctx, range, { onlyBuyers: true }),
  );

  console.log("\nOverview\n");
  console.log(`  visitors        ${overview.visitors.toLocaleString()}`);
  console.log(`  leads           ${overview.leads.toLocaleString()}`);
  console.log(`  customers       ${overview.customers}`);
  console.log(
    `  net revenue     EUR ${(overview.netRevenueMinor / 100).toLocaleString()}`,
  );

  if (!funnelData) throw new Error("Funnel failed to load");

  console.log("\nFunnel\n");
  for (const node of funnelData.result.nodes) {
    const rate =
      node.conversionRate === null
        ? "     —"
        : `${(node.conversionRate * 100).toFixed(1)}%`.padStart(6);
    const variance =
      node.varianceToTargetPoints === null
        ? ""
        : `  target ${(node.targetConversionRate! * 100).toFixed(0)}%  variance ${(node.varianceToTargetPoints * 100).toFixed(1)} pp`;
    console.log(
      `  ${node.name.padEnd(20)} ${String(node.entered).padStart(7)} → ${rate}${variance}`,
    );
  }

  const periodDays = rangeDays(range);
  const opportunities = rankOpportunities(
    funnelData.result.nodes
      .filter((n) => n.conversionRate !== null)
      .map((node) => ({
        node,
        downstreamRevenuePerConversionMinor:
          node.converted === 0
            ? 0
            : Math.round(node.downstreamRevenueMinor / node.converted),
        periodDays,
        effort: 3,
      })),
    { kind: "TARGET" },
  );

  console.log("\nTop opportunities\n");
  for (const [index, opportunity] of opportunities.slice(0, 3).entries()) {
    console.log(
      `  #${index + 1} ${opportunity.nodeName.padEnd(20)} ` +
        `EUR ${(opportunity.estimatedMonthlyUpsideMinor / 100).toLocaleString()}/mo  ` +
        `${opportunity.confidence}`,
    );
  }

  console.log("\nAttribution (last touch vs first touch)\n");
  const lastTouch = attributeByChannel(conversions, {
    model: "LAST_TOUCH",
    windowDays: 90,
    includeDirect: true,
    includeOrganic: true,
  });
  const firstTouch = attributeByChannel(conversions, {
    model: "FIRST_TOUCH",
    windowDays: 90,
    includeDirect: true,
    includeOrganic: true,
  });

  for (const row of lastTouch.slice(0, 6)) {
    const first = firstTouch.find((r) => r.channel === row.channel);
    console.log(
      `  ${row.channel.padEnd(18)} last EUR ${String((row.attributedRevenueMinor / 100).toFixed(0)).padStart(8)}` +
        `   first EUR ${String(((first?.attributedRevenueMinor ?? 0) / 100).toFixed(0)).padStart(8)}`,
    );
  }

  const confidence = attributionConfidence(conversions, {
    windowDays: 90,
    includeDirect: true,
    includeOrganic: true,
  });
  console.log(
    `\n  Largest disagreement: ${confidence[0]?.channel} (${((confidence[0]?.disagreement ?? 0) * 100).toFixed(0)}%, band ${confidence[0]?.band})`,
  );
  console.log(`  Orders with no resolvable person: ${unattributableOrders}`);

  const cohorts = calculateCohorts(customers);
  console.log("\nCohorts\n");
  for (const cohort of cohorts) {
    console.log(
      `  ${cohort.cohortKey}  n=${String(cohort.customers).padStart(3)}  ` +
        `30d LTV ${fmt(cohort.ltvByHorizon[30])}  90d LTV ${fmt(cohort.ltvByHorizon[90])}  ` +
        `lifetime ${fmt(cohort.lifetimeLtvMinor)}`,
    );
  }

  const trackingHealth = calculateTrackingHealth(health);
  console.log(`\nTracking health: ${trackingHealth.score} / 100\n`);
  for (const check of trackingHealth.checks) {
    const mark = check.status === "PASS" ? "ok  " : check.status === "WARN" ? "warn" : "fail";
    console.log(`  [${mark}] ${check.label.padEnd(28)} ${check.detail}`);
  }

  console.log("\nMost common buyer paths\n");
  for (const path of paths.slice(0, 3)) {
    console.log(`  ${path.people.toString().padStart(3)}x  ${path.path}`);
  }

  console.log();
  process.exit(0);
}

function fmt(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "     —";
  return `EUR ${(minor / 100).toFixed(0)}`.padStart(10);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
