"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

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
      {children}
    </NavigationLoaderContext.Provider>
  );
};
