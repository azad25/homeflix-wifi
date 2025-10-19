"use client";

import React from "react";
import { motion } from "framer-motion";
import NowPlayingChannel from "@/components/NowPlayingChannel";

export default function NowPlayingPage() {
  return (
    <div className="h-screen bg-black overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="h-full"
      >
        <NowPlayingChannel />
      </motion.div>
    </div>
  );
}