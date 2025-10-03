"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyList } from '@/hooks/useMyList';
import { Media } from '@/types/media';

interface MyListButtonProps {
  media: Media;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const MyListButton: React.FC<MyListButtonProps> = ({
  media,
  variant = 'ghost',
  size = 'md',
  showText = true,
  className = ''
}) => {
  const { toggleMyList, checkInMyList } = useMyList();
  const [isInList, setIsInList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if media is in My List on mount
  useEffect(() => {
    const checkStatus = async () => {
      const inList = await checkInMyList(media.id);
      setIsInList(inList);
    };
    checkStatus();
  }, [media.id, checkInMyList]);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const success = await toggleMyList(media.id);
      if (success) {
        setIsInList(!isInList);
      }
    } catch (error) {
      console.error('Error toggling My List:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'sm': return 'h-8 px-2 text-xs';
      case 'lg': return 'h-12 px-6 text-base';
      default: return 'h-10 px-4 text-sm';
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleToggle}
      disabled={isLoading}
      className={`${getButtonSize()} ${className} transition-all duration-200 hover:scale-105`}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
      ) : isInList ? (
        <>
          <Check className="w-4 h-4 mr-1" />
          {showText && 'In My List'}
        </>
      ) : (
        <>
          <Plus className="w-4 h-4 mr-1" />
          {showText && 'My List'}
        </>
      )}
    </Button>
  );
};
