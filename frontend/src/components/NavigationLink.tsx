import React from 'react';
import Link from 'next/link';
import { useNavigationLoader } from '@/contexts/NavigationLoaderContext';

interface NavigationLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Internal link with the global navigation indicator.
 * Renders a real <a> via next/link (was a clickable <div>): links can be
 * opened in a new tab, are keyboard/remote accessible, and Next prefetches
 * the route when it enters the viewport.
 */
const NavigationLink: React.FC<NavigationLinkProps> = ({
  href,
  children,
  className = '',
  prefetch = true,
  onClick,
  ...props
}) => {
  const { startLoading } = useNavigationLoader();
  const isExternal = /^(https?:|mailto:|tel:)/.test(href);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Let the browser handle new-tab/window clicks.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!isExternal && props.target !== '_blank') startLoading(href);
  };

  if (isExternal) {
    return (
      <a href={href} className={className} onClick={onClick} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};

export default NavigationLink;
