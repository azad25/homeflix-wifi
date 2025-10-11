"use client";

import React, { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import RedLoader from './RedLoader';
import { useNavigationLoader } from '@/contexts/NavigationLoaderContext';

const NavigationLoaderContent: React.FC = () => {
  const { isLoading, stopLoading } = useNavigationLoader();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Stop loading when pathname or search params change (page loaded)
    stopLoading();
  }, [pathname, searchParams, stopLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex flex-col items-center gap-4">
            <RedLoader size="large" showText={true} text="" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const NavigationLoader: React.FC = () => {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderContent />
    </Suspense>
  );
};

export default NavigationLoader;
