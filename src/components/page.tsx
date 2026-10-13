import { AlertTriangle, Info } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { cn, formatPercent } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="min-w-0 space-y-1">
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-6 px-6 py-6", className)}>{children}</div>;
}

/**
 * Shown whenever the figures on screen come from the generated demo dataset.
 *
 * Presenting invented numbers as real measurements is the failure mode this
 * banner exists to prevent — it is not decoration, and it must not be
 * suppressed on any screen that reads seeded data.
 */
export function DemoDataBanner() {
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-warning/30 bg-warning-subtle px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p className="text-xs leading-relaxed text-foreground">
        <span className="font-medium">Demo dataset.</span> Every figure below is
        generated sample data from <code className="font-mono">pnpm db:seed</code>,
        not measurements of a real business. Connect a tracking source to replace
        it.
      </p>
    </div>
  );
}

/**
 * Confidence indicator. Analytics surfaces must never present a confident
 * number on top of data known to be incomplete.
 */
export function DataQualityBadge({
  score,
  detail,
}: {
  score: number | null;
  detail?: string;
}) {
  // A project with no events has no data quality to report. Showing a default
  // score there would be exactly the false confidence this badge guards against.
  if (score === null) {
    return (
      <Badge tone="neutral" title={detail}>
        Data quality unavailable
      </Badge>
    );
  }

  const tone = score >= 85 ? "positive" : score >= 60 ? "warning" : "negative";

  return (
    <Badge tone={tone} title={detail}>
      {score >= 85 ? null : <AlertTriangle className="size-3" aria-hidden />}
      Data quality {score}/100
    </Badge>
  );
}

export function StatTile({
  label,
  value,
  delta,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta?: { label: string; value: number | null };
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const deltaTone =
    delta?.value === null || delta?.value === undefined
      ? "text-muted-foreground"
      : delta.value > 0
        ? "text-positive"
        : delta.value < 0
          ? "text-negative"
          : "text-muted-foreground";

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3.5">
      <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1.5 text-xl font-semibold tracking-tight",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        {delta ? (
          <span className={cn("tabular text-xs font-medium", deltaTone)}>
            {delta.label}
          </span>
        ) : null}
        {hint ? (
          <span className="text-2xs text-subtle-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

/** A conversion rate rendered with its target, when the user set one. */
export function RateWithTarget({
  rate,
  target,
}: {
  rate: number | null;
  target: number | null;
}) {
  if (rate === null) return <span className="text-muted-foreground">—</span>;

  const variance = target === null ? null : rate - target;

  return (
    <span className="tabular inline-flex items-baseline gap-1.5">
      <span className="font-medium">{formatPercent(rate)}</span>
      {variance === null ? null : (
        <span
          className={cn(
            "text-2xs",
            variance >= 0 ? "text-positive" : "text-negative",
          )}
        >
          {variance > 0 ? "+" : ""}
          {(variance * 100).toFixed(1)} pp vs target
        </span>
      )}
    </span>
  );
}
