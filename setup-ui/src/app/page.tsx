"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Settings, 
  Database, 
  Folder, 
  User, 
  Key, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Film,
  Server,
  HardDrive,
  Globe,
  Shield,
  Zap,
  Monitor,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Home,
  Eye,
  EyeOff
} from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface UserInfo {
  name: string;
  email: string;
  timezone: string;
  language: string;
}

interface MediaPaths {
  primary: string;
  downloads: string;
  additional: string[];
}

interface ApiKeys {
  tmdb: string;
  opensubtitles: string;
  opensubtitlesUsername: string;
  opensubtitlesPassword: string;
  youtube: string;
}

interface SystemConfig {
  enableRedis: boolean;
  enableTorrents: boolean;
  enableSubtitles: boolean;
  hardwareAcceleration: string;
  maxConcurrentScans: number;
  cacheSize: number;
}

interface ScanProgress {
  isScanning: boolean;
  currentStep: string;
  progress: number;
  totalFiles: number;
  processedFiles: number;
  errors: string[];
  warnings: string[];
  currentFile: string;
  eta: string;
}

export default function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: '',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: 'en'
  });
  const [mediaPaths, setMediaPaths] = useState<MediaPaths>({
    primary: '/media/movies',
    downloads: '/downloads/homeflix',
    additional: []
  });
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    tmdb: '',
    opensubtitles: '',
    opensubtitlesUsername: '',
    opensubtitlesPassword: '',
    youtube: ''
  });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    enableRedis: true,
    enableTorrents: true,
    enableSubtitles: true,
    hardwareAcceleration: 'none',
    maxConcurrentScans: 4,
    cacheSize: 1024
  });
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    isScanning: false,
    currentStep: '',
    progress: 0,
    totalFiles: 0,
    processedFiles: 0,
    errors: [],
    warnings: [],
    currentFile: '',
    eta: ''
  });
  const [setupComplete, setSetupComplete] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const steps: SetupStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to HomeFlix',
      description: 'Transform your media collection into a professional streaming platform',
      icon: <Play className="w-6 h-6" />,
      completed: currentStep > 0
    },
    {
      id: 'user',
      title: 'User Information',
      description: 'Tell us about yourself to personalize your experience',
      icon: <User className="w-6 h-6" />,
      completed: currentStep > 1
    },
    {
      id: 'paths',
      title: 'Media Storage',
      description: 'Configure where your movies and TV shows are stored',
      icon: <Folder className="w-6 h-6" />,
      completed: currentStep > 2
    },
    {
      id: 'apis',
      title: 'API Configuration',
      description: 'Set up integrations for enhanced features',
      icon: <Key className="w-6 h-6" />,
      completed: currentStep > 3
    },
    {
      id: 'system',
      title: 'System Settings',
      description: 'Configure performance and feature settings',
      icon: <Settings className="w-6 h-6" />,
      completed: currentStep > 4
    },
    {
      id: 'install',
      title: 'Installation',
      description: 'Install and configure HomeFlix components',
      icon: <Download className="w-6 h-6" />,
      completed: currentStep > 5
    },
    {
      id: 'scan',
      title: 'Media Scanning',
      description: 'Scan and organize your media library',
      icon: <Database className="w-6 h-6" />,
      completed: setupComplete
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const startInstallation = async () => {
    setIsInstalling(true);
    try {
      // Call installation API
      const response = await fetch('/api/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInfo,
          mediaPaths,
          apiKeys,
          systemConfig
        }),
      });

      if (response.ok) {
        nextStep();
      } else {
        throw new Error('Installation failed');
      }
    } catch (error) {
      console.error('Installation error:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const startMediaScan = async () => {
    setScanProgress(prev => ({ ...prev, isScanning: true }));
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths: mediaPaths }),
      });

      if (response.ok) {
        // Start polling for scan progress
        const pollProgress = setInterval(async () => {
          try {
            const progressResponse = await fetch('/api/scan/progress');
            const progress = await progressResponse.json();
            setScanProgress(progress);

            if (progress.progress >= 100) {
              clearInterval(pollProgress);
              setSetupComplete(true);
            }
          } catch (error) {
            console.error('Error polling scan progress:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Scan error:', error);
      setScanProgress(prev => ({ ...prev, isScanning: false }));
    }
  };

  const renderWelcomeStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-8"
    >
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="w-32 h-32 mx-auto mb-8 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-homeflix-red to-red-600 rounded-full opacity-20 blur-xl"></div>
          <div className="relative w-full h-full bg-gradient-to-br from-homeflix-red to-homeflix-red-dark rounded-full flex items-center justify-center shadow-2xl">
            <Film className="w-16 h-16 text-white" />
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          Welcome to HomeFlix
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Transform your personal media collection into a professional streaming platform with Netflix-style interface, 
          advanced features, and seamless streaming across all your devices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="glass-card p-6 text-center"
        >
          <Monitor className="w-12 h-12 text-homeflix-red mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Netflix-Style Interface</h3>
          <p className="text-gray-400 text-sm">Beautiful, responsive design with advanced widget system</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="glass-card p-6 text-center"
        >
          <Zap className="w-12 h-12 text-homeflix-red mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Advanced Features</h3>
          <p className="text-gray-400 text-sm">Torrent downloads, subtitles, TMDB integration</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="glass-card p-6 text-center"
        >
          <Globe className="w-12 h-12 text-homeflix-red mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Multi-Device Access</h3>
          <p className="text-gray-400 text-sm">Stream on any device across your network</p>
        </motion.div>
      </div>

      <div className="mt-12">
        <button
          onClick={nextStep}
          className="homeflix-button text-lg px-8 py-4 flex items-center gap-3 mx-auto"
        >
          Get Started
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );

  const renderUserStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <User className="w-16 h-16 text-homeflix-red mx-auto" />
        <h2 className="text-3xl font-bold">User Information</h2>
        <p className="text-gray-300">Tell us about yourself to personalize your HomeFlix experience</p>
      </div>

      <div className="glass-card p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              value={userInfo.name}
              onChange={(e) => setUserInfo(prev => ({ ...prev, name: e.target.value }))}
              className="homeflix-input w-full"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
            <input
              type="email"
              value={userInfo.email}
              onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
              className="homeflix-input w-full"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
            <select
              value={userInfo.timezone}
              onChange={(e) => setUserInfo(prev => ({ ...prev, timezone: e.target.value }))}
              className="homeflix-input w-full"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Asia/Shanghai">Shanghai</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
            <select
              value={userInfo.language}
              onChange={(e) => setUserInfo(prev => ({ ...prev, language: e.target.value }))}
              className="homeflix-input w-full"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderPathsStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <HardDrive className="w-16 h-16 text-homeflix-red mx-auto" />
        <h2 className="text-3xl font-bold">Media Storage Configuration</h2>
        <p className="text-gray-300">Configure where your movies and TV shows are stored</p>
      </div>

      <div className="glass-card p-8 space-y-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Primary Media Directory
              <span className="text-homeflix-red ml-1">*</span>
            </label>
            <input
              type="text"
              value={mediaPaths.primary}
              onChange={(e) => setMediaPaths(prev => ({ ...prev, primary: e.target.value }))}
              className="homeflix-input w-full"
              placeholder="/path/to/your/movies"
            />
            <p className="text-gray-400 text-sm mt-2">
              Main directory containing your movies and TV shows
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Downloads Directory
            </label>
            <input
              type="text"
              value={mediaPaths.downloads}
              onChange={(e) => setMediaPaths(prev => ({ ...prev, downloads: e.target.value }))}
              className="homeflix-input w-full"
              placeholder="/path/to/downloads"
            />
            <p className="text-gray-400 text-sm mt-2">
              Directory for torrent downloads (optional)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Additional Media Paths
            </label>
            <div className="space-y-3">
              {mediaPaths.additional.map((path, index) => (
                <div key={index} className="flex gap-3">
                  <input
                    type="text"
                    value={path}
                    onChange={(e) => {
                      const newPaths = [...mediaPaths.additional];
                      newPaths[index] = e.target.value;
                      setMediaPaths(prev => ({ ...prev, additional: newPaths }));
                    }}
                    className="homeflix-input flex-1"
                    placeholder="/additional/media/path"
                  />
                  <button
                    onClick={() => {
                      const newPaths = mediaPaths.additional.filter((_, i) => i !== index);
                      setMediaPaths(prev => ({ ...prev, additional: newPaths }));
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => setMediaPaths(prev => ({ ...prev, additional: [...prev.additional, ''] }))}
                className="w-full py-3 border-2 border-dashed border-gray-600 hover:border-homeflix-red rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                + Add Additional Path
              </button>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-blue-300 font-medium mb-1">Path Requirements:</p>
              <ul className="text-blue-200 space-y-1">
                <li>• Paths must be accessible from the Docker container</li>
                <li>• Use absolute paths (starting with /)</li>
                <li>• Ensure proper read permissions</li>
                <li>• Network paths should be mounted locally first</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderApiStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <Key className="w-16 h-16 text-homeflix-red mx-auto" />
        <h2 className="text-3xl font-bold">API Configuration</h2>
        <p className="text-gray-300">Set up integrations for enhanced features (all optional)</p>
      </div>

      <div className="space-y-6">
        {/* TMDB API */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Film className="w-6 h-6 text-homeflix-red" />
            <h3 className="text-xl font-semibold">TMDB (The Movie Database)</h3>
            <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">Recommended</span>
          </div>
          <p className="text-gray-400 mb-4">
            Enables movie metadata, posters, trailers, and cast information
          </p>
          <input
            type="text"
            value={apiKeys.tmdb}
            onChange={(e) => setApiKeys(prev => ({ ...prev, tmdb: e.target.value }))}
            className="homeflix-input w-full"
            placeholder="Enter TMDB API key"
          />
          <p className="text-gray-500 text-sm mt-2">
            Get your free API key at <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-homeflix-red hover:underline">themoviedb.org</a>
          </p>
        </div>

        {/* OpenSubtitles API */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-6 h-6 text-homeflix-red" />
            <h3 className="text-xl font-semibold">OpenSubtitles</h3>
            <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full">Optional</span>
          </div>
          <p className="text-gray-400 mb-4">
            Enables automatic subtitle downloads in 20+ languages
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={apiKeys.opensubtitles}
                onChange={(e) => setApiKeys(prev => ({ ...prev, opensubtitles: e.target.value }))}
                className="homeflix-input w-full"
                placeholder="OpenSubtitles API key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                type="text"
                value={apiKeys.opensubtitlesUsername}
                onChange={(e) => setApiKeys(prev => ({ ...prev, opensubtitlesUsername: e.target.value }))}
                className="homeflix-input w-full"
                placeholder="OpenSubtitles username"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={apiKeys.opensubtitlesPassword}
                onChange={(e) => setApiKeys(prev => ({ ...prev, opensubtitlesPassword: e.target.value }))}
                className="homeflix-input w-full pr-12"
                placeholder="OpenSubtitles password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Register for free at <a href="https://www.opensubtitles.com" target="_blank" className="text-homeflix-red hover:underline">opensubtitles.com</a>
          </p>
        </div>

        {/* YouTube API */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Play className="w-6 h-6 text-homeflix-red" />
            <h3 className="text-xl font-semibold">YouTube Data API</h3>
            <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded-full">Optional</span>
          </div>
          <p className="text-gray-400 mb-4">
            Enables music features and enhanced trailer playback
          </p>
          <input
            type={showPasswords ? "text" : "password"}
            value={apiKeys.youtube}
            onChange={(e) => setApiKeys(prev => ({ ...prev, youtube: e.target.value }))}
            className="homeflix-input w-full"
            placeholder="YouTube Data API key"
          />
          <p className="text-gray-500 text-sm mt-2">
            Get your API key at <a href="https://console.developers.google.com" target="_blank" className="text-homeflix-red hover:underline">Google Cloud Console</a>
          </p>
        </div>
      </div>
    </motion.div>
  );

  const renderSystemStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <Server className="w-16 h-16 text-homeflix-red mx-auto" />
        <h2 className="text-3xl font-bold">System Configuration</h2>
        <p className="text-gray-300">Configure performance and feature settings</p>
      </div>

      <div className="space-y-6">
        {/* Feature Toggles */}
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold mb-4">Features</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Redis Caching</h4>
                <p className="text-gray-400 text-sm">Improves performance with intelligent caching</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemConfig.enableRedis}
                  onChange={(e) => setSystemConfig(prev => ({ ...prev, enableRedis: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-homeflix-red"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Torrent Downloads</h4>
                <p className="text-gray-400 text-sm">Enable one-click movie downloads</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemConfig.enableTorrents}
                  onChange={(e) => setSystemConfig(prev => ({ ...prev, enableTorrents: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-homeflix-red"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Subtitle Integration</h4>
                <p className="text-gray-400 text-sm">Automatic subtitle downloads and management</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemConfig.enableSubtitles}
                  onChange={(e) => setSystemConfig(prev => ({ ...prev, enableSubtitles: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-homeflix-red"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Performance Settings */}
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold mb-4">Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hardware Acceleration</label>
              <select
                value={systemConfig.hardwareAcceleration}
                onChange={(e) => setSystemConfig(prev => ({ ...prev, hardwareAcceleration: e.target.value }))}
                className="homeflix-input w-full"
              >
                <option value="none">None (Software)</option>
                <option value="nvidia">NVIDIA GPU</option>
                <option value="intel">Intel Quick Sync</option>
                <option value="amd">AMD GPU</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cache Size (MB)</label>
              <input
                type="number"
                value={systemConfig.cacheSize}
                onChange={(e) => setSystemConfig(prev => ({ ...prev, cacheSize: parseInt(e.target.value) }))}
                className="homeflix-input w-full"
                min="256"
                max="8192"
                step="256"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Concurrent Scans</label>
              <input
                type="number"
                value={systemConfig.maxConcurrentScans}
                onChange={(e) => setSystemConfig(prev => ({ ...prev, maxConcurrentScans: parseInt(e.target.value) }))}
                className="homeflix-input w-full"
                min="1"
                max="16"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderInstallStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <Download className="w-16 h-16 text-homeflix-red mx-auto" />
        <h2 className="text-3xl font-bold">Installation</h2>
        <p className="text-gray-300">Install and configure HomeFlix components</p>
      </div>

      <div className="glass-card p-8">
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4">Ready to Install</h3>
            <p className="text-gray-400 mb-6">
              We'll now install and configure HomeFlix with your settings. This process will:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Build Docker containers</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Configure database</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Set up API integrations</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Initialize media paths</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Start services</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm">Verify installation</span>
            </div>
          </div>

          <div className="text-center pt-6">
            <button
              onClick={startInstallation}
              disabled={isInstalling}
              className="homeflix-button text-lg px-8 py-4 flex items-center gap-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Start Installation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderScanStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <Database className="w-16 h-16 text-homeflix-red mx-auto" />
        <h2 className="text-3xl font-bold">Media Library Scanning</h2>
        <p className="text-gray-300">Scan and organize your media collection</p>
      </div>

      {!scanProgress.isScanning && !setupComplete ? (
        <div className="glass-card p-8 text-center space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Ready to Scan Your Media</h3>
            <p className="text-gray-400">
              We'll scan your configured media paths and organize your movies and TV shows.
              This process may take some time depending on your library size.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <RefreshCw className="w-8 h-8 text-homeflix-red mx-auto mb-2" />
              <h4 className="font-medium">Scan Files</h4>
              <p className="text-gray-400 text-sm">Discover media files</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <Film className="w-8 h-8 text-homeflix-red mx-auto mb-2" />
              <h4 className="font-medium">Extract Metadata</h4>
              <p className="text-gray-400 text-sm">Get movie information</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <CheckCircle className="w-8 h-8 text-homeflix-red mx-auto mb-2" />
              <h4 className="font-medium">Generate Assets</h4>
              <p className="text-gray-400 text-sm">Create thumbnails</p>
            </div>
          </div>

          <button
            onClick={startMediaScan}
            className="homeflix-button text-lg px-8 py-4 flex items-center gap-3 mx-auto"
          >
            <Database className="w-5 h-5" />
            Start Media Scan
          </button>
        </div>
      ) : scanProgress.isScanning ? (
        <div className="space-y-6">
          {/* Progress Overview */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Scanning Progress</h3>
              <span className="text-homeflix-red font-semibold">{scanProgress.progress.toFixed(1)}%</span>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
              <motion.div
                className="bg-gradient-to-r from-homeflix-red to-red-600 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${scanProgress.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-homeflix-red">{scanProgress.totalFiles}</div>
                <div className="text-gray-400 text-sm">Total Files</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{scanProgress.processedFiles}</div>
                <div className="text-gray-400 text-sm">Processed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{scanProgress.errors.length}</div>
                <div className="text-gray-400 text-sm">Errors</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{scanProgress.eta}</div>
                <div className="text-gray-400 text-sm">ETA</div>
              </div>
            </div>
          </div>

          {/* Current Activity */}
          <div className="glass-card p-6">
            <h4 className="font-semibold mb-3">Current Activity</h4>
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-homeflix-red" />
              <span className="font-medium">{scanProgress.currentStep}</span>
            </div>
            {scanProgress.currentFile && (
              <p className="text-gray-400 text-sm truncate">
                Processing: {scanProgress.currentFile}
              </p>
            )}
          </div>

          {/* Errors and Warnings */}
          {(scanProgress.errors.length > 0 || scanProgress.warnings.length > 0) && (
            <div className="space-y-4">
              {scanProgress.errors.length > 0 && (
                <div className="glass-card p-6">
                  <h4 className="font-semibold text-red-400 mb-3">Errors ({scanProgress.errors.length})</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {scanProgress.errors.slice(-5).map((error, index) => (
                      <div key={index} className="text-red-300 text-sm p-2 bg-red-500/10 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scanProgress.warnings.length > 0 && (
                <div className="glass-card p-6">
                  <h4 className="font-semibold text-yellow-400 mb-3">Warnings ({scanProgress.warnings.length})</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {scanProgress.warnings.slice(-5).map((warning, index) => (
                      <div key={index} className="text-yellow-300 text-sm p-2 bg-yellow-500/10 rounded">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card p-8 text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
          >
            <CheckCircle className="w-24 h-24 text-green-400 mx-auto mb-4" />
          </motion.div>
          
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-green-400">Setup Complete!</h3>
            <p className="text-gray-300">
              HomeFlix has been successfully installed and your media library has been scanned.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h4 className="font-semibold text-green-400 mb-2">Media Scanned</h4>
              <p className="text-green-300 text-sm">{scanProgress.processedFiles} files processed</p>
            </div>
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-semibold text-blue-400 mb-2">Services Running</h4>
              <p className="text-blue-300 text-sm">All components active</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <button
              onClick={() => window.open('http://localhost:3008', '_blank')}
              className="homeflix-button flex items-center gap-3"
            >
              <Home className="w-5 h-5" />
              Open HomeFlix
            </button>
            <button
              onClick={() => window.open('http://localhost:3008/settings', '_blank')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-3"
            >
              <Settings className="w-5 h-5" />
              Settings Panel
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderWelcomeStep();
      case 1: return renderUserStep();
      case 2: return renderPathsStep();
      case 3: return renderApiStep();
      case 4: return renderSystemStep();
      case 5: return renderInstallStep();
      case 6: return renderScanStep();
      default: return renderWelcomeStep();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return userInfo.name && userInfo.email;
      case 2: return mediaPaths.primary;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-homeflix-red/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-homeflix-red to-homeflix-red-dark rounded-lg flex items-center justify-center">
                  <Film className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">HomeFlix Setup</h1>
                  <p className="text-gray-400 text-sm">Installation Wizard</p>
                </div>
              </div>

              {/* Step Indicator */}
              <div className="hidden md:flex items-center gap-2">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={`step-indicator ${
                        index === currentStep
                          ? 'step-active'
                          : step.completed
                          ? 'step-completed'
                          : 'step-inactive'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="w-8 h-px bg-gray-600 mx-2"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          {currentStep > 0 && currentStep < 6 && !setupComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-between items-center mt-12 pt-8 border-t border-white/10"
            >
              <button
                onClick={prevStep}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </button>

              {currentStep < 5 && (
                <button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="homeflix-button flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}