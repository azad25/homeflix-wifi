"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Activity, HardDrive, Server, TrendingUp, Timer, FileSearch, Trash2, RefreshCw, Search, X, Cpu, Monitor, MemoryStick, Database, Wifi, Info, Zap, Terminal, Play, Square, RotateCcw, Code, Hammer, Database as DatabaseIcon } from 'lucide-react';
import { MagneticButton, GlassCard, ScrollReveal } from '@/components/scrollx';
import { getApiUrl } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

interface TerminalLine {
  timestamp: string;
  type: 'stdout' | 'stderr' | 'info' | 'progress' | 'success' | 'warning';
  message: string;
  progress?: number;
}

interface SystemInfo {
  cpu: {
    model: string;
    cores: number;
    threads: number;
    max_freq: string;
    cache: string;
    arch: string;
  };
  gpu: {
    model: string;
    vendor: string;
    driver: string;
    memory: string;
  };
  memory: {
    total: string;
    type: string;
    speed: string;
    slots: number;
  };
  disk: {
    model: string;
    type: string;
    total: string;
    partitions: string[];
  };
  network: {
    hostname: string;
    interfaces: string[];
    ip_address: string;
    mac_address: string;
  };
  os: {
    name: string;
    version: string;
    kernel: string;
    platform: string;
    uptime: string;
  };
}

interface SystemLogsProps {
  onTerminalOutput?: (message: string) => void;
}

interface ServerStatus {
  production: {
    frontend: boolean;
    backend: boolean;
    urls: {
      frontend: string;
      backend: string;
    };
  };
  development: {
    frontend: boolean;
    backend: boolean;
    urls: {
      frontend: string;
      backend: string;
    };
  };
}

export default function SystemLogs({ onTerminalOutput }: SystemLogsProps) {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [statsHistory, setStatsHistory] = useState<any[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [serverLogs, setServerLogs] = useState<LogEntry[]>([]);
  const [isLogsConnected, setIsLogsConnected] = useState(false);
  const [isStatsConnected, setIsStatsConnected] = useState(false);
  const [logsWebSocket, setLogsWebSocket] = useState<WebSocket | null>(null);
  const [statsWebSocket, setStatsWebSocket] = useState<WebSocket | null>(null);
  const [filterText, setFilterText] = useState('');
  const [lastLogUpdate, setLastLogUpdate] = useState<Date | null>(null);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [isTerminalConnected, setIsTerminalConnected] = useState(false);
  const [terminalWebSocket, setTerminalWebSocket] = useState<WebSocket | null>(null);
  const [scanProgress, setScanProgress] = useState<number>(-1);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Server control state
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [isServerActionLoading, setIsServerActionLoading] = useState(false);

  // Build state
  const [isBuildingBackend, setIsBuildingBackend] = useState(false);
  const [isBuildingFrontend, setIsBuildingFrontend] = useState(false);
  const [buildWebSocket, setBuildWebSocket] = useState<WebSocket | null>(null);

  // Terminal command execution state
  const [commandInput, setCommandInput] = useState('');
  const [isCommandExecuting, setIsCommandExecuting] = useState(false);
  const [commandWebSocket, setCommandWebSocket] = useState<WebSocket | null>(null);
  const [isTerminalAuthenticated, setIsTerminalAuthenticated] = useState(false);
  const [terminalPassword, setTerminalPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const commandRef = useRef<HTMLDivElement>(null);

  // Clear cache function
  const clearAllCache = async () => {
    try {
      addTerminalOutput('🧹 Clearing all cache data...');
      
      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        addTerminalOutput('✅ Browser cache cleared');
      }

      // Clear localStorage
      localStorage.clear();
      addTerminalOutput('✅ Local storage cleared');

      // Clear sessionStorage
      sessionStorage.clear();
      addTerminalOutput('✅ Session storage cleared');

      // Clear IndexedDB (if any)
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          await Promise.all(
            databases.map(db => {
              if (db.name) {
                return new Promise((resolve, reject) => {
                  const deleteReq = indexedDB.deleteDatabase(db.name!);
                  deleteReq.onsuccess = () => resolve(undefined);
                  deleteReq.onerror = () => reject(deleteReq.error);
                });
              }
            })
          );
          addTerminalOutput('✅ IndexedDB cleared');
        } catch (error) {
          addTerminalOutput('⚠️ IndexedDB clear failed (may not exist)');
        }
      }

      // Call backend cache clear endpoint if it exists
      try {
        const response = await fetch(`${getApiUrl()}/api/admin/cache/clear`, {
          method: 'POST',
        });
        if (response.ok) {
          addTerminalOutput('✅ Backend cache cleared');
        } else {
          addTerminalOutput('⚠️ Backend cache clear failed');
        }
      } catch (error) {
        addTerminalOutput('⚠️ Backend cache clear endpoint not available');
      }

      addTerminalOutput('🎉 All cache data cleared successfully!');
      addTerminalOutput('💡 Refresh the page to see changes');
      
    } catch (error) {
      addTerminalOutput(`❌ Cache clear failed: ${error}`);
    }
  };

  const addTerminalOutput = (message: string) => {
    if (onTerminalOutput) {
      onTerminalOutput(message);
    }
    // Also add to terminal lines
    setTerminalLines(prev => [...prev.slice(-199), {
      timestamp: new Date().toISOString(),
      type: 'info',
      message
    }]);
  };

  useEffect(() => {
    // Clear any existing logs first
    setServerLogs([]);

    // Load initial data first
    fetchInitialLogs();
    fetchSystemInfo();
    fetchInitialTerminalOutput();

    // Try WebSocket connections
    connectToSystemLogs();
    connectToSystemStats();
    connectToTerminal();

    // Set up polling as fallback - force refresh every time
    const logsInterval = setInterval(() => {
      fetchInitialLogs(); // Always fetch, regardless of WebSocket status
    }, 3000); // Poll every 3 seconds

    const statsInterval = setInterval(() => {
      if (!isStatsConnected) {
        fetchSystemStats();
      }
    }, 2000); // Poll every 2 seconds for system stats

    return () => {
      disconnectWebSockets();
      clearInterval(logsInterval);
      clearInterval(statsInterval);
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
        addTerminalOutput('⚠️ WebSocket disconnected, falling back to polling');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (!isLogsConnected) {
            connectToSystemLogs();
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        setIsLogsConnected(false);
        addTerminalOutput('⚠️ WebSocket unavailable, using polling mode');
        console.warn('WebSocket connection failed, falling back to polling:', error);
      };

      setLogsWebSocket(ws);
    } catch (error) {
      setIsLogsConnected(false);
      addTerminalOutput('⚠️ WebSocket not supported, using polling mode');
      console.warn('WebSocket connection failed:', error);
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

          setStatsHistory(prev => {
            const newHistory = [...prev, {
              timestamp: new Date().toLocaleTimeString(),
              cpu: stats.cpu?.usage || 0,
              memory: stats.memory?.used_percent || 0,
              disk: stats.disk?.used_percent || 0,
              process: stats.process?.cpu_percent || 0,
            }];
            // Keep last 60 data points (approx 2 minutes of history with 2s interval)
            return newHistory.slice(-60);
          });
        } catch (error) {
          console.error('Error parsing system stats:', error);
        }
      };

      ws.onclose = () => {
        setIsStatsConnected(false);
        addTerminalOutput('⚠️ Stats WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (!isStatsConnected) {
            connectToSystemStats();
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        setIsStatsConnected(false);
        addTerminalOutput('⚠️ Stats WebSocket unavailable');
        console.warn('Stats WebSocket connection failed:', error);
      };

      setStatsWebSocket(ws);
    } catch (error) {
      setIsStatsConnected(false);
      addTerminalOutput('⚠️ Stats WebSocket not supported');
      console.warn('Stats WebSocket connection failed:', error);
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
    if (terminalWebSocket) {
      terminalWebSocket.close();
      setTerminalWebSocket(null);
    }
    if (commandWebSocket) {
      commandWebSocket.close();
      setCommandWebSocket(null);
    }
    setIsLogsConnected(false);
    setIsStatsConnected(false);
    setIsTerminalConnected(false);
    setIsTerminalAuthenticated(false);
  };

  // Terminal WebSocket connection
  const connectToTerminal = () => {
    try {
      const apiUrl = getApiUrl().replace('http', 'ws');
      const ws = new WebSocket(`${apiUrl}/api/admin/system/terminal/stream`);

      ws.onopen = () => {
        setIsTerminalConnected(true);
        addTerminalOutput('🖥️ Terminal stream connected');
      };

      ws.onmessage = (event) => {
        try {
          const line: TerminalLine = JSON.parse(event.data);
          setTerminalLines(prev => [...prev.slice(-199), line]);

          // Update scan progress if present
          if (line.progress !== undefined && line.progress >= 0) {
            setScanProgress(line.progress);
          }

          // Auto-scroll terminal
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        } catch (error) {
          console.error('Error parsing terminal line:', error);
        }
      };

      ws.onclose = () => {
        setIsTerminalConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!isTerminalConnected) {
            connectToTerminal();
          }
        }, 3000);
      };

      ws.onerror = () => {
        setIsTerminalConnected(false);
      };

      setTerminalWebSocket(ws);
    } catch (error) {
      setIsTerminalConnected(false);
      console.warn('Terminal WebSocket connection failed:', error);
    }
  };

  // Terminal Command Authentication
  const authenticateTerminal = () => {
    setPasswordError('');

    if (!terminalPassword) {
      setPasswordError('Password is required');
      return;
    }

    // Connect directly to command terminal
    connectToCommandTerminal(terminalPassword);
    setTerminalPassword('');
  };

  // Validate password by making a test request
  const validateAndConnect = async (password: string) => {
    // Direct connection - no pre-validation needed
    connectToCommandTerminal(password);
  };

  // Command WebSocket connection
  const connectToCommandTerminal = (password: string) => {
    try {
      const apiUrl = getApiUrl().replace('http', 'ws');
      const wsUrl = `${apiUrl}/api/admin/system/command/stream?password=${encodeURIComponent(password)}`;
      console.log('Connecting to command terminal:', wsUrl);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Command WebSocket connected successfully');
      };

      ws.onmessage = (event) => {
        try {
          const line: TerminalLine = JSON.parse(event.data);
          console.log('Received terminal message:', line);
          
          // Check if this is an authentication error
          if (line.type === 'stderr' && line.message.includes('Authentication failed')) {
            setIsTerminalAuthenticated(false);
            setPasswordError(line.message);
            ws.close();
            return;
          }

          // Mark as authenticated on first successful message
          if (!isTerminalAuthenticated && line.type === 'success' && line.message.includes('authenticated')) {
            setIsTerminalAuthenticated(true);
            setPasswordError('');
            addTerminalOutput('🔐 Terminal authenticated and ready for commands');
            console.log('Terminal authenticated successfully');
          }

          // Add line to terminal output
          setTerminalLines(prev => [...prev.slice(-199), line]);

          if (commandRef.current) {
            commandRef.current.scrollTop = commandRef.current.scrollHeight;
          }
        } catch (error) {
          console.error('Error parsing command output:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('Command WebSocket closed:', event.code, event.reason);
        setIsTerminalAuthenticated(false);
        if (!isTerminalAuthenticated) {
          setPasswordError('Failed to authenticate - connection closed');
        } else {
          addTerminalOutput('🔓 Terminal session closed');
        }
      };

      ws.onerror = (event) => {
        console.error('Command WebSocket error:', event);
        setIsTerminalAuthenticated(false);
        setPasswordError('Failed to connect to terminal - check your password');
      };

      setCommandWebSocket(ws);
    } catch (error) {
      setPasswordError('WebSocket connection failed');
      console.warn('Command terminal WebSocket connection failed:', error);
    }
  };

  const executeCommand = () => {
    if (!commandInput.trim()) return;

    if (!isTerminalAuthenticated || !commandWebSocket) {
      setPasswordError('Terminal not authenticated');
      return;
    }

    setIsCommandExecuting(true);

    try {
      commandWebSocket.send(JSON.stringify({
        command: commandInput,
      }));

      setCommandInput('');
    } catch (error) {
      addTerminalOutput(`❌ Failed to send command: ${error}`);
    } finally {
      setIsCommandExecuting(false);
    }
  };

  // Fetch initial terminal output
  const fetchInitialTerminalOutput = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/system/terminal?lines=100`);
      if (response.ok) {
        const data = await response.json();
        if (data.output && Array.isArray(data.output)) {
          setTerminalLines(data.output);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch initial terminal output:', error);
    }
  };

  const fetchInitialLogs = async () => {
    setIsFetchingLogs(true);
    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const randomParam = Math.random();

      // Try multiple URLs in case of hostname issues
      const apiUrl = getApiUrl();
      const urls = [
        `${apiUrl}/api/admin/system/logs?lines=100&t=${timestamp}&r=${randomParam}`,
        `http://localhost:8252/api/admin/system/logs?lines=100&t=${timestamp}&r=${randomParam}`,
        `http://127.0.0.1:8252/api/admin/system/logs?lines=100&t=${timestamp}&r=${randomParam}`
      ];


      let response;
      let lastError;

      for (const url of urls) {
        try {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });

          if (response.ok) {
            break; // Success, exit the loop
          } else {
            lastError = `${response.status} ${response.statusText}`;
          }
        } catch (error) {
          lastError = error;
          continue; // Try next URL
        }
      }

      if (response && response.ok) {
        const data = await response.json();
        const newLogs = data.logs || [];

        // Always update logs and timestamp
        setServerLogs(newLogs);
        setLastLogUpdate(new Date());
      } else {
        addTerminalOutput(`❌ Failed to fetch logs from all endpoints: ${lastError}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Failed to fetch logs: ${error}`);
    } finally {
      setIsFetchingLogs(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/system/stats`);
      if (response.ok) {
        const data = await response.json();
        setSystemStats(data);

        setStatsHistory(prev => {
          const newHistory = [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            cpu: data.cpu?.usage || 0,
            memory: data.memory?.used_percent || 0,
            disk: data.disk?.used_percent || 0,
            process: data.process?.cpu_percent || 0,
          }];
          return newHistory.slice(-60);
        });
      }
    } catch (error) {
      console.warn('Failed to fetch system stats:', error);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/system/info`);
      if (response.ok) {
        const data = await response.json();
        setSystemInfo(data);
        addTerminalOutput('💻 System information loaded');
      }
    } catch (error) {
      addTerminalOutput('❌ Failed to fetch system information');
    }
  };

  // Server control functions
  const fetchServerStatus = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/server/status`);
      if (response.ok) {
        const data = await response.json();
        setServerStatus(data);
      }
    } catch (error) {
      console.warn('Failed to fetch server status:', error);
    }
  };

  const serverAction = async (action: string, type: 'production' | 'dev') => {
    setIsServerActionLoading(true);
    addTerminalOutput(`🔄 ${action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting'} ${type} server...`);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/server/${type}/${action}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        addTerminalOutput(`✅ ${data.message}`);
        if (data.output) {
          data.output.split('\n').forEach((line: string) => {
            if (line.trim()) addTerminalOutput(line);
          });
        }
      } else {
        addTerminalOutput(`❌ ${data.message}`);
        if (data.output) {
          addTerminalOutput(data.output);
        }
      }

      // Refresh server status
      setTimeout(fetchServerStatus, 2000);
    } catch (error) {
      addTerminalOutput(`❌ Failed to ${action} ${type} server: ${error}`);
    } finally {
      setIsServerActionLoading(false);
    }
  };

  // Fetch server status periodically
  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Build functions
  const buildProject = async (type: 'backend' | 'frontend') => {
    if (type === 'backend') {
      setIsBuildingBackend(true);
    } else {
      setIsBuildingFrontend(true);
    }

    addTerminalOutput(`🔨 Starting ${type} build...`);

    try {
      // Start WebSocket for real-time build output
      const apiUrl = getApiUrl().replace('http', 'ws');
      const ws = new WebSocket(`${apiUrl}/api/admin/build/${type}/stream`);

      ws.onopen = () => {
        addTerminalOutput(`🔗 Connected to ${type} build stream`);
      };

      ws.onmessage = (event) => {
        try {
          const line: TerminalLine = JSON.parse(event.data);
          setTerminalLines(prev => [...prev.slice(-199), line]);

          // Auto-scroll terminal
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        } catch (error) {
          console.error('Error parsing build output:', error);
        }
      };

      ws.onclose = () => {
        if (type === 'backend') {
          setIsBuildingBackend(false);
        } else {
          setIsBuildingFrontend(false);
        }
        setBuildWebSocket(null);
      };

      ws.onerror = () => {
        addTerminalOutput(`❌ Build stream connection failed for ${type}`);
        if (type === 'backend') {
          setIsBuildingBackend(false);
        } else {
          setIsBuildingFrontend(false);
        }
        setBuildWebSocket(null);
      };

      setBuildWebSocket(ws);

    } catch (error) {
      addTerminalOutput(`❌ Failed to start ${type} build: ${error}`);
      if (type === 'backend') {
        setIsBuildingBackend(false);
      } else {
        setIsBuildingFrontend(false);
      }
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
              HomeFlix
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isLogsConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className="text-white/70 text-sm">
                  Logs {isLogsConnected ? 'WebSocket' : 'Polling'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isStatsConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className="text-white/70 text-sm">
                  Stats {isStatsConnected ? 'WebSocket' : 'Polling'}
                </span>
              </div>
              <button
                onClick={clearAllCache}
                title="Clear all cache data (pages, widgets, notifications)"
                className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm transition-colors"
              >
                <DatabaseIcon className="w-4 h-4" />
                <span>Clear Cache</span>
              </button>
              <div className="text-white/50 text-xs">
                {serverLogs.length} entries
                {isFetchingLogs && (
                  <div className="text-blue-400 text-xs animate-pulse">
                    Fetching...
                  </div>
                )}
                {lastLogUpdate && !isFetchingLogs && (
                  <div className="text-white/40 text-xs">
                    Updated: {lastLogUpdate.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System Resource Monitor */}
          {systemStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* CPU Stats */}
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-lg p-4 border border-blue-500/20 h-64 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-blue-400 text-sm font-medium">CPU Usage</div>
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.cpu?.usage?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-white/60 text-xs mb-4">
                  {systemStats.cpu?.cores || 0} cores • Load: {systemStats.cpu?.load_avg_1?.toFixed(2) || '0.00'}
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <defs>
                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff' }}
                        itemStyle={{ color: '#60a5fa' }}
                        labelStyle={{ display: 'none' }}
                      />
                      <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Memory Stats */}
              <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-lg p-4 border border-green-500/20 h-64 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-green-400 text-sm font-medium">Memory</div>
                  <HardDrive className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.memory?.used_percent?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-white/60 text-xs mb-4">
                  {((systemStats.memory?.used || 0) / (1024 ** 3)).toFixed(1)}GB / {((systemStats.memory?.total || 0) / (1024 ** 3)).toFixed(1)}GB
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <defs>
                        <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff' }}
                        itemStyle={{ color: '#4ade80' }}
                        labelStyle={{ display: 'none' }}
                      />
                      <Area type="monotone" dataKey="memory" stroke="#22c55e" fillOpacity={1} fill="url(#colorMemory)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Disk Stats */}
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-lg p-4 border border-purple-500/20 h-64 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-purple-400 text-sm font-medium">Disk Usage</div>
                  <HardDrive className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.disk?.used_percent?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-white/60 text-xs mb-4">
                  {((systemStats.disk?.used || 0) / (1024 ** 3)).toFixed(1)}GB / {((systemStats.disk?.total || 0) / (1024 ** 3)).toFixed(1)}GB
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <defs>
                        <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff' }}
                        itemStyle={{ color: '#c084fc' }}
                        labelStyle={{ display: 'none' }}
                      />
                      <Area type="monotone" dataKey="disk" stroke="#a855f7" fillOpacity={1} fill="url(#colorDisk)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Process Stats */}
              <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 rounded-lg p-4 border border-orange-500/20 h-64 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-orange-400 text-sm font-medium">Process CPU</div>
                  <Server className="w-5 h-5 text-orange-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {systemStats.process?.cpu_percent?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-white/60 text-xs mb-4">
                  PID: {systemStats.process?.pid || 'N/A'} • Threads: {systemStats.process?.threads || 0}
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <defs>
                        <linearGradient id="colorProcess" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 20]} hide /> {/* Process CPU often low, so set lower max for clearer graph */}
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff' }}
                        itemStyle={{ color: '#fb923c' }}
                        labelStyle={{ display: 'none' }}
                      />
                      <Area type="monotone" dataKey="process" stroke="#f97316" fillOpacity={1} fill="url(#colorProcess)" />
                    </AreaChart>
                  </ResponsiveContainer>
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

      {/* Server Control Panel */}
      <ScrollReveal delay={0.03}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Server className="w-6 h-6 mr-3 text-[#E50914]" />
              Server Control
            </h2>
            <button
              onClick={fetchServerStatus}
              title="Refresh server status"
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Status</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Production Server */}
            <div className="bg-gradient-to-br from-green-600/10 to-green-800/10 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Server className="w-5 h-5 text-green-400 mr-2" />
                  Production Server
                </h3>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${serverStatus?.production?.backend ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-white/70 text-xs">
                    {serverStatus?.production?.backend ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Frontend (3008):</span>
                  <span className={serverStatus?.production?.frontend ? 'text-green-400' : 'text-red-400'}>
                    {serverStatus?.production?.frontend ? '● Running' : '○ Stopped'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Backend (8252):</span>
                  <span className={serverStatus?.production?.backend ? 'text-green-400' : 'text-red-400'}>
                    {serverStatus?.production?.backend ? '● Running' : '○ Stopped'}
                  </span>
                </div>
              </div>

              {/* Server URLs */}
              {serverStatus?.production && (serverStatus.production.frontend || serverStatus.production.backend) && (
                <div className="mb-4 p-3 bg-black/30 rounded-lg border border-green-500/20">
                  <div className="text-green-400 text-xs font-medium mb-2">🌐 Server URLs:</div>
                  {serverStatus.production.frontend && (
                    <div className="mb-1">
                      <a 
                        href={serverStatus.production.urls.frontend} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-300 hover:text-green-200 text-xs underline"
                      >
                        📱 Frontend: {serverStatus.production.urls.frontend}
                      </a>
                    </div>
                  )}
                  {serverStatus.production.backend && (
                    <div>
                      <a 
                        href={serverStatus.production.urls.backend} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-300 hover:text-green-200 text-xs underline"
                      >
                        🔧 Backend: {serverStatus.production.urls.backend}
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => serverAction('start', 'production')}
                  disabled={isServerActionLoading}
                  title="Start production server"
                  className="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Start</span>
                </button>
                <button
                  onClick={() => serverAction('stop', 'production')}
                  disabled={isServerActionLoading}
                  title="Stop production server"
                  className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop</span>
                </button>
                <button
                  onClick={() => serverAction('restart', 'production')}
                  disabled={isServerActionLoading}
                  title="Restart production server"
                  className="flex-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart</span>
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center space-x-2">
                  <MagneticButton
                    onClick={() => buildProject('backend')}
                    disabled={isBuildingBackend || isBuildingFrontend}
                    className="flex-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                  >
                    {isBuildingBackend ? (
                      <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                    ) : (
                      <Hammer className="w-4 h-4" />
                    )}
                    <span>{isBuildingBackend ? 'Building...' : 'Build Backend'}</span>
                  </MagneticButton>
                  <MagneticButton
                    onClick={() => buildProject('frontend')}
                    disabled={isBuildingBackend || isBuildingFrontend}
                    className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                  >
                    {isBuildingFrontend ? (
                      <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
                    ) : (
                      <Hammer className="w-4 h-4" />
                    )}
                    <span>{isBuildingFrontend ? 'Building...' : 'Build Frontend'}</span>
                  </MagneticButton>
                </div>
              </div>
            </div>

            {/* Development Server */}
            <div className="bg-gradient-to-br from-purple-600/10 to-purple-800/10 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Code className="w-5 h-5 text-purple-400 mr-2" />
                  Development Server
                </h3>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${serverStatus?.development?.backend ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-white/70 text-xs">
                    {serverStatus?.development?.backend ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Frontend (3009):</span>
                  <span className={serverStatus?.development?.frontend ? 'text-green-400' : 'text-red-400'}>
                    {serverStatus?.development?.frontend ? '● Running' : '○ Stopped'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Backend (8253):</span>
                  <span className={serverStatus?.development?.backend ? 'text-green-400' : 'text-red-400'}>
                    {serverStatus?.development?.backend ? '● Running' : '○ Stopped'}
                  </span>
                </div>
              </div>

              {/* Development Server URLs */}
              {serverStatus?.development && (serverStatus.development.frontend || serverStatus.development.backend) && (
                <div className="mb-4 p-3 bg-black/30 rounded-lg border border-purple-500/20">
                  <div className="text-purple-400 text-xs font-medium mb-2">🔧 Dev Server URLs:</div>
                  {serverStatus.development.frontend && (
                    <div className="mb-1">
                      <a 
                        href={serverStatus.development.urls.frontend} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-300 hover:text-purple-200 text-xs underline"
                      >
                        📱 Dev Frontend: {serverStatus.development.urls.frontend}
                      </a>
                    </div>
                  )}
                  {serverStatus.development.backend && (
                    <div>
                      <a 
                        href={serverStatus.development.urls.backend} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-300 hover:text-purple-200 text-xs underline"
                      >
                        🔧 Dev Backend: {serverStatus.development.urls.backend}
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => serverAction('start', 'dev')}
                  disabled={isServerActionLoading}
                  title="Start development server"
                  className="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Start</span>
                </button>
                <button
                  onClick={() => serverAction('stop', 'dev')}
                  disabled={isServerActionLoading}
                  title="Stop development server"
                  className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop</span>
                </button>
                <button
                  onClick={() => serverAction('restart', 'dev')}
                  disabled={isServerActionLoading}
                  title="Restart development server"
                  className="flex-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart</span>
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center space-x-2">
                  <MagneticButton
                    onClick={() => buildProject('backend')}
                    disabled={isBuildingBackend || isBuildingFrontend}
                    className="flex-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                  >
                    {isBuildingBackend ? (
                      <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                    ) : (
                      <Hammer className="w-4 h-4" />
                    )}
                    <span>{isBuildingBackend ? 'Building...' : 'Build Backend'}</span>
                  </MagneticButton>
                  <MagneticButton
                    onClick={() => buildProject('frontend')}
                    disabled={isBuildingBackend || isBuildingFrontend}
                    className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                  >
                    {isBuildingFrontend ? (
                      <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
                    ) : (
                      <Hammer className="w-4 h-4" />
                    )}
                    <span>{isBuildingFrontend ? 'Building...' : 'Build Frontend'}</span>
                  </MagneticButton>
                </div>
              </div>
            </div>
          </div>

          {isServerActionLoading && (
            <div className="mt-4 flex items-center justify-center text-white/60">
              <div className="animate-spin w-5 h-5 border-2 border-[#E50914] border-t-transparent rounded-full mr-2"></div>
              <span>Processing server action...</span>
            </div>
          )}
        </GlassCard>
      </ScrollReveal>

      {/* Real-time Terminal Output */}
      <ScrollReveal delay={0.05}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Terminal className="w-6 h-6 mr-3 text-[#E50914]" />
              Live Terminal Output
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isTerminalConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className="text-white/70 text-sm">
                  {isTerminalConnected ? 'Connected' : 'Polling'}
                </span>
              </div>
              {scanProgress >= 0 && (
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#E50914] to-red-400 transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <span className="text-white/70 text-sm">{scanProgress.toFixed(1)}%</span>
                </div>
              )}
              <MagneticButton
                onClick={() => setTerminalLines([])}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </MagneticButton>
              <MagneticButton
                onClick={() => {
                  if (terminalWebSocket) {
                    terminalWebSocket.close();
                  }
                  setTimeout(connectToTerminal, 500);
                }}
                className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reconnect</span>
              </MagneticButton>
            </div>
          </div>

          {/* Terminal Display - Increased height */}
          <div
            ref={terminalRef}
            className="bg-black rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm border border-white/10 scroll-smooth"
          >
            {terminalLines.length === 0 ? (
              <div className="text-white/50 italic text-center py-8">
                {isTerminalConnected ? 'Waiting for output...' : 'Connecting to terminal stream...'}
              </div>
            ) : (
              <div className="space-y-1">
                {terminalLines.map((line, index) => (
                  <div
                    key={index}
                    className={`flex items-start space-x-2 py-0.5 ${line.type === 'stderr' ? 'text-red-400' :
                        line.type === 'warning' ? 'text-yellow-400' :
                          line.type === 'success' ? 'text-green-400' :
                            line.type === 'progress' ? 'text-blue-400' :
                              line.type === 'info' ? 'text-cyan-400' :
                                'text-white/90'
                      }`}
                  >
                    <span className="text-white/30 text-xs whitespace-nowrap">
                      {line.timestamp ? new Date(line.timestamp).toLocaleTimeString() : '--:--:--'}
                    </span>
                    <span className="flex-1 break-all">{line.message}</span>
                    {line.progress !== undefined && line.progress >= 0 && (
                      <span className="text-blue-400 text-xs whitespace-nowrap">
                        [{line.progress.toFixed(1)}%]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-white/60">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-white/90"></div>
                <span>stdout</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span>stderr</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                <span>info</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span>progress</span>
              </div>
            </div>
            <div>
              {terminalLines.length} lines • {isTerminalConnected ? 'Real-time via WebSocket' : 'Polling mode'}
            </div>
          </div>
        </GlassCard>
      </ScrollReveal>

      {/* Terminal Command Executor */}
      <ScrollReveal delay={0.07}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Terminal className="w-6 h-6 mr-3 text-[#E50914]" />
              Command Executor
            </h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isTerminalAuthenticated ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              <span className="text-white/70 text-sm">
                {isTerminalAuthenticated ? '🔓 Authenticated' : '🔒 Not Authenticated'}
              </span>
            </div>
          </div>

          {!isTerminalAuthenticated ? (
            <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 rounded-lg p-6 border border-yellow-500/20 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="text-yellow-400 text-2xl">🔐</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Terminal Access Required</h3>
                    <p className="text-white/60 text-sm mt-1">Enter password to enable terminal command execution</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <input
                    type="password"
                    value={terminalPassword}
                    onChange={(e) => {
                      setTerminalPassword(e.target.value);
                      setPasswordError('');
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && authenticateTerminal()}
                    placeholder="Enter password..."
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:border-yellow-400 focus:outline-none transition-colors"
                  />
                  {passwordError && (
                    <p className="text-red-400 text-xs mt-2">⚠️ {passwordError}</p>
                  )}
                </div>
                <MagneticButton
                  onClick={authenticateTerminal}
                  className="w-full bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Unlock Terminal
                </MagneticButton>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 text-white/50 text-xs">
                ⚠️ Advanced feature - be careful with commands executed here
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Command Input */}
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
                    placeholder="Enter terminal command (e.g., ls -la, ps aux, docker ps)..."
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors font-mono text-sm"
                    disabled={!isTerminalAuthenticated}
                  />
                </div>
                <MagneticButton
                  onClick={executeCommand}
                  disabled={isCommandExecuting || !commandInput.trim()}
                  className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>{isCommandExecuting ? 'Running...' : 'Execute'}</span>
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    if (commandWebSocket) {
                      commandWebSocket.close();
                    }
                    setIsTerminalAuthenticated(false);
                    addTerminalOutput('🔓 Terminal session closed');
                  }}
                  className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-4 py-2 rounded-lg"
                >
                  Lock
                </MagneticButton>
              </div>

              {/* Command History / Output display in terminal lines above */}
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3 text-blue-400 text-xs flex items-start space-x-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p>Command output appears in the Terminal Output section above</p>
                  <p className="text-white/60 mt-1">Safe commands: ls, pwd, ps, top, docker, systemctl, systemd-analyze, journalctl, etc.</p>
                </div>
              </div>

              {/* Quick command buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MagneticButton
                  onClick={() => {
                    setCommandInput('ls -lah');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  📁 List Files
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    setCommandInput('pwd');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  📍 Current Dir
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    setCommandInput('df -h');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  💾 Disk Usage
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    setCommandInput('top -n1 -b | head -20');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  📊 Top Processes
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    setCommandInput('docker ps');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  🐳 Docker Containers
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    setCommandInput('systemctl status');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  ⚙️ Systemctl
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    setCommandInput('ps aux');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  🔍 All Processes
                </MagneticButton>
                <MagneticButton
                  onClick={() => {
                    setCommandInput('uptime');
                    setTimeout(() => executeCommand(), 100);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-2 rounded text-xs"
                >
                  ⏱️ Uptime
                </MagneticButton>
              </div>
            </div>
          )}
        </GlassCard>
      </ScrollReveal>

      {/* System Hardware Information */}
      {systemInfo && (
        <ScrollReveal delay={0.1}>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center">
                <Info className="w-6 h-6 mr-3 text-[#E50914]" />
                System Hardware Information
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* CPU Information */}
              <div className="bg-gradient-to-br from-blue-600/10 to-blue-800/10 rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center mb-3">
                  <Cpu className="w-5 h-5 text-blue-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">CPU</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Model:</span>
                    <span className="text-white font-medium text-right ml-2">{systemInfo.cpu.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Cores:</span>
                    <span className="text-white">{systemInfo.cpu.cores} ({systemInfo.cpu.threads} threads)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Max Frequency:</span>
                    <span className="text-white">{systemInfo.cpu.max_freq || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Cache:</span>
                    <span className="text-white">{systemInfo.cpu.cache || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Architecture:</span>
                    <span className="text-white">{systemInfo.cpu.arch}</span>
                  </div>
                </div>
              </div>

              {/* GPU Information */}
              <div className="bg-gradient-to-br from-green-600/10 to-green-800/10 rounded-lg p-4 border border-green-500/20">
                <div className="flex items-center mb-3">
                  <Monitor className="w-5 h-5 text-green-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">GPU</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Model:</span>
                    <span className="text-white font-medium text-right ml-2">{systemInfo.gpu.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Vendor:</span>
                    <span className="text-white">{systemInfo.gpu.vendor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Driver:</span>
                    <span className="text-white">{systemInfo.gpu.driver}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Memory:</span>
                    <span className="text-white">{systemInfo.gpu.memory}</span>
                  </div>
                </div>
              </div>

              {/* Memory Information */}
              <div className="bg-gradient-to-br from-purple-600/10 to-purple-800/10 rounded-lg p-4 border border-purple-500/20">
                <div className="flex items-center mb-3">
                  <MemoryStick className="w-5 h-5 text-purple-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">RAM</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Total:</span>
                    <span className="text-white font-medium">{systemInfo.memory.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Type:</span>
                    <span className="text-white">{systemInfo.memory.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Speed:</span>
                    <span className="text-white">{systemInfo.memory.speed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Slots:</span>
                    <span className="text-white">{systemInfo.memory.slots}</span>
                  </div>
                </div>
              </div>

              {/* Disk Information */}
              <div className="bg-gradient-to-br from-orange-600/10 to-orange-800/10 rounded-lg p-4 border border-orange-500/20">
                <div className="flex items-center mb-3">
                  <Database className="w-5 h-5 text-orange-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Storage</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Model:</span>
                    <span className="text-white font-medium text-right ml-2">{systemInfo.disk.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Type:</span>
                    <span className="text-white">{systemInfo.disk.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Total:</span>
                    <span className="text-white">{systemInfo.disk.total}</span>
                  </div>
                  {systemInfo.disk.partitions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <span className="text-white/60 text-xs">Partitions:</span>
                      <div className="mt-1 space-y-1">
                        {systemInfo.disk.partitions.slice(0, 3).map((partition, idx) => (
                          <div key={idx} className="text-white/80 text-xs truncate">{partition}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Network Information */}
              <div className="bg-gradient-to-br from-cyan-600/10 to-cyan-800/10 rounded-lg p-4 border border-cyan-500/20">
                <div className="flex items-center mb-3">
                  <Wifi className="w-5 h-5 text-cyan-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Network</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Hostname:</span>
                    <span className="text-white font-medium text-right ml-2">{systemInfo.network.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">IP Address:</span>
                    <span className="text-white">{systemInfo.network.ip_address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">MAC Address:</span>
                    <span className="text-white text-xs">{systemInfo.network.mac_address}</span>
                  </div>
                  {systemInfo.network.interfaces.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <span className="text-white/60 text-xs">Interfaces:</span>
                      <div className="mt-1 space-y-1">
                        {systemInfo.network.interfaces.map((iface, idx) => (
                          <div key={idx} className="text-white/80 text-xs">{iface}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* OS Information */}
              <div className="bg-gradient-to-br from-pink-600/10 to-pink-800/10 rounded-lg p-4 border border-pink-500/20">
                <div className="flex items-center mb-3">
                  <Server className="w-5 h-5 text-pink-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Operating System</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">OS:</span>
                    <span className="text-white font-medium text-right ml-2">{systemInfo.os.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Version:</span>
                    <span className="text-white">{systemInfo.os.version || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Kernel:</span>
                    <span className="text-white">{systemInfo.os.kernel || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Platform:</span>
                    <span className="text-white">{systemInfo.os.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Uptime:</span>
                    <span className="text-white">{systemInfo.os.uptime || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </ScrollReveal>
      )}

      {/* Real-time Server Logs */}
      <ScrollReveal delay={0.2}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <FileSearch className="w-6 h-6 mr-3 text-[#E50914]" />
              Real-time Server Logs
            </h3>
            <div className="flex items-center space-x-2">
              <MagneticButton
                onClick={() => {
                  setServerLogs([]);
                  addTerminalOutput('🧹 Log display cleared');
                }}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </MagneticButton>
              <MagneticButton
                onClick={async () => {
                  addTerminalOutput('🔄 Manually refreshing logs and stats');
                  fetchInitialLogs();
                  fetchSystemStats();
                }}
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </MagneticButton>
              <MagneticButton
                onClick={() => {
                  disconnectWebSockets();
                  setTimeout(() => {
                    connectToSystemLogs();
                    connectToSystemStats();
                    addTerminalOutput('🔄 Attempting to reconnect WebSockets');
                  }, 1000);
                }}
                className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reconnect</span>
              </MagneticButton>
              <MagneticButton
                onClick={async () => {
                  addTerminalOutput('🚀 Force refreshing logs...');
                  setServerLogs([]);
                  setLastLogUpdate(null);

                  // Force fetch with new timestamp
                  const timestamp = Date.now();
                  const randomParam = Math.random();
                  const apiUrl = getApiUrl();
                  const url = `${apiUrl}/api/admin/system/logs?lines=50&t=${timestamp}&r=${randomParam}&force=true`;

                  try {
                    const response = await fetch(url, {
                      method: 'GET',
                      headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                      }
                    });

                    if (response.ok) {
                      const data = await response.json();
                      setServerLogs(data.logs || []);
                      setLastLogUpdate(new Date());
                      addTerminalOutput(`🎯 Force refresh: Got ${data.logs?.length || 0} fresh logs`);
                    }
                  } catch (error) {
                    addTerminalOutput(`🚨 Force refresh failed: ${error}`);
                  }
                }}
                className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <Zap className="w-4 h-4" />
                <span>Force Refresh</span>
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
                    className={`flex items-start space-x-3 py-1 px-2 rounded hover:bg-white/5 transition-colors ${log.level === 'ERROR' || log.level === 'FATAL' ? 'bg-red-500/10' :
                      log.level === 'WARN' ? 'bg-yellow-500/10' :
                        log.level === 'DEBUG' ? 'bg-blue-500/10' :
                          ''
                      }`}
                  >
                    <span className="text-white/40 text-xs whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--'}
                    </span>
                    <span className={`text-xs font-bold whitespace-nowrap ${log.level === 'ERROR' || log.level === 'FATAL' ? 'text-red-400' :
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
                <>Showing {serverLogs.length} log entries • {isLogsConnected ? 'Real-time via WebSocket' : 'Auto-refreshing via polling'}</>
              )}
            </div>
          </div>
        </GlassCard>
      </ScrollReveal>
    </div>
  );
}
