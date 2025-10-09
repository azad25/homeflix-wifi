'use client';

import { useState, useEffect } from 'react';
import { invalidateCache } from '@/lib/globalApiCache';

export interface ConnectionStatus {
  isOnline: boolean;
  isServerReachable: boolean;
  lastChecked: Date | null;
}

export const useConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isServerReachable: false,
    lastChecked: null,
  });

  const checkServerConnection = async () => {
    try {
      // Clear all caches to get fresh data
      invalidateCache.all();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/api/media?limit=1', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      
      const isReachable = response.ok;
      setStatus(prev => ({
        ...prev,
        isServerReachable: isReachable,
        lastChecked: new Date(),
      }));

      return isReachable;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isServerReachable: false,
        lastChecked: new Date(),
      }));
      return false;
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      checkServerConnection();
    };

    const handleOffline = () => {
      setStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        isServerReachable: false 
      }));
    };

    // Initial server check
    checkServerConnection();

    // Set up periodic server checks (every 30 seconds)
    const serverCheckInterval = setInterval(checkServerConnection, 30000);

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      clearInterval(serverCheckInterval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  return {
    ...status,
    checkConnection: checkServerConnection,
  };
};
