"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface GradientBackgroundProps {
  variant?: 'netflix' | 'cosmic' | 'aurora' | 'sunset' | 'ocean';
  animate?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  variant = 'netflix',
  animate = true,
  className = '',
  children
}) => {
  const gradients = {
    netflix: 'bg-gradient-to-br from-red-900 via-black to-gray-900',
    cosmic: 'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900',
    aurora: 'bg-gradient-to-br from-green-400 via-blue-500 to-purple-600',
    sunset: 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-500',
    ocean: 'bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800'
  };

  const animationVariants = {
    initial: { backgroundPosition: '0% 50%' },
    animate: {
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
    }
  };

  return (
    <motion.div
      className={`
        ${gradients[variant]}
        ${animate ? 'bg-[length:400%_400%]' : ''}
        ${className}
      `}
      variants={animate ? animationVariants : undefined}
      initial={animate ? "initial" : undefined}
      animate={animate ? "animate" : undefined}
      transition={animate ? {
        duration: 15,
        repeat: Infinity,
        ease: "linear"
      } : undefined}
    >
      {children}
    </motion.div>
  );
};

export default GradientBackground;
