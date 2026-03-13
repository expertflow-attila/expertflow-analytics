"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface MiniLineChartProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  showDots?: boolean;
}

export function MiniLineChart({ data, color = "#FAFAFA", width = 300, height = 100, showDots }: MiniLineChartProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 8;

  const coords = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: height - pad - ((v - min) / range) * (height - pad * 2),
  }));

  // Smooth curve
  const linePath = coords.reduce((path, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = coords[i - 1];
    const cpx1 = prev.x + (p.x - prev.x) * 0.4;
    const cpx2 = p.x - (p.x - prev.x) * 0.4;
    return `${path} C ${cpx1},${prev.y} ${cpx2},${p.y} ${p.x},${p.y}`;
  }, "");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`;

  const gradId = `area-grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradId})`}
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, delay: 0.3 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
      {showDots && coords.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x} cy={p.y} r="2"
          fill={color}
          initial={{ opacity: 0, scale: 0 }}
          animate={isInView ? { opacity: 0.6, scale: 1 } : {}}
          transition={{ delay: (i / coords.length) * 1.5 + 0.2 }}
        />
      ))}
    </svg>
  );
}
