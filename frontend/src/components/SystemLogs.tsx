"use client";

import React, { useState, useEffect } from 'react';
import { Activity, HardDrive, Server, TrendingUp, Timer, FileSearch, Trash2, RefreshCw, Search, X } from 'lucide-react';
import { GlassCard, ScrollReveal, MagneticButton } from '@/components/scrollx';
import { getApiUrl } from '@/lib/api';

interface SystemStats {
  cpu?: {
    usage: number;
    cores: number;
    load_avg_1: number;
    load_avg_5: number;
    load_avg_15: number;
  };
  memory?: {
    total: number;
    used: number;
    available: number;
    used_percent: number;
    cached: number;
    buffers: number;
  };
  disk?: {
    total: number;
    used: number;
    free: number;
    used_percent: number;
  };
  network?: {
    bytes_received: number;
    bytes_sent: number;
    packets_received: number;
    packets_sent: number;
  };
  process?: {
    pid: number;
    cpu_percent: number;
    memory_mb: number;
    memory_percent: number;
    threads: number;
    open_files: number;
  };
  timestamp?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

interface SystemLogsProps {
  onTerminalOutput?: (message: string) => void;
}

export default function SystemLogs({ onTerminalOutput }: SystemLogsProps) {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [serverLogs, setServerLogs] = useState<LogEntry[]>([]);
  const [isLogsConnected, setIsLogsConnected] = useState(false);
  const [isStatsConnected, setIsStatsConnected] = useState(false);
  const [logsWebSocket, setLogsWebSocket] = useState<WebSocket | null>(null);
  const [statsWebSocket, setStatsWebSocket] = useState<WebSocket | null>(null);
  const [filterText, setFilterText] = useState('');

  const addTerminalOutput = (message: string) => {
    if (onTerminalOutput) {
      onTerminalOutput(message);
    }
  };

  useEffect(() => {
    connectToSystemLogs();
    connectToSystemStats();

    return () => {
      disconnectWebSockets();
    };
  }, []);

  const connectToSystemLogs = () => {
    try {
      const apiUrl = getApiUrl().replace('http', 'ws');
      const ws = new WebSocket(`${apiUrl}/api/admin/system/logs/stream`);
      
      ws.onopen = () => {
        setIsLogsConnected(true);
        addTerminalOutput('🔗 Connected to real-time server logs');
      };

      ws.onmessage = (event) => {
        try {
          const logEntry = JSON.parse(event.data);
          setServerLogs(prev => [...prev.slice(-99), logEntry]); // Keep last 100 logs
        } catch (error) {
          console.error('Error parsing log entry:', error);
        }
      };

      ws.onclose = () => {
        setIsLogsConnected(false);
        addTerminalOutput('❌ Disconnected from server logs');
      };

      ws.onerror = () => {
        setIsLogsConnected(false);
        addTerminalOutput('❌ Server logs connection error');
      };

      setLogsWebSocket(ws);
    } catch (error) {
      addTerminalOutput('❌ Failed to connect to server logs');
    }
  };

  const connectToSystemStats = () => {
    try {
      const apiUrl = getApiUrl().replace('http', 'ws');
      const ws = new WebSocket(`${apiUrl}/api/admin/system/stats/stream`);
      
      ws.onopen = () => {
        setIsStatsConnected(true);
        addTerminalOutput('📊 Connected to real-time system stats');
      };

      ws.onmessage = (event) => {
        try {
          const stats = JSON.parse(event.data);
          setSystemStats(stats);
        } catch (error) {
          console.error('Error parsing system stats:', error);
        }
      };

      ws.onclose = () => {
        setIsStatsConnected(false);
        addTerminalOutput('❌ Disconnected from system stats');
      };

      ws.onerror = () => {
        setIsStatsConnected(false);
        addTerminalOutput('❌ System stats connection error');
      };

      setStatsWebSocket(ws);
    } catch (error) {
      addTerminalOutput('❌ Failed to connect to system stats');
    }
  };

  const disconnectWebSockets = () => {
    if (logsWebSocket) {
      logsWebSocket.close();
      setLogsWebSocket(null);
    }
    if (statsWebSocket) {
      statsWebSocket.close();
      setStatsWebSocket(null);
    }
    setIsLogsConnected(false);
    setIsStatsConnected(false);
  };

  const fetchInitialLogs = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/system/logs?lines=50`);
      if (response.ok) {
        const data = await response.json();
        setServerLogs(data.logs || []);
        addTerminalOutput(`📋 Loaded ${data.logs?.length || 0} recent log entries`);
      }
    } catch (error) {
      addTerminalOutput('❌ Failed to fetch initial logs');
    }
  };

  // Filter logs based on search text
  const filteredLogs = serverLogs.filter(log => {
    if (!filterText.trim()) return true;
    
    const searchText = filterText.toLowerCase();
    return (
      log.message?.toLowerCase().includes(searchText) ||
      log.level?.toLowerCase().includes(searchText) ||
      log.source?.toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="space-y-6">
      <ScrollReveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Activity className="w-6 h-6 mr-3 text-[#E50914]" />
              System Dashboard
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isLogsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-white/70 text-sm">Logs {isLogsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isStatsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-white/70 text-sm">Stats {isStatsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>

          {/* System Resource Monitor */}
          {systemStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* CPU Stats */}
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-blue-400 text-sm font-medium">CPU Usage</div>
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.cpu?.usage?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-white/60 text-xs">
                  {systemStats.cpu?.cores || 0} cores • Load: {systemStats.cpu?.load_avg_1?.toFixed(2) || '0.00'}
                </div>
                <div className="mt-2 bg-black/30 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-400 h-full transition-all duration-500"
                    style={{ width: `${Math.min(systemStats.cpu?.usage || 0, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Memory Stats */}
              <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-lg p-4 border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-green-400 text-sm font-medium">Memory</div>
                  <HardDrive className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.memory?.used_percent?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-white/60 text-xs">
                  {((systemStats.memory?.used || 0) / (1024 ** 3)).toFixed(1)}GB / {((systemStats.memory?.total || 0) / (1024 ** 3)).toFixed(1)}GB
                </div>
                <div className="mt-2 bg-black/30 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-green-400 h-full transition-all duration-500"
                    style={{ width: `${Math.min(systemStats.memory?.used_percent || 0, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Disk Stats */}
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-lg p-4 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-purple-400 text-sm font-medium">Disk Usage</div>
                  <HardDrive className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.disk?.used_percent?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-white/60 text-xs">
                  {((systemStats.disk?.used || 0) / (1024 ** 3)).toFixed(1)}GB / {((systemStats.disk?.total || 0) / (1024 ** 3)).toFixed(1)}GB
                </div>
                <div className="mt-2 bg-black/30 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-purple-400 h-full transition-all duration-500"
                    style={{ width: `${Math.min(systemStats.disk?.used_percent || 0, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Process Stats */}
              <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 rounded-lg p-4 border border-orange-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-orange-400 text-sm font-medium">Process</div>
                  <Server className="w-5 h-5 text-orange-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.process?.memory_mb?.toFixed(0) || '0'}MB
                </div>
                <div className="text-white/60 text-xs">
                  PID: {systemStats.process?.pid || 'N/A'} • Threads: {systemStats.process?.threads || 0}
                </div>
                <div className="text-white/50 text-xs mt-1">
                  CPU: {systemStats.process?.cpu_percent?.toFixed(1) || '0.0'}% • Files: {systemStats.process?.open_files || 0}
                </div>
              </div>
            </div>
          )}

          {/* Network Stats */}
          {systemStats?.network && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white/80 text-sm font-medium">Network Traffic</div>
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/60 mb-1">Received</div>
                    <div className="text-lg font-bold text-cyan-400">
                      {((systemStats.network.bytes_received || 0) / (1024 ** 3)).toFixed(2)}GB
                    </div>
                    <div className="text-xs text-white/50">
                      {((systemStats.network.packets_received || 0) / 1000).toFixed(0)}K packets
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60 mb-1">Sent</div>
                    <div className="text-lg font-bold text-green-400">
                      {((systemStats.network.bytes_sent || 0) / (1024 ** 3)).toFixed(2)}GB
                    </div>
                    <div className="text-xs text-white/50">
                      {((systemStats.network.packets_sent || 0) / 1000).toFixed(0)}K packets
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white/80 text-sm font-medium">System Uptime</div>
                  <Timer className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-lg font-bold text-white">
                  {systemStats.timestamp ? new Date(systemStats.timestamp).toLocaleString() : 'N/A'}
                </div>
                <div className="text-xs text-white/60 mt-1">
                  Last updated: {systemStats.timestamp ? new Date(systemStats.timestamp).toLocaleTimeString() : 'Never'}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </ScrollReveal>

      {/* Real-time Server Logs */}
      <ScrollReveal delay={0.1}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <FileSearch className="w-6 h-6 mr-3 text-[#E50914]" />
              Real-time Server Logs
            </h3>
            <div className="flex items-center space-x-2">
              <MagneticButton
                onClick={() => setServerLogs([])}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </MagneticButton>
              <MagneticButton
                onClick={fetchInitialLogs}
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </MagneticButton>
            </div>
          </div>

          {/* Search/Filter Input */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Filter logs by message, level, or source..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-lg pl-10 pr-10 py-2 text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors text-sm"
              />
              {filterText && (
                <button
                  onClick={() => setFilterText('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {filterText && (
              <p className="text-white/60 text-xs mt-2">
                Showing {filteredLogs.length} of {serverLogs.length} log entries
              </p>
            )}
          </div>

          <div className="bg-black/70 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm border border-white/10">
            {filteredLogs.length === 0 ? (
              <div className="text-white/50 italic text-center py-8">
                {filterText ? `No logs matching "${filterText}"` : (isLogsConnected ? 'Waiting for log entries...' : 'Connecting to log stream...')}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`flex items-start space-x-3 py-1 px-2 rounded hover:bg-white/5 transition-colors ${
                      log.level === 'ERROR' || log.level === 'FATAL' ? 'bg-red-500/10' :
                      log.level === 'WARN' ? 'bg-yellow-500/10' :
                      log.level === 'DEBUG' ? 'bg-blue-500/10' :
                      ''
                    }`}
                  >
                    <span className="text-white/40 text-xs whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--'}
                    </span>
                    <span className={`text-xs font-bold whitespace-nowrap ${
                      log.level === 'ERROR' || log.level === 'FATAL' ? 'text-red-400' :
                      log.level === 'WARN' ? 'text-yellow-400' :
                      log.level === 'DEBUG' ? 'text-blue-400' :
                      'text-green-400'
                    }`}>
                      {log.level || 'INFO'}
                    </span>
                    <span className="text-cyan-400 text-xs whitespace-nowrap">
                      [{log.source || 'server'}]
                    </span>
                    <span className="text-white/90 text-xs flex-1 break-all">
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-white/60">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span>INFO</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <span>WARN</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span>ERROR</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span>DEBUG</span>
              </div>
            </div>
            <div>
              {filterText ? (
                <>Filtered: {filteredLogs.length} / {serverLogs.length} entries</>
              ) : (
                <>Showing {serverLogs.length} log entries • Auto-updating via WebSocket</>
              )}
            </div>
          </div>
        </GlassCard>
      </ScrollReveal>
    </div>
  );
}
