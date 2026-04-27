'use client';

import React, { useState, useRef } from 'react';
import { Message } from '@/lib/api';
import { Video, Phone, PhoneIncoming, PhoneOutgoing, MapPin, Play } from 'lucide-react';

import { LinkPreview } from './LinkPreview';

interface MessageMediaPreviewProps {
  message: Message;
  isCurrentUser: boolean;
  onJumpToMessage: (id: string) => void;
  renderHighlightedText: (text: string, highlight: boolean) => React.ReactNode;
  isActiveSearchTarget: boolean;
}

export function MessageMediaPreview({
  message,
  isCurrentUser,
  onJumpToMessage,
  renderHighlightedText,
  isActiveSearchTarget,
}: MessageMediaPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const isImageLikeContent = (content?: string) => {
    if (!content || typeof content !== 'string') return false;
    return (
      content.startsWith('data:image/') ||
      /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(content) ||
      /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(content)
    );
  };

  const isImageMessage = message.type === 'image' || isImageLikeContent(message.content);
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const firstUrl = message.type === 'text' ? message.content.match(urlRegex)?.[0] : null;

  const replyToMessage = message.reply_to;
  const replyPreviewSender = replyToMessage?.sender?.username || 'Tin nhắn';
  const replyIsImage = replyToMessage?.type === 'image' || isImageLikeContent(replyToMessage?.content);
  const replyIsAlbum = replyToMessage?.type === 'album';
  const replyIsVideo = replyToMessage?.type === 'video';
  const replyIsVoice = replyToMessage?.type === 'voice';
  const replyIsCall = replyToMessage?.type === 'call';
  const replyIsLocation = replyToMessage?.type === 'location';

  const replyPreviewContent = (() => {
    if (!replyToMessage) return 'Tin nhắn';
    if (replyToMessage.deleted_at) return 'Tin nhắn đã bị xóa';
    if (replyIsAlbum) return '[Album ảnh]';
    if (replyIsImage) return '[Hình ảnh]';
    if (replyIsVideo) return '[Video]';
    if (replyIsVoice) return '[Tin nhắn thoại]';
    if (replyIsLocation) return '[Vị trí]';
    if (replyIsCall) {
      const content = replyToMessage.content || '';
      return content.includes(':video:') ? '[Cuộc gọi video]' : '[Cuộc gọi thoại]';
    }
    return replyToMessage.content || 'Tin nhắn';
  })();

  const replyQuoteClass = isCurrentUser
    ? 'border-l-2 border-white/60 bg-white/10 text-white hover:bg-white/20'
    : 'border-l-2 border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-100 hover:bg-purple-500/20';

  if (message.deleted_at) {
    return <span className="text-gray-400 italic text-sm text-[10px]">Tin nhắn đã bị xóa</span>;
  }

  if (isImageMessage) {
    return (
      <>
        {replyToMessage && (
          <button
            type="button"
            onClick={() => onJumpToMessage(replyToMessage.id)}
            className={`mx-2 mt-2 mb-2 w-[calc(100%-1rem)] text-left text-xs transition rounded-r-lg px-2 py-1 ${replyQuoteClass}`}
          >
            <div className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <p className={`truncate font-bold ${isCurrentUser ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                  {replyPreviewSender}
                </p>
                <p className="truncate opacity-80">{replyPreviewContent}</p>
              </div>
              {(replyIsImage || replyIsAlbum || replyIsVideo) && replyToMessage.content && (
                <div className="shrink-0 w-10 h-10 rounded overflow-hidden bg-black/10 relative">
                  {replyIsVideo ? (
                    <div className="w-full h-full relative border border-white/10">
                      <video src={`${replyToMessage.content}#t=0.1`} className="w-full h-full object-cover" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                  ) : replyIsImage ? (
                    <img src={replyToMessage.content} alt="Reply" className="h-full w-full object-cover" />
                  ) : (
                    (() => {
                      try {
                        const urls = JSON.parse(replyToMessage.content);
                        return <img src={urls[0]} alt="Reply" className="h-full w-full object-cover" />;
                      } catch {
                        return null;
                      }
                    })()
                  )}
                </div>
              )}

            </div>
          </button>
        )}
        <img
          src={message.content}
          alt="Chat image"
          className="max-w-[240px] max-h-[300px] max-[480px]:max-w-[50vw] rounded-xl object-cover shadow-md hover:opacity-95 transition-opacity cursor-pointer"
          onClick={() => window.open(message.content, '_blank')}
        />
      </>
    );
  }

  if (message.type === 'voice') {
    return (
      <div className="flex items-center gap-3 min-w-[140px] py-0.5">
        <button 
          onClick={() => {
            if (audioRef.current) {
              if (isPlaying) audioRef.current.pause();
              else audioRef.current.play();
              setIsPlaying(!isPlaying);
            }
          }}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isCurrentUser ? 'bg-white/20 hover:bg-white/30' : 'bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700'}`}
        >
          <span className="text-lg">{isPlaying ? '⏸️' : '▶️'}</span>
        </button>
        <div className="flex-1">
          <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full relative overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 transition-all duration-100 ${isCurrentUser ? 'bg-white' : 'bg-purple-500'}`} 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <p className="text-[10px] font-medium opacity-70">Tin nhắn thoại</p>
            <p className="text-[10px] font-mono opacity-50">
              {duration ? `${Math.floor(duration)}s` : ''}
            </p>
          </div>
        </div>
        <audio 
          ref={audioRef}
          src={message.content} 
          className="hidden" 
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            setProgress((audio.currentTime / audio.duration) * 100);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
        />
      </div>
    );
  }

  if (message.type === 'video') {
    return (
      <video
        src={message.content}
        controls
        controlsList="nodownload"
        className="max-w-[180px] md:max-w-[220px] max-[480px]:max-w-[50vw] rounded-xl shadow-md overflow-hidden bg-black"
      />
    );
  }

  if (message.type === 'album') {
    return (
      <div className="grid grid-cols-2 gap-1 max-w-[240px] max-[480px]:max-w-[50vw] rounded-xl overflow-hidden shadow-md">
        {(() => {
          try {
            const urls = JSON.parse(message.content);
            return urls.map((url: string, idx: number) => (
              <img
                key={idx}
                src={url}
                alt={`Album ${idx}`}
                className="w-full h-28 object-cover hover:opacity-90 cursor-pointer transition-opacity"
                onClick={() => window.open(url, '_blank')}
              />
            ));
          } catch {
            return <p className="p-2 text-xs opacity-50">Invalid Album</p>;
          }
        })()}
      </div>
    );
  }

  if (message.type === 'call') {
    const safeContent = message.content || ':video:0';
    return (
      <div className="flex items-center gap-3 py-1 min-w-[140px]">
        <div className={`p-2.5 rounded-full flex items-center justify-center ${isCurrentUser ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
          {isCurrentUser ? (
            <PhoneOutgoing className="w-4 h-4" />
          ) : (
            <PhoneIncoming className="w-4 h-4 text-blue-600" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold whitespace-nowrap">
            {isCurrentUser ? 'Cuộc gọi đi' : 'Cuộc gọi đến'}
          </span>
          <span className="text-[11px] opacity-70 flex items-center gap-1">
            {safeContent.includes(':video:') ? (
              <Video className="w-2.5 h-2.5" />
            ) : (
              <Phone className="w-2.5 h-2.5" />
            )}
            {(() => {
              const parts = safeContent.split(':');
              const durationStr = parts[parts.length - 1];
              const callDuration = parseInt(durationStr || '0', 10);
              if (isNaN(callDuration) || callDuration === 0) return 'Cuộc gọi nhỡ';
              const mins = Math.floor(callDuration / 60);
              const secs = callDuration % 60;
              return `${mins}:${secs.toString().padStart(2, '0')}`;
            })()}
          </span>
        </div>
      </div>
    );
  }
  
  if (message.type === 'location') {
    const [lat, lng] = (message.content || '0,0').split(',');
    return (
      <div className="flex flex-col gap-2 min-w-[200px] py-1">
        <div className="flex items-center gap-2 font-semibold text-xs">
          <MapPin className="w-4 h-4 text-rose-500" />
          <span className="opacity-90">Vị trí của tôi</span>
        </div>

        <div className="rounded-xl overflow-hidden border border-blue-100 dark:border-slate-700 h-32 w-full relative group/map">
          <iframe 
            width="100%" 
            height="100%" 
            style={{ border: 0 }}
            src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="pointer-events-none"
          />
          <div className="absolute inset-0 bg-transparent cursor-pointer" onClick={() => window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')} />
        </div>
      </div>
    );
  }

  return (
    <>
      {replyToMessage && (
        <button
          type="button"
          onClick={() => onJumpToMessage(replyToMessage.id)}
          className={`mb-2 w-full text-left text-xs transition rounded-r-lg px-2 py-1 ${replyQuoteClass}`}
        >
          <div className="flex gap-2 items-center">
            <div className="flex-1 min-w-0">
              <p className={`truncate font-bold ${isCurrentUser ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                {replyPreviewSender}
              </p>
              <p className="truncate opacity-80">{replyPreviewContent}</p>
            </div>
            {(replyIsImage || replyIsAlbum || replyIsVideo) && replyToMessage.content && (
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden bg-black/10 relative">
                {replyIsVideo ? (
                  <div className="w-full h-full relative border border-white/10">
                    <video src={`${replyToMessage.content}#t=0.1`} className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                ) : replyIsImage ? (
                  <img src={replyToMessage.content} alt="Reply" className="h-full w-full object-cover" />
                ) : (
                  (() => {
                    try {
                      const urls = JSON.parse(replyToMessage.content);
                      return <img src={urls[0]} alt="Reply" className="h-full w-full object-cover" />;
                    } catch {
                      return null;
                    }
                  })()
                )}
              </div>
            )}

          </div>
        </button>
      )}
      <div className="leading-relaxed break-all">
        {renderHighlightedText(message.content || '', isActiveSearchTarget)}
      </div>
      {firstUrl && <LinkPreview url={firstUrl.startsWith('http') ? firstUrl : `https://${firstUrl}`} />}
    </>
  );
}
