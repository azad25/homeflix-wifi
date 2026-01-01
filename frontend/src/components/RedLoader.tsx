"use client";

import React from 'react';

interface RedLoaderProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  text?: string;
  showText?: boolean;
}

const RedLoader: React.FC<RedLoaderProps> = ({ 
  size = 'medium', 
  className = '', 
  text = 'Loading...',
  showText = false 
}) => {
  const sizeClasses = {
    small: 'w-6 h-6 border-2',
    medium: 'w-12 h-12 border-4',
    large: 'w-16 h-16 border-4'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} border-red-600/30 border-t-red-600 rounded-full animate-spin`}
        style={{
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
          animation: 'spin 1s linear infinite'
        }}
      />
      {showText && (
        <span 
          className={`text-white/80 mt-2 ${textSizeClasses[size]} animate-pulse`}
        >
          {text}
        </span>
      )}
    </div>
  );
};

export default RedLoader;