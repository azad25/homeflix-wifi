"use client";

import React from "react";
import { motion } from "framer-motion";

interface NewsItem {
  id: string;
  text: string;
  source: string;
  time: string;
}

interface BreakingNewsTickerProps {
  newsItems: NewsItem[];
  currentTime: string;
  isFullscreen: boolean;
}

const BreakingNewsTicker: React.FC<BreakingNewsTickerProps> = ({
  newsItems,
  currentTime,
  isFullscreen,
}) => {
  // Fallback news if no items are available
  const fallbackNews = [
    "Global markets show mixed results amid economic uncertainty",
    "Technology sector reports strong quarterly earnings",
    "International summit reaches breakthrough agreement",
    "Climate change initiatives gain momentum worldwide",
    "Space exploration mission achieves major milestone",
    "Healthcare breakthrough offers new treatment options"
  ];

  // Use fallback news if no news items available
  const displayItems = newsItems.length > 0 ? newsItems : fallbackNews.map((text, index) => ({
    id: `fallback-${index}`,
    text,
    source: "News",
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
  }));

  // Create a continuous string of news items without source
  const newsText = displayItems
    .map((item) => typeof item === 'string' ? item : item.text)
    .join("    •    ");

  console.log("BreakingNewsTicker render:", { newsItemsLength: newsItems.length, displayItemsLength: displayItems.length, currentTime });

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="flex items-stretch h-6 px-1" style={{ backgroundColor: '#1B1B1B' }}>
        {/* Breaking News Label */}
        {/* <div 
          className="flex items-center justify-center px-4 text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: '#7F1D1D' }}
        >
          BREAKING NEWS
        </div> */}

        {/* Scrolling News Text */}
        <div className="flex-1 overflow-hidden relative flex items-center">
          <motion.div
            className="whitespace-nowrap text-white text-sm font-medium px-4"
            animate={{
              x: ["100%", "-100%"],
            }}
            transition={{
              duration: 100, // Slower scroll for better readability
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {newsText}
          </motion.div>
        </div>

        {/* Digital Clock */}
        <div
          className="flex items-center justify-center px-4 font-mono text-white text-sm font-bold flex-shrink-0 min-w-[80px]"
          style={{ backgroundColor: '#7F1D1D' }}
        >
          {currentTime || "00:00"}
        </div>
      </div>
    </div>
  );
};

export default BreakingNewsTicker;