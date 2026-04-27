'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AppPopupHost } from './components/AppPopupHost';
import { GlobalSocketHandler } from './components/GlobalSocketHandler';

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { hasHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  if (!mounted || !hasHydrated) {
    return null;
  }

  return (
    <>
      {children}
      <AppPopupHost />
      <GlobalSocketHandler />
    </>
  );
}

