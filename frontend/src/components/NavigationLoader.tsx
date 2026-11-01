"use client";

import React, { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationLoader } from '@/contexts/NavigationLoaderContext';

const NavigationLoaderContent: React.FC = () => {
  const { isLoading, stopLoading } = useNavigationLoader();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Stop loading when pathname or search params change (page loaded)
    stopLoading();
  }, [pathname, searchParams, stopLoading]);

  // Only show the indicator for navigations that take a moment; prefetched
  // pages switch instantly and shouldn't flash anything.
  const [visible, setVisible] = React.useState(false);
  useEffect(() => {
    if (!isLoading) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Thin top progress bar (was a full-screen dimming overlay + spinner that
  // made every page change feel slow).
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nav-progress"
          className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          role="progressbar"
          aria-label="Loading page"
        >
          <motion.div
            className="h-full origin-left bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.6)]"
            initial={{ scaleX: 0.05 }}
            animate={{ scaleX: 0.85 }}
            transition={{ duration: 6, ease: [0.1, 0.7, 0.2, 1] }}
          />
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
