"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  glow?: boolean;
}

export function AnimatedCard({ children, delay = 0, className = "", glow }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`glass-card p-6 ${glow ? "glow-accent" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
