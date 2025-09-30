"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";

interface Card {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  background: string;
}

interface ParallaxCardsProps {
  cards: Card[];
}

const ParallaxCard: React.FC<{ card: Card; index: number; totalCards: number; scrollYProgress: MotionValue<number> }> = ({ 
  card, 
  index, 
  totalCards, 
  scrollYProgress 
}) => {
  const targetScale = 1 - (totalCards - index) * 0.05;
  const scale = useTransform(
    scrollYProgress,
    [index * 0.25, (index + 1) * 0.25],
    [1, targetScale]
  );

  return (
    <motion.div
      style={{
        scale,
        background: card.background,
      }}
      className="absolute flex h-[80vh] w-[90vw] max-w-4xl items-center justify-center rounded-3xl p-8 shadow-2xl"
    >
      <CardContent card={card} />
    </motion.div>
  );
};

const ParallaxCards: React.FC<ParallaxCardsProps> = ({ cards }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  return (
    <div ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {cards.map((card, index) => (
          <ParallaxCard
            key={card.id}
            card={card}
            index={index}
            totalCards={cards.length}
            scrollYProgress={scrollYProgress}
          />
        ))}
      </div>
    </div>
  );
};

const CardContent: React.FC<{ card: Card }> = ({ card }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full not-prose text-inherit text-center">
      <div className="mb-4 text-6xl">{card.icon}</div>
      <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
        {card.title}
      </h2>
      <p className="text-lg max-w-2xl mb-6 text-white/90">
        {card.description}
      </p>
      <Button variant={card.variant}>Learn More →</Button>
    </div>
  );
};

const Button: React.FC<{
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}> = ({ children, variant = "default", className = "" }) => {
  const baseClasses = "px-6 py-3 rounded-lg font-medium transition-all duration-200";
  
  const variantClasses = {
    default: "bg-red-600 hover:bg-red-700 text-white",
    destructive: "bg-red-500 hover:bg-red-600 text-white",
    outline: "border-2 border-white text-white hover:bg-white hover:text-black",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white",
    ghost: "hover:bg-white/10 text-white",
    link: "text-white underline hover:no-underline",
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </button>
  );
};

export default ParallaxCards;
