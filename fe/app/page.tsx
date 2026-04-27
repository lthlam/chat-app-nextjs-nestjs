'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const router = useRouter();
  const { token, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    router.push(token ? '/chat' : '/auth/login');
  }, [hasHydrated, token, router]);

  return null;
}
