"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface NavigationLoaderContextType {
  isLoading: boolean;
  startLoading: (href?: string) => void;
  stopLoading: () => void;
}

const NavigationLoaderContext = createContext<NavigationLoaderContextType>({
  isLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export const useNavigationLoader = () => {
  const context = useContext(NavigationLoaderContext);
  if (!context) {
    throw new Error('useNavigationLoader must be used within NavigationLoaderProvider');
  }
  return context;
};

// Inner component that uses useSearchParams
const NavigationLoaderInner: React.FC<{ 
  children: React.ReactNode;
  setIsLoading: () => void;
}> = ({ children, setIsLoading }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Stop loading when route changes complete
  useEffect(() => {
    setIsLoading();
  }, [pathname, searchParams, setIsLoading]);

  return <>{children}</>;
};

// Never leave the indicator up if a navigation is cancelled or fails.
const LOADING_SAFETY_TIMEOUT_MS = 8000;

const currentUrl = () =>
  typeof window === 'undefined' ? '' : window.location.pathname + window.location.search;

export const NavigationLoaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const safetyRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopLoading = useCallback(() => {
    if (safetyRef.current) clearTimeout(safetyRef.current);
    safetyRef.current = null;
    setIsLoading(false);
  }, []);

  // `href` lets us skip same-URL navigations: the route never changes in
  // that case, so the loader used to stay up forever (the "stuck spinner").
  const startLoading = useCallback((href?: string) => {
    if (href) {
      try {
        const target = new URL(href, window.location.href);
        if (target.origin !== window.location.origin) return;
        if (target.pathname + target.search === currentUrl()) return;
      } catch {
        /* relative or odd href: fall through */
      }
    }
    if (safetyRef.current) clearTimeout(safetyRef.current);
    safetyRef.current = setTimeout(() => setIsLoading(false), LOADING_SAFETY_TIMEOUT_MS);
    setIsLoading(true);
  }, []);

  useEffect(() => () => {
    if (safetyRef.current) clearTimeout(safetyRef.current);
  }, []);

  return (
    <NavigationLoaderContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      <Suspense fallback={children}>
        <NavigationLoaderInner setIsLoading={stopLoading as any}>
          {children}
        </NavigationLoaderInner>
      </Suspense>
    </NavigationLoaderContext.Provider>
  );
};
