'use client';

import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Message } from '@/lib/api';

interface MessageSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Message[];
  activeIndex: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onExit: () => void;
}

export function MessageSearchBar({
  searchQuery,
  setSearchQuery,
  searchResults,
  activeIndex,
  onNavigate,
  onExit,
}: MessageSearchBarProps) {
  return (
    <div className="px-4 py-1.5 max-[420px]:px-2.5 max-[420px]:py-1 max-[380px]:px-2 bg-blue-100/60 flex gap-2 dark:bg-slate-900">
      <div className="relative flex-1">
        <input
          type="text"
          placeholder="Tìm kiếm tin nhắn…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 pr-10 rounded-xl bg-white/95 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-black placeholder:text-gray-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-300" />
      </div>
      {searchQuery.trim() && (
        <div className="flex items-center gap-1.5">
          <span className="py-2 px-2 max-[420px]:px-1.5 bg-blue-100 text-blue-700 rounded text-sm max-[420px]:text-xs whitespace-nowrap">
            {searchResults.length > 0
              ? `${activeIndex + 1}/${searchResults.length}`
              : '0 results'}
          </span>
          <button
            type="button"
            onClick={() => onNavigate('prev')}
            disabled={searchResults.length === 0}
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-blue-100 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Previous result"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('next')}
            disabled={searchResults.length === 0}
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-blue-100 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Next result"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-red-100 hover:text-red-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-red-900/30"
            title="Exit search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
