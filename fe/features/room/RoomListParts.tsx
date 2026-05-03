'use client';

import { Search } from 'lucide-react';
import { useRoomList } from './RoomListContext';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useChatStore } from '@/store/chatStore';
import { motion } from 'framer-motion';

const CreateGroupModal = dynamic(() => import('@/features/room/CreateGroupModal').then(mod => mod.CreateGroupModal), { ssr: false });
const AddFriendModal = dynamic(() => import('@/features/friends/AddFriendModal').then(mod => mod.AddFriendModal), { ssr: false });

export function RoomListHeader() {
  const { search, setSearch } = useRoomList();
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const { setTab } = useRoomList();

  return (
    <div className="p-2 max-[480px]:p-2 border-b border-blue-100 dark:border-slate-700">
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 max-[480px]:pl-8 pr-2 py-1.5 border-2 border-blue-200 rounded-xl bg-white text-sm max-[480px]:text-xs focus:outline-none focus:ring-blue-300 focus:border-blue-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </div>
        <div className="flex shrink-0 items-center -space-x-0.5 ml-1">
          <button
            type="button"
            onClick={() => setIsAddFriendOpen(true)}
            className="group relative h-9 w-9 max-[480px]:h-8 max-[480px]:w-8 max-[420px]:h-7 max-[420px]:w-7 max-[380px]:h-[26px] max-[380px]:w-[26px] flex items-center justify-center rounded-xl border-blue-300 bg-transparent hover:bg-blue-100 transition dark:border-slate-500 dark:hover:bg-slate-700"
            title="Add friend"
          >
            <img width={400} height={400} src="/friend_add.svg" alt="Add friend" className="w-6 h-6 max-[420px]:w-4 max-[420px]:h-4 dark:invert" />
            <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 z-50 dark:bg-slate-700">
              Thêm bạn
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateGroupOpen(true)}
            className="group relative h-9 w-9 max-[480px]:h-8 max-[480px]:w-8 max-[420px]:h-7 max-[420px]:w-7 max-[380px]:h-[26px] max-[380px]:w-[26px] flex items-center justify-center rounded-xl border-blue-300 bg-transparent hover:bg-blue-100 transition dark:border-slate-500 dark:hover:bg-slate-700"
            title="Create group"
          >
            <img width={400} height={400} src="/group-add.svg" alt="Create group" className="w-6 h-6 max-[420px]:w-4 max-[420px]:h-4 dark:invert" />
            <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 z-50 dark:bg-slate-700">
              Tạo nhóm
            </span>
          </button>
        </div>
      </div>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={() => setTab('chats')}
      />
      <AddFriendModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
      />
    </div>
  );
}

export function RoomListTabs() {
  const { tab, setTab, pendingRequests } = useRoomList();
  
  return (
    <div className="flex gap-1 p-1 border-b border-blue-100 bg-blue-100/40 dark:border-slate-700 dark:bg-slate-800/40">
      {(['chats', 'friends'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition relative ${
            tab === t
              ? 'text-white'
              : 'text-gray-700 hover:bg-blue-200/50 hover:text-blue-900 dark:text-slate-300 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-1.5">
            {t === 'chats' ? 'Trò chuyện' : 'Bạn bè'}
            {t === 'friends' && pendingRequests.length > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white dark:ring-slate-900" />
            )}
          </span>
          {tab === t && (
            <motion.div
              layoutId="tabActive"
              className="absolute inset-0 bg-blue-600 rounded-lg shadow-sm"
              transition={{ duration: 0.2, ease: "easeInOut" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

export function RoomListSubTabs() {
  const { tab, chatFilter, setChatFilter } = useRoomList();
  const rooms = useChatStore(s => s.rooms);

  if (tab !== 'chats') return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-blue-50/30 dark:bg-slate-900/40 border-b border-blue-100/50 dark:border-slate-800">
      {(['all', 'unread', 'groups'] as const).map((filter) => (
        <button
          key={filter}
          onClick={() => setChatFilter(filter)}
          className={`text-xs font-bold transition-colors relative py-1 ${
            chatFilter === filter
              ? 'text-violet-500 dark:text-violet-400'
              : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {filter === 'all' && 'Tất cả'}
            {filter === 'unread' && (
              <>
                Chưa đọc
                {rooms.some((r: any) => r.last_message?.is_unread_for_me) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </>
            )}
            {filter === 'groups' && 'Nhóm'}
          </span>
          {chatFilter === filter && (
            <motion.div
              layoutId="chatFilterActive"
              className="absolute -bottom-[9px] left-0 right-0 h-[3px] bg-violet-500 dark:bg-violet-400 rounded-full"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
