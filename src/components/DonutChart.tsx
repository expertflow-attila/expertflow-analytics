"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: DonutChartProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div ref={ref} className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--color-bg-secondary)" strokeWidth="14"
        />
        {data.map((item, i) => {
          const pct = total > 0 ? item.value / total : 0;
          const dashLength = pct * circumference;
          const currentOffset = offset;
          offset += dashLength;
          return (
            <motion.circle
              key={item.label}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={item.color} strokeWidth="14"
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              initial={{ opacity: 0, strokeDasharray: `0 ${circumference}` }}
              animate={isInView ? { opacity: 1, strokeDasharray: `${dashLength} ${circumference - dashLength}` } : {}}
              transition={{ duration: 1, delay: i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          );
        })}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill="var(--color-text-primary)"
          fontSize="22" fontWeight="700" fontFamily="Arial">{total.toLocaleString("hu-HU")}</text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="var(--color-text-muted)"
          fontSize="10" fontFamily="Arial" letterSpacing="0.05em">ÖSSZESEN</text>
      </svg>
      <div className="space-y-2.5 min-w-0">
        {data.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 12 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: i * 0.1 + 0.3 }}
            className="flex items-center gap-2.5 text-[13px]"
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="truncate" style={{ color: "var(--color-text-secondary)" }}>{item.label}</span>
            <span className="ml-auto tabular-nums font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {item.value}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
