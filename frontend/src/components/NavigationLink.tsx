import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationLoader } from '@/contexts/NavigationLoaderContext';

interface NavigationLinkProps extends React.AnchorHTMLAttributes<HTMLDivElement> {
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
  const router = useRouter();
  const { startLoading } = useNavigationLoader();

  useEffect(() => {
    if (prefetch) {
      router.prefetch(href);
    }
  }, [href, prefetch, router]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }

    // Check if the event was prevented by the parent handler (e.g. Logo click reloading page)
    if (e.defaultPrevented) return;

    // Only trigger loading for internal navigation
    if (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      startLoading();
      router.push(href);
    } else {
      // For external links, open properly
      window.location.href = href;
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className={className}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      {...props}
      style={{ cursor: 'pointer', ...props.style }}
    >
      {children}
    </div>
  );
};

export default NavigationLink;
