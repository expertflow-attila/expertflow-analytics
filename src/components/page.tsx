import { AlertTriangle, Info } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { cn, formatPercent, formatPointDelta } from "@/lib/utils";

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
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-7 sm:px-8 lg:px-10 lg:py-9">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
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
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-8 lg:px-10 lg:py-8",
        className,
      )}
    >
      {children}
    </div>
  );
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
        <span className="font-medium">Demóadatok.</span> Az alábbi értékek
        generált mintaadatok. Nem egy valódi vállalkozás mérései. Éles adatokhoz
        csatlakoztass mérési forrást.
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
        Az adatminőség még nem mérhető
      </Badge>
    );
  }

  const tone = score >= 85 ? "positive" : score >= 60 ? "warning" : "negative";

  return (
    <Badge tone={tone} title={detail}>
      {score >= 85 ? null : <AlertTriangle className="size-3" aria-hidden />}
      Adatminőség {score}/100
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
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-5">
      <p className="font-mono text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-3 text-[clamp(1.5rem,2.2vw,2.25rem)] font-medium leading-tight tracking-[-0.045em]",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
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
          {formatPointDelta(variance)} a célhoz képest
        </span>
      )}
    </span>
  );
}
