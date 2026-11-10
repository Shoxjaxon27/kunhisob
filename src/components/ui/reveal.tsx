"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

/**
 * Bo'lim ketma-ket yengil paydo bo'ladi (stagger). Animatsiya sozlamasi (Providers → MotionConfig)
 * "Kamaytirilgan"/"O'chirilgan" rejimda va tizim reduced-motion'da deyarli bir zumda bajariladi.
 */
export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
