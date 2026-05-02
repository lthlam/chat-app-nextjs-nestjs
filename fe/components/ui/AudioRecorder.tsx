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
            <button 
              aria-label="Dừng ghi âm" 
              onClick={stopRecording} 
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md animate-pulse"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
          {!isRecording && !audioBlob && (
            <button 
              aria-label="Bắt đầu ghi âm" 
              onClick={startRecording} 
              className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
          <span aria-live="polite" className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
            {isRecording ? `Ghi âm… ${formatTime(duration)}` : 'Đang chuẩn bị…'}
          </span>
          <button 
            aria-label="Hủy ghi âm" 
            onClick={onCancel} 
            className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition duration-200"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <span className="text-xs font-bold text-green-600">Sẵn sàng ({formatTime(duration)})</span>
          <button 
            aria-label="Xóa bản ghi" 
            onClick={() => setAudioBlob(null)} 
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition duration-200"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleSend} 
            className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold transition duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          >
            <Send className="w-3.5 h-3.5" /> Gửi
          </button>
          <button 
            onClick={onCancel} 
            className="px-2 py-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-xs font-medium transition duration-200"
          >
            Hủy
          </button>
        </>
      )}
    </div>
  );
}
