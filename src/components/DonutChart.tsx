"use client";

import { motion } from "framer-motion";

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  delay?: number;
}

export function DonutChart({ data, size = 160, delay = 0 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bg-primary)"
          strokeWidth="16"
        />
        {data.map((item, i) => {
          const pct = total > 0 ? item.value / total : 0;
          const dashLength = pct * circumference;
          const currentOffset = offset;
          offset += dashLength;

          return (
            <motion.circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: delay + i * 0.1 }}
            />
          );
        })}
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          fill="var(--color-text-primary)"
          fontSize="24"
          fontWeight="bold"
          fontFamily="Arial"
        >
          {total.toLocaleString("hu-HU")}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          fill="var(--color-text-muted)"
          fontSize="11"
          fontFamily="Arial"
        >
          Összesen
        </text>
      </svg>
      <div className="space-y-2 min-w-0">
        {data.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + i * 0.08 }}
            className="flex items-center gap-2 text-sm"
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="truncate" style={{ color: "var(--color-text-secondary)" }}>{item.label}</span>
            <span className="ml-auto tabular-nums font-medium" style={{ color: "var(--color-text-primary)" }}>
              {item.value}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
