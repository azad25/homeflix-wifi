'use client';

import React, { Suspense } from 'react';
import PinLock from '@/components/PinLock';
import SettingsShell from '@/components/settings/SettingsShell';

// The panel itself lives in components/settings: a shell with lazily loaded
// sections (components/settings/sections/*).
export default function SettingsPage() {
  return (
    <PinLock>
      <Suspense fallback={<div className="h-[100dvh] bg-black" />}>
        <SettingsShell />
      </Suspense>
    </PinLock>
  );
}
