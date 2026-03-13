"use client";

import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  trend?: string;
  color?: string;
  delay?: number;
}

export function StatCard({ label, value, icon, trend, color = "var(--color-accent)", delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="glass-card p-6 relative overflow-hidden group cursor-default"
    >
      <div
        className="absolute top-0 left-0 w-full h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="flex items-start justify-between mb-4">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{
              background: trend.startsWith("+") ? "var(--color-success-dim)" : "var(--color-danger-dim)",
              color: trend.startsWith("+") ? "var(--color-success)" : "var(--color-danger)",
            }}
          >
            {trend}
          </span>
        )}
      </div>
      <motion.p
        className="text-3xl font-bold tracking-tight"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.2, type: "spring", stiffness: 200 }}
      >
        {typeof value === "number" ? value.toLocaleString("hu-HU") : value}
      </motion.p>
      <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </p>
      <div
        className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity"
        style={{ background: color }}
      />
    </motion.div>
  );
}
