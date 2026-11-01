"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  opacity?: number;
  border?: boolean;
  hover?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  blur = 'md',
  opacity = 0.1,
  border = true,
  hover = true
}) => {
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl'
  };

  const borderClass = border ? 'border border-white/10' : '';

  return (
    <motion.div
      // The background used to be the dynamic class `bg-white/[${opacity}]`,
      // which Tailwind can't see at build time, so it never applied.
      className={`${blurClasses[blur]} backdrop-saturate-150 ${borderClass} rounded-2xl shadow-xl ${className}`}
      style={{ backgroundColor: `rgba(255, 255, 255, ${Math.min(0.2, Math.max(0, opacity * 0.6))})` }}
      // No scale on hover: scaling large cards (e.g. the settings media panel)
      // shifts every control inside by 10-20px as the pointer enters, so
      // clicks landed beside buttons that were still moving.
      whileHover={hover ? {
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        borderColor: "rgba(255, 255, 255, 0.18)"
      } : {}}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
