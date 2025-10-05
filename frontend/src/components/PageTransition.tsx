"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RedLoader from './RedLoader';

interface PageTransitionProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

const PageTransition: React.FC<PageTransitionProps> = ({ 
  isLoading, 
  text = "Loading...", 
  children 
}) => {
  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <RedLoader size="large" showText text={text} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 20 : 0 }}
        transition={{ duration: 0.5, delay: isLoading ? 0 : 0.2 }}
      >
        {children}
      </motion.div>
    </>
  );
};

export default PageTransition;