import React from 'react';
import { Cast, Loader2, Tv } from 'lucide-react';
import { motion } from 'framer-motion';

interface CastButtonProps {
  isAvailable: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  deviceName?: string | null;
  onClick: () => void;
  className?: string;
}

const CastButton: React.FC<CastButtonProps> = ({
  isAvailable,
  isConnected,
  isConnecting,
  deviceName,
  onClick,
  className = '',
}) => {
  if (!isAvailable) {
    return null; // Don't show cast button if no cast devices available
  }

  const getButtonContent = () => {
    if (isConnecting) {
      return (
        <>
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="sr-only">Connecting to cast device...</span>
        </>
      );
    }

    if (isConnected) {
      return (
        <>
          <Tv className="w-6 h-6" />
          <span className="sr-only">Connected to {deviceName || 'cast device'}</span>
        </>
      );
    }

    return (
      <>
        <Cast className="w-6 h-6" />
        <span className="sr-only">Cast to TV</span>
      </>
    );
  };

  const getTitle = () => {
    if (isConnecting) return 'Connecting to cast device...';
    if (isConnected) return `Connected to ${deviceName || 'cast device'}. Click to disconnect.`;
    return 'Cast to TV';
  };

  const getButtonColor = () => {
    if (isConnected) return 'text-blue-400 hover:text-blue-300';
    if (isConnecting) return 'text-yellow-400';
    return 'text-white hover:text-white/70';
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={isConnecting}
      className={`${getButtonColor()} transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={getTitle()}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {getButtonContent()}
    </motion.button>
  );
};

export default CastButton;
