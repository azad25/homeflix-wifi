"use client";

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

interface ParallaxSectionProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  offset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export const ParallaxSection: React.FC<ParallaxSectionProps> = ({
  children,
  speed = 0.5,
  className = '',
  offset = 0,
  direction = 'up'
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Create transforms directly based on direction with reduced movement to prevent hiding
  const yTransform = useTransform(scrollYProgress, [0, 1], [offset, direction === 'down' ? 30 * speed : -30 * speed]);
  const xTransform = useTransform(scrollYProgress, [0, 1], [offset, direction === 'right' ? 30 * speed : -30 * speed]);
  
  const springY = useSpring(yTransform, { stiffness: 100, damping: 30 });
  const springX = useSpring(xTransform, { stiffness: 100, damping: 30 });

  const getMotionStyle = () => {
    if (direction === 'left' || direction === 'right') {
      return { x: springX };
    }
    return { y: springY };
  };

  return (
    <div ref={ref} className={`relative ${className}`} style={{ position: 'relative', overflow: 'visible' }}>
      <motion.div style={getMotionStyle()}>
        {children}
      </motion.div>
    </div>
  );
};

export default ParallaxSection;
