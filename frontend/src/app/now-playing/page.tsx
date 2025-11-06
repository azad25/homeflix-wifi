"use client";

import React from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { motion } from "framer-motion";
import SimpleTVChannel from "@/components/SimpleTVChannel";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function NowPlayingPage() {
  usePageTitle('Now Playing');
  return (
    <ErrorBoundary>
      <div className="h-screen bg-black overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          <SimpleTVChannel />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}