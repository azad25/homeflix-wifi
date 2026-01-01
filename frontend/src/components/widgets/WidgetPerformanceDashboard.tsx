"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  RefreshCw,
  X
} from 'lucide-react';
import { useWidgetPerformance } from '@/hooks/useWidgetPerformance';

interface WidgetPerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WidgetPerformanceDashboard({ isOpen, onClose }: WidgetPerformanceDashboardProps) {
  const { stats, metrics, getPerformanceReport, clearMetrics } = useWidgetPerformance();
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'recommendations'>('overview');

  const report = getPerformanceReport();

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getPerformanceColor = (time: number) => {
    if (time < 1000) return 'text-green-400';
    if (time < 2000) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPerformanceIcon = (time: number) => {
    if (time < 1000) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (time < 2000) return <Activity className="w-4 h-4 text-yellow-400" />;
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Widget Performance Dashboard</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearMetrics}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Clear Metrics"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'details', label: 'Details', icon: Clock },
              { id: 'recommendations', label: 'Recommendations', icon: AlertTriangle }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-gray-400">Loaded</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.loadedWidgets}/{stats.totalWidgets}
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-400">Avg Load Time</span>
                    </div>
                    <div className={`text-2xl font-bold ${getPerformanceColor(stats.averageLoadTime)}`}>
                      {formatTime(stats.averageLoadTime)}
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-gray-400">Error Rate</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.errorRate.toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-gray-400">Total Errors</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.totalErrors}
                    </div>
                  </div>
                </div>

                {/* Performance Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.fastestWidget && (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-green-400">Fastest Widget</span>
                      </div>
                      <div className="text-white font-medium">{stats.fastestWidget.widgetType}</div>
                      <div className="text-sm text-gray-400">
                        {formatTime(stats.fastestWidget.loadDuration!)}
                      </div>
                    </div>
                  )}

                  {stats.slowestWidget && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-medium text-red-400">Slowest Widget</span>
                      </div>
                      <div className="text-white font-medium">{stats.slowestWidget.widgetType}</div>
                      <div className="text-sm text-gray-400">
                        {formatTime(stats.slowestWidget.loadDuration!)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Widget Performance Details</h3>
                <div className="space-y-2">
                  {Array.from(metrics.values()).map((metric) => (
                    <div key={metric.widgetId} className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getPerformanceIcon(metric.loadDuration || 0)}
                          <span className="font-medium text-white">{metric.widgetType}</span>
                          <span className="text-sm text-gray-400">#{metric.widgetId}</span>
                        </div>
                        <div className={`text-sm font-medium ${getPerformanceColor(metric.loadDuration || 0)}`}>
                          {metric.loadDuration ? formatTime(metric.loadDuration) : 'Loading...'}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Data Fetch:</span>
                          <div className="text-white">
                            {metric.dataFetchTime ? formatTime(metric.dataFetchTime) : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Render:</span>
                          <div className="text-white">
                            {metric.renderTime ? formatTime(metric.renderTime) : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Errors:</span>
                          <div className="text-white">{metric.errorCount}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Retries:</span>
                          <div className="text-white">{metric.retryCount}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Performance Recommendations</h3>
                {report.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {report.recommendations.map((recommendation, index) => (
                      <div key={index} className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-yellow-200">{recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6 text-center">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-green-200">All widgets are performing well!</p>
                    <p className="text-sm text-gray-400 mt-1">No performance issues detected.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}