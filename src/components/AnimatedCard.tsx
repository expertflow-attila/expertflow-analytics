"use client";

import { motion, useInView } from "framer-motion";
import { ReactNode, useRef } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function AnimatedCard({ children, delay = 0, className = "" }: AnimatedCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`card p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}
