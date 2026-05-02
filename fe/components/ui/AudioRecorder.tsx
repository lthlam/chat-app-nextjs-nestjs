'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { messagesApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface AudioRecorderProps {
  roomId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AudioRecorder({ roomId, onSuccess, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 64000 });
      mediaRecorderRef.current = recorder;
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      recorder.start();
      setIsRecording(true);
      setDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Mic access denied', err);
      onCancelRef.current();
    }
  }, []);

  useEffect(() => {
    // Note: No auto-start. Wait for user to click button.
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [startRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleSend = async () => {
    if (!audioBlob) return;
    try {
      const { voiceUrl } = await messagesApi.uploadVoice(audioBlob);
      const socket = getSocket();
      socket.emit('send-message', {
        roomId,
        content: voiceUrl,
        type: 'voice'
      });
      onSuccessRef.current();
    } catch (err) {
      console.error('Voice send failed', err);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-slate-700 animate-in slide-in-from-bottom-2">
      {!audioBlob ? (
        <>
          {isRecording && (
            <button aria-label="Dừng ghi âm" onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full animate-pulse">
              <Square className="w-4 h-4" />
            </button>
          )}
          {!isRecording && !audioBlob && (
            <button aria-label="Bắt đầu ghi âm" onClick={startRecording} className="p-2 bg-purple-600 text-white rounded-full">
              <Mic className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
            {isRecording ? `Ghi âm... ${formatTime(duration)}` : 'Đang chuẩn bị...'}
          </span>
          <button aria-label="Hủy ghi âm" onClick={onCancel} className="ml-auto p-1 text-gray-400 hover:text-gray-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <span className="text-xs font-bold text-green-600">Sẵn sàng ({formatTime(duration)})</span>
          <button aria-label="Xóa bản ghi" onClick={() => setAudioBlob(null)} className="p-1 text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={handleSend} className="ml-auto p-2 bg-blue-600 text-white rounded-lg flex items-center gap-1 text-xs">
            <Send className="w-3 h-3" /> Gửi
          </button>
          <button onClick={onCancel} className="p-1 text-gray-400 text-xs">Hủy</button>
        </>
      )}
    </div>
  );
}
