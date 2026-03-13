"use client";

import { motion, useInView, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  description?: string;
  index?: number;
  accentColor?: string;
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 50, damping: 20, mass: 1 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString("hu-HU"));

  useEffect(() => {
    if (isInView) spring.set(value);
  }, [isInView, spring, value]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

export function StatCard({ label, value, suffix, description, index = 0, accentColor }: StatCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="card p-6 relative overflow-hidden group"
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-4 right-4 h-px"
        style={{
          background: accentColor
            ? `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`
            : "linear-gradient(90deg, transparent, var(--color-border-light), transparent)",
        }}
      />

      {/* Number label */}
      <div className="flex items-center justify-between mb-6">
        <span className="num-label">0{index + 1}</span>
      </div>

      {/* Value */}
      <div className="mb-2">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          <AnimatedNumber value={value} />
          {suffix && <span className="text-lg ml-1" style={{ color: "var(--color-text-muted)" }}>{suffix}</span>}
        </span>
      </div>

      {/* Label */}
      <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </p>
      {description && (
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          {description}
        </p>
      )}

      {/* Subtle glow on hover */}
      <div
        className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: accentColor
            ? `radial-gradient(circle, ${accentColor}08, transparent)`
            : "radial-gradient(circle, rgba(255,255,255,0.02), transparent)",
        }}
      />
    </motion.div>
  );
}
