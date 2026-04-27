import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

export function useSocketAuth() {
  const { token } = useAuthStore();

  useEffect(() => {
    const socket = getSocket();

    if (!token) {
      if (socket.connected) socket.disconnect();
      return;
    }

    if (socket.connected) socket.disconnect();
    (socket as any).auth = { token };
    socket.connect();
    console.log('[SOCKET] 🔑 Connected with token');
  }, [token]);
}



