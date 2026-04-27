import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { roomsApi } from '@/lib/api';

interface UseWebRTCProps {
  roomId: string;
  role: string | null;
  callType: string;
  user: any;
  hasHydrated: boolean;
  showToast: (msg: string, type: 'info' | 'error' | 'success') => void;
}

export function useWebRTC({ roomId, role, callType, user, hasHydrated, showToast }: UseWebRTCProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [callDuration, setCallDuration] = useState(0);
  const [iceServers, setIceServers] = useState<any[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const missedCallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callingSoundRef = useRef<HTMLAudioElement | null>(null);

  const durationRef = useRef(0);
  const hasEndedRef = useRef(false);

  useEffect(() => {
    durationRef.current = callDuration;
  }, [callDuration]);

  const stopCall = useCallback((emitEnd = true) => {
    if (hasEndedRef.current) return;
    
    if (emitEnd && roomId) {
      console.log('[CALL] 📤 Emitting audio-call-end with duration:', durationRef.current);
      getSocket().emit('audio-call-end', { 
        roomId, 
        duration: durationRef.current,
        callType
      });
      hasEndedRef.current = true;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    if (timerRef.current) clearInterval(timerRef.current);
    if (callingSoundRef.current) {
      callingSoundRef.current.pause();
      callingSoundRef.current = null;
    }
    
    setIsCallActive(false);
    
    if (missedCallTimerRef.current) {
      clearTimeout(missedCallTimerRef.current);
      missedCallTimerRef.current = null;
    }
    
    hasEndedRef.current = true;

    setTimeout(() => {
      window.close();
    }, 1500);
  }, [roomId, callType]);

  const getOrCreatePeerConnection = useCallback((rid: string, forceNew = false) => {
    if (peerConnectionRef.current) {
      if (!forceNew && peerConnectionRef.current.signalingState !== 'closed') {
        return peerConnectionRef.current;
      }
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    const socket = getSocket();
    
    const pc = new RTCPeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10,
    });



    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('audio-call-ice-candidate', { roomId: rid, candidate: event.candidate });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      if (event.track.kind === 'video') {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      } else {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
      }
      
      setIsCallActive(true);
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsCallActive(true);
      }
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        // Gửi end = true để server lưu tin nhắn cuộc gọi kể cả khi lỗi kết nối
        stopCall(true);
      }

    };

    peerConnectionRef.current = pc;
    return pc;
  }, [stopCall, iceServers]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
      localStreamRef.current = stream;
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      showToast('Không thể truy cập camera/micro.', 'error');
      throw err;
    }
  }, [callType, showToast]);

  const remoteDescriptionSetRef = useRef(false);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isProcessingOfferRef = useRef(false);
  const isNegotiatingRef = useRef(false);

  const startInitiatingCall = useCallback(async () => {
    getSocket().emit('audio-call-request', { roomId, callType });
  }, [roomId, callType]);

  const beginWebRTCNegotiation = useCallback(async () => {
    if (isNegotiatingRef.current) return;
    if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
      console.log('[CALL] ⚠️ PC exists, skipping new negotiation');
      return;
    }

    isNegotiatingRef.current = true;
    try {
      const stream = await ensureLocalStream();
      const pc = getOrCreatePeerConnection(roomId, true);
      
      const senders = pc.getSenders();
      stream.getTracks().forEach(track => {
        const alreadyExists = senders.find(s => s.track?.[track.id ? 'id' : 'kind'] === (track.id || track.kind));
        if (!alreadyExists) pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      getSocket().emit('audio-call-offer', { roomId, offer, callType });
    } catch {
      stopCall(false);
    } finally {
      isNegotiatingRef.current = false;
    }
  }, [roomId, stopCall, getOrCreatePeerConnection, ensureLocalStream, callType]);

  const handleAnswerCall = useCallback(async (offer: any) => {
    if (isProcessingOfferRef.current) return;
    try {
      const pc = getOrCreatePeerConnection(roomId, false);
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'closed') return;

      isProcessingOfferRef.current = true;
      const stream = await ensureLocalStream();
      const senders = pc.getSenders();
      stream.getTracks().forEach(track => {
        const alreadyExists = senders.find(s => s.track?.[track.id ? 'id' : 'kind'] === (track.id || track.kind));
        if (!alreadyExists) pc.addTrack(track, stream);
      });
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescriptionSetRef.current = true;

      while (iceCandidateQueueRef.current.length > 0) {
        const cand = iceCandidateQueueRef.current.shift();
        if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket().emit('audio-call-answer', { roomId, answer });
      setIsCallActive(true);
    } catch {
      stopCall(false);
    } finally {
      isProcessingOfferRef.current = false;
    }
  }, [roomId, stopCall, getOrCreatePeerConnection, ensureLocalStream, iceServers]);

  // Fetch ICE servers once on mount
  useEffect(() => {
    if (!hasHydrated || !user || !roomId) return;
    roomsApi.getIceServers().then(setIceServers).catch(err => {
      console.error('Failed to fetch ICE servers', err);
    });
  }, [hasHydrated, user?.id, roomId]);

  useEffect(() => {
    if (!hasHydrated || !user || !roomId) return;

    const socket = getSocket();
    socket.emit('join-room', { roomId });

    const onReady = (payload: any) => {
      if (payload.roomId !== roomId || payload.fromUserId === user.id) return;
      if (missedCallTimerRef.current) clearTimeout(missedCallTimerRef.current);
      if (role === 'offerer') {
        if (callingSoundRef.current) {
          callingSoundRef.current.pause();
          callingSoundRef.current = null;
        }
        beginWebRTCNegotiation();
      }
    };


    const onOffer = (payload: any) => {
      if (payload.roomId !== roomId || payload.fromUserId === user.id) return;
      if (role === 'answerer') handleAnswerCall(payload.offer);
    };

    const onAnswer = async (payload: any) => {
      if (payload.roomId !== roomId || payload.fromUserId === user.id) return;
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          remoteDescriptionSetRef.current = true;
          while (iceCandidateQueueRef.current.length > 0) {
            const cand = iceCandidateQueueRef.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          setIsCallActive(true);
        } catch {}
      }
    };

    const onIceCandidate = async (payload: any) => {
      if (payload.roomId !== roomId || payload.fromUserId === user.id || !payload.candidate) return;
      const pc = peerConnectionRef.current;
      if (pc && remoteDescriptionSetRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
      } else {
        iceCandidateQueueRef.current.push(payload.candidate);
      }
    };

    const onCallEnd = (payload: any) => {
      if (payload.roomId === roomId) stopCall(false);
    };

    const onBusy = (payload: any) => {
      if (payload.roomId === roomId) {
        showToast('Người dùng đang trong cuộc gọi khác.', 'info');
        setTimeout(() => stopCall(false), 2000);
      }
    };

    socket.on('audio-call-ready', onReady);
    socket.on('audio-call-offer', onOffer);
    socket.on('audio-call-answer', onAnswer);
    socket.on('audio-call-ice-candidate', onIceCandidate);
    socket.on('audio-call-end', onCallEnd);
    socket.on('audio-call-busy', onBusy);

    let answerId: NodeJS.Timeout;
    if (role === 'offerer') {
      startInitiatingCall();
      if (!isCallActive && !hasEndedRef.current && !callingSoundRef.current) {
        const audio = new Audio('/calling.wav');
        audio.loop = true; audio.volume = 0.6;
        audio.play().catch(() => {});
        callingSoundRef.current = audio;
      }
    } else if (role === 'answerer') {
      answerId = setTimeout(() => {
        if (!hasEndedRef.current) socket.emit('audio-call-ready', { roomId });
      }, 800);
    }

    localStorage.setItem('chat_app_call_room_id', roomId);

    const handleBeforeUnload = () => {
      localStorage.removeItem('chat_app_call_room_id');
      stopCall(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (answerId) clearTimeout(answerId);
      if (callingSoundRef.current) {
        callingSoundRef.current.pause();
        callingSoundRef.current = null;
      }
      if (missedCallTimerRef.current) clearTimeout(missedCallTimerRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket.off('audio-call-ready', onReady);
      socket.off('audio-call-offer', onOffer);
      socket.off('audio-call-answer', onAnswer);
      socket.off('audio-call-ice-candidate', onIceCandidate);
      socket.off('audio-call-end', onCallEnd);
      socket.off('audio-call-busy', onBusy);
      localStorage.removeItem('chat_app_call_room_id');
    };
  }, [hasHydrated, user, roomId, role, isCallActive, handleAnswerCall, startInitiatingCall, beginWebRTCNegotiation, stopCall, showToast]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return {
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
  };
}
