'use client';

import React, { useRef, useEffect } from 'react';
import { Pin, ChevronUp, ChevronDown, PinOff } from 'lucide-react';
import { Message } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface PinnedMessagesListProps {
  pinnedMessages: Message[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onJumpToMessage: (id: string) => void;
  onUnpin: (id: string) => void;
}

export function PinnedMessagesList({
  pinnedMessages,
  isOpen,
  setIsOpen,
  onJumpToMessage,
  onUnpin,
}: PinnedMessagesListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (pinnedMessages.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="relative bg-blue-50/80 px-4 py-1 dark:bg-slate-800/70 z-20"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-slate-700"
      >
        <span className="flex items-center gap-2">
          <Pin className="h-4 w-4" />
          Tin nhắn đã ghim ({pinnedMessages.length})
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, scaleY: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scaleY: 1 }}
            exit={{ opacity: 0, height: 0, scaleY: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute left-0 right-0 top-full mt-0 origin-top overflow-hidden bg-white shadow-lg dark:bg-slate-900 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] rounded-b-2xl"
          >
            <div className="max-h-36 space-y-1 overflow-y-auto p-2">
              {pinnedMessages.map((message) => {
                const isImage = message.type === 'image' || (() => {
                  const content = message.content;
                  if (!content || typeof content !== 'string') return false;
                  return (
                    content.startsWith('data:image/') ||
                    /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(content) ||
                    /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(content)
                  );
                })();

                const preview = message.deleted_at
                  ? 'Tin nhắn đã bị xóa'
                  : message.type === 'album'
                    ? '[Album ảnh]'
                    : isImage
                      ? '[Hình ảnh]'
                      : message.type === 'video'
                        ? '[Video]'
                        : message.type === 'voice'
                          ? '[Tin nhắn thoại]'
                          : message.type === 'location'
                            ? '[Vị trí]'
                          : message.type === 'call'
                      ? message.content.includes(':video:') ? '[Cuộc gọi video]' : '[Cuộc gọi thoại]'
                      : message.content || 'Tin nhắn';

                return (
                  <div key={message.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-blue-100 dark:hover:bg-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        onJumpToMessage(message.id);
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left text-xs min-w-0"
                    >
                      <span className="truncate block font-medium text-gray-700 dark:text-slate-200">
                        {message.sender?.username || 'Unknown'}
                      </span>
                      <span className="truncate block text-gray-500 dark:text-slate-400">{preview}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpin(message.id);
                      }}
                      className="p-1 rounded-full text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition opacity-0 group-hover:opacity-100"
                      title="Bỏ ghim"
                    >
                      <PinOff className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
