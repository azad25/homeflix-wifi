"use client";

import React from "react";
import { motion } from "framer-motion";
import NowPlayingChannel from "@/components/NowPlayingChannel";

export default function NowPlayingPage() {
  return (
    <div className="min-h-screen bg-black">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="pt-12 lg:pt-16"
      >
        <div className="container mx-auto px-2 lg:px-4">
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="mb-4 lg:mb-6"
          >
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-white mb-2 tracking-wider">
                HOMEFLIX TV
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm">
                Live streaming channel • Tap anywhere to show controls
              </p>
            </div>
          </motion.div>

          <NowPlayingChannel />
        </div>
      </motion.div>
    </div>
  );
}