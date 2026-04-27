'use client';

import { Send } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { Avatar } from './Avatar';

interface FriendItemProps {
  friend: any;
  onStartChat: (friend: any) => void;
}

export function FriendItem({ friend, onStartChat }: FriendItemProps) {
  const { setSelectedUserProfileUser } = useChatStore();

  return (
    <div className="w-full text-left px-4 py-3 max-[420px]:px-3 max-[420px]:py-2.5 max-[380px]:px-2.5 max-[380px]:py-2 hover:bg-white/80 transition dark:hover:bg-slate-800 group/friend">
      <div className="flex items-center gap-3 max-[420px]:gap-2">
        <div 
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition"
          onClick={() => setSelectedUserProfileUser(friend)}
        >
          <Avatar 
            src={friend.avatar_url} 
            name={friend.username} 
            size="md" 
            className="max-[420px]:w-8 max-[420px]:h-8" 
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-slate-200 truncate group-hover/friend:text-blue-600 transition-colors">
              {friend.username}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400 truncate">
              {friend.email}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStartChat(friend)}
            className="group relative p-2 rounded-xl text-blue-600 hover:bg-blue-100 transition flex items-center justify-center dark:hover:bg-slate-700"
          >
            <Send className="w-4 h-4" />
            <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 z-[60] dark:bg-slate-700">
              Nhắn tin
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
