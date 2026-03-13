"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  delay?: number;
  suffix?: string;
}

export function ProgressBar({ label, value, max, color = "var(--color-accent)", delay = 0, suffix }: ProgressBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span style={{ color: "var(--color-text-primary)" }}>{label}</span>
        <span className="tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
          {value.toLocaleString("hu-HU")}{suffix}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-primary)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
        />
      </div>
    </div>
  );
}
