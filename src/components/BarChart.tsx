"use client";

import { motion } from "framer-motion";

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxHeight?: number;
  delay?: number;
}

export function BarChart({ data, maxHeight = 160, delay = 0 }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2 justify-between" style={{ height: maxHeight + 32 }}>
      {data.map((item, i) => {
        const height = (item.value / max) * maxHeight;
        return (
          <div key={item.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + i * 0.05 + 0.4 }}
              className="text-xs tabular-nums"
              style={{ color: "var(--color-text-muted)" }}
            >
              {item.value}
            </motion.span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height }}
              transition={{
                duration: 0.6,
                delay: delay + i * 0.05,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="w-full rounded-t-md min-h-[2px]"
              style={{
                background: `linear-gradient(180deg, ${item.color || "var(--color-accent)"}, ${item.color || "var(--color-accent)"}66)`,
              }}
            />
            <span
              className="text-[10px] truncate w-full text-center"
              style={{ color: "var(--color-text-muted)" }}
              title={item.label}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
