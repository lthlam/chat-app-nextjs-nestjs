'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { roomsApi } from '@/lib/api';

import { useWebRTC } from '@/hooks/useWebRTC';
import { CallVideoRenderer } from '@/app/components/CallVideoRenderer';
import { CallControls } from '@/app/components/CallControls';

export default function CallPage() {
  const { roomId } = useParams() as { roomId: string };
  const searchParams = useSearchParams();
  const role = searchParams.get('role'); // 'offerer' or 'answerer'
  const callType = searchParams.get('type') || 'audio'; // 'audio' or 'video'
  
  const { user, hasHydrated } = useAuthStore();
  const showToast = useUiStore((state) => state.showToast);

  const [roomMembers, setRoomMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!roomId) return;
    roomsApi.getMembers(roomId).then(setRoomMembers).catch(console.error);
  }, [roomId]);

  const otherPerson = roomMembers.find((m) => m.id !== user?.id);
  const displayName = otherPerson?.username || 'User';

  const {
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    isCallActive,
    callDuration,
    isMuted,
    isVideoOff,
    stopCall,
    toggleMute,
    toggleVideo,
  } = useWebRTC({
    roomId,
    role,
    callType,
    user,
    hasHydrated,
    showToast,
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!hasHydrated || !user) return null;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-0 sm:p-4 overflow-hidden">
      <CallVideoRenderer
        callType={callType}
        isCallActive={isCallActive}
        isVideoOff={isVideoOff}
        callDuration={callDuration}
        displayName={displayName}
        otherPerson={otherPerson}
        formatTime={formatTime}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteAudioRef={remoteAudioRef}
      />
      
      <CallControls
        callType={callType}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        toggleMute={toggleMute}
        toggleVideo={toggleVideo}
        stopCall={stopCall}
      />
    </div>
  );
}
