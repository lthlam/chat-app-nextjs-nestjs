import io from 'socket.io-client';

let socket: any = null;

function initSocket() {
  if (socket) return socket;

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  console.log('[SOCKET] 🔨 Init:', token ? 'token found' : 'no token');

  socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('[SOCKET] ✅ Connected');
  });

  socket.on('disconnect', (reason: string) => {
    console.log('[SOCKET] ❌ Disconnected:', reason);
  });

  socket.on('error', (error: any) => {
    console.error('[SOCKET] ❌ Error:', error?.message || error);
  });

  return socket;
}

export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

export function clearSocketAuth() {
  if (!socket) return;

  socket.auth = {};
  if (socket.connected) {
    socket.disconnect();
  }
}


