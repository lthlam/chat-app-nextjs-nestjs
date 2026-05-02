'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { useRoomListSocket } from '@/hooks/useRoomListSocket';
import { useRooms } from '@/hooks/useRooms';
import { useFriends } from '@/hooks/useFriends';
import { usePendingRequests } from '@/hooks/usePendingRequests';
import { RoomListProvider } from './RoomListContext';
import { RoomListHeader, RoomListTabs, RoomListSubTabs } from './RoomListParts';
import { RoomListChats } from './RoomListChats';
import { RoomListFriends } from './RoomListFriends';
import { useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RoomListProps {
  onRoomSelected?: () => void;
}

export function RoomList({ onRoomSelected }: RoomListProps) {
  const rooms = useChatStore(s => s.rooms);
  const setRooms = useChatStore(s => s.setRooms);
  const currentRoomId = useChatStore(s => s.currentRoomId);
  const clearedAtByRoom = useChatStore(s => s.clearedAtByRoom);
  const setClearedAt = useChatStore(s => s.setClearedAt);
  const user = useAuthStore(s => s.user);

  const { roomsData, isLoadingRooms } = useRooms();
  const { friendsData, isLoadingFriends } = useFriends();
  const { pendingRequestsData, isLoadingPending } = usePendingRequests();

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [showRequests, setShowRequests] = useState(false);
  const [tab, setTab] = useState<'chats' | 'friends'>('chats');
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const joinedRoomIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (roomsData.length > 0) {
      setRooms(roomsData);
      roomsData.forEach((room: any) => {
        if (room.cleared_at) {
          setClearedAt(String(room.id), new Date(room.cleared_at).getTime());
        }
      });
    }
  }, [roomsData, setRooms, setClearedAt]);

  useEffect(() => {
    if (friendsData.length > 0) setFriends(friendsData);
  }, [friendsData, setFriends]);

  useEffect(() => {
    if (pendingRequestsData.length > 0) setPendingRequests(pendingRequestsData);
  }, [pendingRequestsData, setPendingRequests]);

  const isLoading = isLoadingRooms || isLoadingFriends || isLoadingPending;

  useRoomListSocket({
    userId: user?.id,
    currentRoomId,
    clearedAtByRoom,
    setRooms,
    setClearedAt,
    setFriends,
    setPendingRequests
  });

  useEffect(() => {
    joinedRoomIdsRef.current.clear();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || rooms.length === 0) return;

    const socket = getSocket();
    const roomIds = rooms.map((room) => String(room.id));
    const joinRoom = (roomId: string) => {
      if (joinedRoomIdsRef.current.has(roomId)) return;
      socket.emit('join-room', { roomId, userId: user.id });
      joinedRoomIdsRef.current.add(roomId);
    };

    roomIds.forEach(joinRoom);

    const joinAllRooms = () => {
      joinedRoomIdsRef.current.clear();
      roomIds.forEach(joinRoom);
    };

    socket.on('connect', joinAllRooms);

    return () => {
      socket.off('connect', joinAllRooms);
    };
  }, [rooms, user?.id]);

  const getRoomDisplayName = useCallback((room: any) => {
    if (room?.is_group_chat) {
      return room?.name || 'Group Chat';
    }

    const otherUser = room?.members?.find((member: any) => member.id !== user?.id);
    return otherUser?.username || room?.name || 'Direct Message';
  }, [user?.id]);

  const contextValue = {
    search, setSearch,
    deferredSearch,
    tab, setTab,
    chatFilter, setChatFilter,
    showRequests, setShowRequests,
    friends, setFriends,
    pendingRequests, setPendingRequests,
    isLoading,
    onRoomSelected,
    getRoomDisplayName
  };

  return (
    <RoomListProvider value={contextValue}>
      <div className="w-full md:w-[320px] bg-blue-50/70 border-r border-blue-100 flex flex-col h-full dark:bg-slate-900 dark:border-slate-700">
        <RoomListHeader />
        <RoomListTabs />
        <RoomListSubTabs />
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {tab === 'chats' ? (
              <motion.div
                key="chats"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col"
              >
                <RoomListChats />
              </motion.div>
            ) : (
              <motion.div
                key="friends"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col"
              >
                <RoomListFriends />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </RoomListProvider>
  );
}

