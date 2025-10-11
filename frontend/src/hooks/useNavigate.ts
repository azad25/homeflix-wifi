"use client";

import { useRouter } from 'next/navigation';
import { useNavigationLoader } from '@/contexts/NavigationLoaderContext';
import { useCallback } from 'react';

export const useNavigate = () => {
  const router = useRouter();
  const { startLoading } = useNavigationLoader();

  const push = useCallback((href: string) => {
    startLoading();
    router.push(href);
  }, [router, startLoading]);

  const replace = useCallback((href: string) => {
    startLoading();
    router.replace(href);
  }, [router, startLoading]);

  const back = useCallback(() => {
    startLoading();
    router.back();
  }, [router, startLoading]);

  const forward = useCallback(() => {
    startLoading();
    router.forward();
  }, [router, startLoading]);

  const refresh = useCallback(() => {
    startLoading();
    router.refresh();
  }, [router, startLoading]);

  return {
    push,
    replace,
    back,
    forward,
    refresh,
    prefetch: router.prefetch,
  };
};
