"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface NavigationLoaderContextType {
  isLoading: boolean;
  startLoading: () => void;
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
  setIsLoading: (loading: boolean) => void;
}> = ({ children, setIsLoading }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Stop loading when route changes complete
  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams, setIsLoading]);

  return <>{children}</>;
};

export const NavigationLoaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <NavigationLoaderContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      <Suspense fallback={children}>
        <NavigationLoaderInner setIsLoading={setIsLoading}>
          {children}
        </NavigationLoaderInner>
      </Suspense>
    </NavigationLoaderContext.Provider>
  );
};
