"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}

export function BarChart({ data, height = 140 }: BarChartProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div ref={ref} className="flex items-end gap-[3px] justify-between" style={{ height: height + 28 }}>
      {data.map((item, i) => {
        const h = (item.value / max) * height;
        return (
          <div key={item.label} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <motion.span
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: i * 0.04 + 0.5 }}
              className="text-[10px] tabular-nums font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              {item.value}
            </motion.span>
            <motion.div
              initial={{ height: 0 }}
              animate={isInView ? { height: h } : {}}
              transition={{
                duration: 0.8,
                delay: i * 0.04,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="w-full rounded-sm min-h-[1px] relative overflow-hidden"
              style={{ background: item.color || "var(--color-text-muted)" }}
            >
              <div className="absolute inset-0 shimmer" />
            </motion.div>
            <span
              className="text-[9px] truncate w-full text-center font-medium"
              style={{ color: "var(--color-text-dim)" }}
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
