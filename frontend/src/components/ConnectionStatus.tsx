'use client';

import React, { useEffect, useState } from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { Wifi, WifiOff, Server, ServerOff } from 'lucide-react';

const ConnectionStatus: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const { isOnline, isServerReachable, lastChecked, checkConnection } = useConnectionStatus();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Don't render on server side
  }

  if (isOnline && isServerReachable) {
    return null; // Don't show anything when everything is working
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-black/90 backdrop-blur-sm border border-red-500/50 rounded-lg p-4 max-w-sm">
        <div className="flex items-center space-x-3">
          {!isOnline ? (
            <WifiOff className="text-red-500 w-5 h-5" />
          ) : !isServerReachable ? (
            <ServerOff className="text-orange-500 w-5 h-5" />
          ) : null}
          
          <div className="flex-1">
            <div className="text-sm font-medium text-white">
              {!isOnline ? 'No Internet Connection' : 'Server Disconnected'}
            </div>
            <div className="text-xs text-gray-400">
              {!isOnline 
                ? 'Check your network connection' 
                : 'Unable to reach HomeFlix server'
              }
            </div>
            {lastChecked && (
              <div className="text-xs text-gray-500 mt-1">
                Last checked: {lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          {isOnline && !isServerReachable && (
            <button
              onClick={checkConnection}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus;
