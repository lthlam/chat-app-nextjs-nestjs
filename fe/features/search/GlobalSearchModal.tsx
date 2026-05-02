'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, MessageSquare, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { messagesApi } from '@/lib/api';

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  sender: { id: string; username: string; avatar_url?: string };
  room?: { id: string; name?: string; is_group_chat?: boolean; avatar_url?: string; members?: Array<{ id: string; username: string; avatar_url?: string }> };
}

interface RoomGroup {
  roomId: string;
  roomName: string;
  roomAvatar?: string;
  isGroup: boolean;
  messages: SearchResult[];
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const setCurrentRoomId = useChatStore(s => s.setCurrentRoomId);
  const setPendingJumpMessageId = useChatStore(s => s.setPendingJumpMessageId);
  const markRoomAsRead = useChatStore(s => s.markRoomAsRead);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setExpandedRoomId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setExpandedRoomId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const hits = await messagesApi.globalSearch(query);
        setResults(hits as unknown as SearchResult[]);
        setExpandedRoomId(null);
      } catch (err) {
        console.error('Failed to global search', err);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [query]);

  // Group results by room
  const roomGroups = useMemo<RoomGroup[]>(() => {
    const map = new Map<string, RoomGroup>();

    for (const msg of results) {
      const roomId = msg.room?.id || 'unknown';
      if (!map.has(roomId)) {
        const room = msg.room;
        // For DM: show other person's name
        const roomName = room?.is_group_chat
          ? (room?.name || 'Nhóm chat')
          : (room?.members?.find((m) => m.id !== msg.sender.id)?.username || msg.sender.username);

        const roomAvatar = room?.is_group_chat
          ? room?.avatar_url
          : (room?.members?.find((m) => m.id !== msg.sender.id)?.avatar_url || msg.sender.avatar_url);

        map.set(roomId, {
          roomId,
          roomName,
          roomAvatar,
          isGroup: room?.is_group_chat || false,
          messages: [],
        });
      }
      map.get(roomId)!.messages.push(msg);
    }

    return Array.from(map.values());
  }, [results]);

  const handleResultClick = (msg: SearchResult) => {
    const roomId = msg.room?.id;
    if (!roomId) return;

    markRoomAsRead(roomId);
    setCurrentRoomId(roomId);
    setPendingJumpMessageId(msg.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700/50 animate-scale-in">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tra cứu toàn cục</h2>
              <p className="text-xs text-slate-500">Tìm kiếm tin nhắn trong tất cả đoạn chat</p>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập từ khóa cần tìm..."
              className="w-full pl-5 pr-12 py-2.5 border-2 border-blue-200 rounded-xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400 shadow-sm"
            />
            {isLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            )}
            {!isLoading && query && (
              <button 
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
          {query && !isLoading && results.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400 font-medium">
              Không tìm thấy kết quả nào.
            </div>
          )}

          {!query && (
            <div className="p-8 text-center text-sm text-slate-400 font-medium flex flex-col items-center gap-3">
              <MessageSquare className="w-10 h-10 opacity-20" />
              Bắt đầu gõ để tìm kiếm tin nhắn
            </div>
          )}

          {roomGroups.length > 0 && (
            <div className="p-2 space-y-1">
              {/* Summary */}
              <div className="px-3 py-2 text-xs text-slate-400 font-semibold">
                Tìm thấy {results.length} kết quả trong {roomGroups.length} đoạn chat
              </div>

              {roomGroups.map((group) => {
                const isExpanded = expandedRoomId === group.roomId;

                return (
                  <div key={group.roomId} className="rounded-xl overflow-hidden">
                    {/* Room header - clickable to expand */}
                    <button
                      onClick={() => setExpandedRoomId(isExpanded ? null : group.roomId)}
                      className="w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 transition-colors rounded-xl"
                    >
                      <div className="w-10 h-10 rounded-full border border-blue-200 dark:border-blue-800 overflow-hidden shrink-0 shadow-sm bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                        {group.roomAvatar ? (
                          <img src={group.roomAvatar} alt={group.roomName} className="w-full h-full object-cover" />
                        ) : (
                          <span>
                            {group.isGroup ? '👥' : group.roomName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {group.roomName}
                          </span>
                          {group.isGroup && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-500 font-semibold border border-blue-100 dark:border-blue-800/50">
                              Nhóm
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {group.messages.length} kết quả trùng khớp
                        </p>
                      </div>
                      <div className="shrink-0 text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* Expanded messages */}
                    {isExpanded && (
                      <div className="ml-6 border-l-2 border-indigo-200 dark:border-indigo-800/50 pl-3 pb-2 space-y-0.5 animate-fade-in">
                        {group.messages.map((msg) => (
                          <button
                            key={msg.id}
                            onClick={() => handleResultClick(msg)}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-start gap-3"
                          >
                            <div className="w-7 h-7 rounded-full border border-blue-200 dark:border-blue-800 overflow-hidden shrink-0 mt-0.5 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                              {msg.sender.avatar_url ? (
                                <img src={msg.sender.avatar_url} alt={msg.sender.username} className="w-full h-full object-cover" />
                              ) : (
                                <span>
                                  {msg.sender.username.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                                  {msg.sender.username}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(msg.created_at).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                                {msg.content}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
