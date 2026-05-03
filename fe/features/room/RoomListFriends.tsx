'use client';

import { useMemo, useCallback } from 'react';
import { useRoomList } from './RoomListContext';
import { useChatStore } from '@/store/chatStore';
import { FriendItem } from '@/features/friends/FriendItem';
import { friendsApi, roomsApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

export function RoomListFriends() {
  const { deferredSearch, showRequests, setShowRequests, pendingRequests, setPendingRequests, friends, setFriends, onRoomSelected } = useRoomList();
  const rooms = useChatStore(s => s.rooms);
  const setRooms = useChatStore(s => s.setRooms);
  const setCurrentRoomId = useChatStore(s => s.setCurrentRoomId);
  const markRoomAsRead = useChatStore(s => s.markRoomAsRead);
  const { setTab } = useRoomList();

  const filteredFriends = useMemo(() => {
    return friends.filter((friend) =>
      (friend.username || '').toLowerCase().includes(deferredSearch),
    );
  }, [friends, deferredSearch]);

  const handleStartChat = useCallback(async (friend: any) => {
    try {
      const existingRoom = rooms.find(
        (room) =>
          room.name === null &&
          (((room as any).members_count ?? (room as any).members?.length) === 2) &&
          (room as any).members?.some((m: any) => m.id === friend.id),
      );

      if (existingRoom) {
        markRoomAsRead(existingRoom.id);
        setCurrentRoomId(existingRoom.id);
        setTab('chats');
        onRoomSelected?.();
        return;
      }

      const newRoom = await roomsApi.createRoom({
        name: null,
        members: [friend.id],
      });

      setRooms([...rooms, newRoom]);
      setCurrentRoomId(newRoom.id);
      setTab('chats');
      onRoomSelected?.();
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  }, [rooms, markRoomAsRead, setCurrentRoomId, setTab, onRoomSelected, setRooms]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const acceptedRequest = pendingRequests.find((request) => request.id === requestId);
      await friendsApi.acceptRequest(requestId);

      setPendingRequests(pendingRequests.filter((request) => request.id !== requestId));

      if (acceptedRequest?.sender) {
        setFriends([...friends.filter((f) => f.id !== acceptedRequest.sender.id), acceptedRequest.sender]);
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await friendsApi.rejectRequest(requestId);
      setPendingRequests(pendingRequests.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };


  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {pendingRequests.length > 0 && (
          <div className="p-3 border-b border-blue-100/50 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setShowRequests(!showRequests)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-slate-700/80 rounded-2xl border border-blue-100 dark:border-slate-700 transition shadow-sm group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-xl group-hover:scale-110 transition-transform shadow-inner">
                📬
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Lời mời kết bạn</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">Bạn có {pendingRequests.length} yêu cầu đang chờ</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md group-hover:rotate-12 transition-transform">
                {pendingRequests.length}
              </div>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredFriends.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No friends yet</div>
          ) : (
            filteredFriends.map((friend) => (
              <FriendItem
                key={friend.id}
                friend={friend}
                onStartChat={handleStartChat}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRequests && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRequests(false)}
              className="absolute inset-0 bg-black/55 shadow-2xl backdrop-blur-[2px]"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/90">
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Lời mời kết bạn ({pendingRequests.length})
                </h3>
                <button
                  onClick={() => setShowRequests(false)}
                  className="rounded-full p-1 transition hover:bg-blue-100 dark:hover:bg-slate-700"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-slate-300" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {pendingRequests.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">
                    Không có lời mời kết bạn mới
                  </div>
                ) : (
                  pendingRequests.map((req) => (
                    <div key={req.id} className="border-b border-blue-100 p-3 text-sm last:border-b-0 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-slate-100">{req.sender.username}</p>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => handleAcceptRequest(req.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-green-50 dark:hover:bg-green-900/30 group/btn"
                            title="Accept"
                          >
                            <Check className="h-5 w-5 text-green-600 group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-red-50 dark:hover:bg-red-900/30 group/btn"
                            title="Reject"
                          >
                            <X className="h-5 w-5 text-red-600 group-hover/btn:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>
                      <p className="truncate text-xs text-gray-600 dark:text-slate-400">{req.sender.email}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
