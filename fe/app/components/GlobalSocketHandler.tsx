'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useSocketAuth } from '@/lib/useSocketAuth';
import { useUiStore } from '@/store/uiStore';
import { useRef } from 'react';

export function GlobalSocketHandler() {
  // Initialize socket connection and auth
  useSocketAuth();

  const { user } = useAuthStore();
  const requestConfirm = useUiStore((state) => state.requestConfirm);
  const closeConfirm = useUiStore((state) => state.closeConfirm);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const onRequest = async (payload: { 
      roomId: string; 
      fromUserId: string; 
      fromUsername?: string;
      callType?: 'audio' | 'video';
    }) => {
      // Don't show for own requests
      if (payload.fromUserId === user?.id) return;

      // Don't handle if we are already on this specific call page
      if (typeof window !== 'undefined' && window.location.pathname.includes(`/chat/call/${payload.roomId}`)) {
        return;
      }

      // Check if this room is already being handled in another tab/window
      const activeCallRoomId = localStorage.getItem('chat_app_call_room_id');
      if (activeCallRoomId === payload.roomId) {
        console.log('[GLOBAL] 📞 Call for this room is already active, ignoring duplicate request');
        return;
      }

      console.log('[GLOBAL] 📞 Incoming call request from:', payload.fromUsername || payload.fromUserId);

      // Play ringtone
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('/ringtone.wav');
        ringtoneRef.current.loop = true;
        ringtoneRef.current.volume = 0.5;
        ringtoneRef.current.play().catch(e => console.warn('Ringtone blocked by browser autoplay policy:', e));
      }

      const isVideo = payload.callType === 'video';
      const accepted = await requestConfirm({
        title: isVideo ? 'Cuộc gọi video mới' : 'Cuộc gọi thoại mới',
        message: `Bạn có cuộc gọi ${isVideo ? 'video' : 'thoại'} từ ${payload.fromUsername || 'người dùng'}. Chấp nhận?`,
        confirmText: 'Chấp nhận',
        cancelText: 'Từ chối',
      });

      // Stop ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }

      if (accepted) {
        const url = `/chat/call/${payload.roomId}?role=answerer&type=${isVideo ? 'video' : 'audio'}`;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          window.open(url, '_blank');
        } else {
          const features = 'width=450,height=650,menubar=no,toolbar=no,location=no,status=no';
          window.open(url, `call_${payload.roomId}`, features);
        }
      } else {
        socket.emit('audio-call-end', { roomId: payload.roomId });
      }
    };

    const onCallEnd = () => {
      closeConfirm();
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };

    const onNewMessage = (m: any) => {
      if (m.sender?.id !== user?.id) {
        socket.emit('message-delivered', { messageId: m.id });
      }
    };

    socket.on('audio-call-request', onRequest);
    socket.on('audio-call-end', onCallEnd);
    socket.on('new-message', onNewMessage);

    return () => {
      socket.off('audio-call-request', onRequest);
      socket.off('audio-call-end', onCallEnd);
      socket.off('new-message', onNewMessage);

      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, [user?.id, requestConfirm, closeConfirm]);

  return null;
}
