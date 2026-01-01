"use client";

import React, { useState } from 'react';
import { Settings, BarChart3 } from 'lucide-react';
import EnhancedWidgetConfigPanel from './EnhancedWidgetConfigPanel';
import WidgetPerformanceDashboard from './WidgetPerformanceDashboard';

interface WidgetManagementButtonProps {
  page: string;
  className?: string;
  showPerformance?: boolean;
}

export default function WidgetManagementButton({ 
  page, 
  className = '',
  showPerformance = false 
}: WidgetManagementButtonProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [showPerf, setShowPerf] = useState(false);

  // Only show in development or for admin users
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return null;

  return (
    <>
      <div className={`fixed bottom-4 right-4 z-40 flex flex-col gap-2 ${className}`}>
        <button
          onClick={() => setShowConfig(true)}
          className="bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 backdrop-blur-xl border border-red-400/20 text-white p-3 rounded-2xl shadow-2xl transition-all duration-200 hover:scale-110"
          title="Configure Widgets"
        >
          <Settings className="w-5 h-5" />
        </button>
        
        {showPerformance && (
          <button
            onClick={() => setShowPerf(true)}
            className="bg-gradient-to-r from-red-600/20 to-red-700/20 hover:from-red-600/30 hover:to-red-700/30 backdrop-blur-xl border border-red-500/20 text-white p-3 rounded-2xl shadow-2xl transition-all duration-200 hover:scale-110"
            title="Widget Performance"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
        )}
      </div>

      <EnhancedWidgetConfigPanel
        page={page}
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        onWidgetsChange={() => {
          // Trigger a page refresh or widget reload
          window.location.reload();
        }}
      />

      {showPerformance && (
        <WidgetPerformanceDashboard
          isOpen={showPerf}
          onClose={() => setShowPerf(false)}
        />
      )}
    </>
  );
}