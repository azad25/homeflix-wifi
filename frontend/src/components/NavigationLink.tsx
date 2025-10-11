"use client";

import React from 'react';
import Link from 'next/link';
import { useNavigationLoader } from '@/contexts/NavigationLoaderContext';

interface NavigationLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
}

const NavigationLink: React.FC<NavigationLinkProps> = ({ 
  href, 
  children, 
  className = '', 
  prefetch = true,
  onClick,
  ...props 
}) => {
  const { startLoading } = useNavigationLoader();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only trigger loading for internal navigation
    if (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      startLoading();
    }
    
    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Link 
      href={href} 
      className={className} 
      onClick={handleClick}
      prefetch={prefetch}
      {...props}
    >
      {children}
    </Link>
  );
};

export default NavigationLink;
