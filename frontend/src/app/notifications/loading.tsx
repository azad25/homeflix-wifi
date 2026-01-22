"use client";

import React from 'react';
import { motion } from 'framer-motion';

const NotificationsLoading: React.FC = () => {
  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />
      
      {/* Loading tiles animation */}
      <div className="absolute inset-0">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl border border-white/10"
            style={{
              left: `${(i % 4) * 25}%`,
              top: `${Math.floor(i / 4) * 33}%`,
              width: '20%',
              height: '25%',
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0, 0.6, 0],
              scale: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
          </motion.div>
        ))}
      </div>
      
      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full"
            />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Live Activity</h2>
          <p className="text-white/60">Preparing your personalized notifications...</p>
        </div>
      </div>
      
      {/* Bottom info */}
      <div className="absolute bottom-4 left-4 text-white/40 text-sm">
        <p>Live Activity • Loading...</p>
      </div>
    </div>
  );
};

export default NotificationsLoading;