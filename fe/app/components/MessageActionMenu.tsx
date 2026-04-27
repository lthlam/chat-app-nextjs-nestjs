'use client';

import React, { useState } from 'react';
import { Message } from '@/lib/api';
import { Pin, Reply, Smile, Trash2, MoreVertical, Forward } from 'lucide-react';

interface MessageActionMenuProps {
  message: Message;
  isCurrentUser: boolean;
  activeActionMenuMessageId: string | null;
  reactionPickerFor: string | null;
  onOpenActionMenu: (id: string) => void;
  onScheduleCloseActionMenu: (id: string) => void;
  onScheduleOpenReactionPicker: (id: string) => void;
  onScheduleCloseReactionPicker: (id: string) => void;
  onOpenReactionPicker: (id: string) => void;
  onReactionSelect: (id: string, emoji: string) => void;
  onReply: (message: Message) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onDelete: (id: string) => void;
  onForward?: (messageId: string) => void;
}

export function MessageActionMenu({
  message,
  isCurrentUser,
  activeActionMenuMessageId,
  reactionPickerFor,
  onOpenActionMenu,
  onScheduleCloseActionMenu,
  onScheduleOpenReactionPicker,
  onScheduleCloseReactionPicker,
  onOpenReactionPicker,
  onReactionSelect,
  onReply,
  onTogglePin,
  onDelete,
  onForward,
}: MessageActionMenuProps) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏'];

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const firstUrl = message.type === 'text' ? message.content.match(urlRegex)?.[0] : null;

  if (message.deleted_at) return null;

  return (
    <div
      className={`
        ${(activeActionMenuMessageId === message.id || reactionPickerFor === message.id) ? 'flex' : 'hidden'}
        ${(message.type !== 'text' || firstUrl) ? 'max-[480px]:flex' : ''}
        absolute top-1/2 -translate-y-1/2 ${isCurrentUser ? 'right-full mr-2' : 'left-full ml-2'} items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-gray-100 dark:border-slate-700 rounded-full shadow-2xl px-1.5 py-1 z-[100] animate-in fade-in zoom-in-75
      `}
      onMouseEnter={() => onOpenActionMenu(message.id)}
      onMouseLeave={() => {
        onScheduleCloseActionMenu(message.id);
        setIsMoreMenuOpen(false);
      }}
    >
      <div
        className="relative"
        onMouseEnter={() => onScheduleOpenReactionPicker(message.id)}
        onMouseLeave={() => onScheduleCloseReactionPicker(message.id)}
      >
        <button
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title="React"
        >
          <Smile className="h-4 w-4" />
        </button>
        {reactionPickerFor === message.id && (
          <div
            className={`absolute bottom-full mb-2 ${isCurrentUser ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full shadow-2xl p-1.5 flex gap-1.5 z-40 animate-in zoom-in-75 slide-in-from-bottom-2 duration-150`}
            onMouseEnter={() => onOpenReactionPicker(message.id)}
            onMouseLeave={() => onScheduleCloseReactionPicker(message.id)}
          >
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReactionSelect(message.id, emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-50 dark:hover:bg-slate-700 hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => onReply(message)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors group/tooltip relative"
      >
        <Reply className="h-4 w-4" />
        <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
          Trả lời
        </span>
      </button>

      {onForward && message.type !== 'call' && (
        <button
          onClick={() => onForward(message.id)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-green-600 hover:bg-green-50 dark:hover:bg-slate-700 transition-colors group/tooltip relative"
        >
          <Forward className="h-4 w-4" />
          <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
            Chuyển tiếp
          </span>
        </button>
      )}

      <button
        onClick={() => onTogglePin(message.id, !!message.is_pinned)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors max-[480px]:hidden group/tooltip relative"
      >
        <Pin className="h-4 w-4" />
        <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
          {message.is_pinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
        </span>
      </button>

      {isCurrentUser && (
        <button
          onClick={() => onDelete(message.id)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors max-[480px]:hidden group/tooltip relative"
        >
          <Trash2 className="h-4 w-4" />
          <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
            Xoá tin nhắn
          </span>
        </button>
      )}

      {/* Mobile More Button & Vertical Menu */}
      <div className="relative hidden max-[480px]:block">
        <button
          onClick={(e) => { e.stopPropagation(); setIsMoreMenuOpen(!isMoreMenuOpen); }}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isMoreMenuOpen ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {isMoreMenuOpen && (
          <div 
            className={`absolute bottom-full mb-3 ${isCurrentUser ? 'right-0' : 'left-0'} w-32 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-2xl p-1 z-[110] flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { onTogglePin(message.id, !!message.is_pinned); setIsMoreMenuOpen(false); }}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <Pin className={`h-4 w-4 ${message.is_pinned ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
              <span>{message.is_pinned ? 'Bỏ ghim' : 'Ghim'}</span>
            </button>
            {onForward && message.type !== 'call' && (
              <button
                onClick={() => { onForward(message.id); setIsMoreMenuOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <Forward className="h-4 w-4 text-green-500" />
                <span>Chuyển tiếp</span>
              </button>
            )}
            {isCurrentUser && (
              <button
                onClick={() => { onDelete(message.id); setIsMoreMenuOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Xoá</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
