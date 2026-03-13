"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  delay?: number;
  suffix?: string;
}

export function ProgressBar({ label, value, max, color = "var(--color-chart-1)", delay = 0, suffix }: ProgressBarProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>{label}</span>
        <span className="text-[12px] tabular-nums font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {value.toLocaleString("hu-HU")}{suffix}
        </span>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "var(--color-bg-secondary)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: `${pct}%` } : {}}
          transition={{ duration: 1, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="h-full rounded-full relative overflow-hidden"
          style={{ background: color }}
        >
          <div className="absolute inset-0 shimmer" />
        </motion.div>
      </div>
    </div>
  );
}
