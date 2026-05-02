'use client';

import { useEffect, useRef, useState, UIEvent, useMemo, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { roomsApi, friendsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import dynamic from 'next/dynamic';
import { Search, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomItem } from './RoomItem';
import { FriendItem } from './FriendItem';
import { useRoomListSocket } from '@/hooks/useRoomListSocket';

const CreateGroupModal = dynamic(() => import('./CreateGroupModal').then(mod => mod.CreateGroupModal), { ssr: false });
const AddFriendModal = dynamic(() => import('./AddFriendModal').then(mod => mod.AddFriendModal), { ssr: false });

const IMAGE_UPLOAD_REGEX = /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i;
const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;

interface RoomListProps {
  onRoomSelected?: () => void;
}

export function RoomList({ onRoomSelected }: RoomListProps) {
  const CHAT_PAGE_SIZE = 10;
  const rooms = useChatStore(s => s.rooms);
  const setRooms = useChatStore(s => s.setRooms);
  const currentRoomId = useChatStore(s => s.currentRoomId);
  const setCurrentRoomId = useChatStore(s => s.setCurrentRoomId);
  const markRoomAsRead = useChatStore(s => s.markRoomAsRead);
  const clearedAtByRoom = useChatStore(s => s.clearedAtByRoom);
  const setClearedAt = useChatStore(s => s.setClearedAt);
  const user = useAuthStore(s => s.user);
  const requestConfirm = useUiStore((state) => state.requestConfirm);
  const showToast = useUiStore((state) => state.showToast);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [tab, setTab] = useState<'chats' | 'friends'>('chats');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [visibleRoomCount, setVisibleRoomCount] = useState(CHAT_PAGE_SIZE);
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const joinedRoomIdsRef = useRef<Set<string>>(new Set());

  const getLastMessagePreview = (
    room: {
      members?: Array<{ id: string; username?: string }>;
      last_message?: { content?: string; sender_id?: string; sender_name?: string; type?: string };
    },
  ) => {
    const content = room?.last_message?.content || '';
    const type = room?.last_message?.type || 'text';
    const senderId = room?.last_message?.sender_id;
    const deletedAt = (room?.last_message as any)?.deleted_at;
    const senderNameFromRoom =
      room?.last_message?.sender_name ||
      room?.members?.find((member) => member.id === senderId)?.username;

    if (deletedAt) {
      return senderId === user?.id ? 'Bạn đã xóa tin nhắn' : 'Tin nhắn đã bị xóa';
    }

    if (!content && type === 'text') {
      return room?.last_message ? '' : 'Chưa có tin nhắn';
    }

    let previewText = content;

    if (type === 'image') previewText = '[Hình ảnh]';
    else if (type === 'album') previewText = '[Album ảnh]';
    else if (type === 'voice') previewText = '[Tin nhắn thoại]';
    else if (type === 'location') previewText = '[Vị trí]';
    else if (type === 'video') previewText = '[Video]';
    else {
      // Fallback detection for legacy data
      const isImageContent =
        content.startsWith('data:image/') ||
        IMAGE_UPLOAD_REGEX.test(content) ||
        IMAGE_EXT_REGEX.test(content);
      if (isImageContent) previewText = '[Hình ảnh]';
    }

    if (type === 'call' || content.startsWith('CALL_LOG:')) {
      const duration = parseInt(content.split(':').pop() || '0');
      const isMe = senderId && senderId === user?.id;
      if (duration === 0) return 'Cuộc gọi nhỡ';
      return isMe ? 'Cuộc gọi đi' : 'Cuộc gọi đến';
    }

    if (senderId && senderId === user?.id) return `Bạn: ${previewText}`;
    if (senderNameFromRoom) return `${senderNameFromRoom}: ${previewText}`;

    return previewText;
  };

  const getRoomDisplayName = useCallback((room: any) => {
    if (room?.is_group_chat) {
      return room?.name || 'Group Chat';
    }

    const otherUser = room?.members?.find((member: any) => member.id !== user?.id);
    return otherUser?.username || room?.name || 'Direct Message';
  }, [user?.id]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [roomsData, requestsData, friendsData] = await Promise.all([
          roomsApi.getRooms().catch((e) => { console.error('Failed to fetch rooms:', e); return []; }),
          friendsApi.getPending().catch((e) => { console.error('Failed to fetch requests:', e); return []; }),
          friendsApi.getFriendList().catch((e) => { console.error('Failed to fetch friends:', e); return []; })
        ]);

        setRooms(roomsData);
        roomsData.forEach((room: any) => {
          if (room.cleared_at) {
            setClearedAt(String(room.id), new Date(room.cleared_at).getTime());
          }
        });

        setPendingRequests(requestsData as any);
        setFriends(friendsData as any);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [setRooms, setClearedAt]);

  const handleSelectRoom = useCallback((roomId: string) => {
    markRoomAsRead(roomId);
    setCurrentRoomId(roomId);
    onRoomSelected?.();
  }, [markRoomAsRead, setCurrentRoomId, onRoomSelected]);

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



  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setVisibleRoomCount(CHAT_PAGE_SIZE);
  }, [debouncedSearch, tab]);

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        const nameMatch = getRoomDisplayName(room).toLowerCase().includes(debouncedSearch);
        if (!nameMatch) return false;
        if (chatFilter === 'unread') return !!(room as any).last_message?.is_unread_for_me;
        if (chatFilter === 'groups') return !!(room as any).is_group_chat;
        // In 'all' tab, hide rooms that have no active messages (empty or cleared)
        if (chatFilter === 'all') return !!(room as any).last_message;
        return true;
      })
      // Chats with messages first
      .sort((a: any, b: any) => {
        const aHasMsg = !!a?.last_message;
        const bHasMsg = !!b?.last_message;
        if (aHasMsg !== bHasMsg) return bHasMsg ? 1 : -1;

        const aTime = a?.last_message?.created_at
          ? new Date(a.last_message.created_at).getTime()
          : new Date(a.created_at).getTime();
        const bTime = b?.last_message?.created_at
          ? new Date(b.last_message.created_at).getTime()
          : new Date(b.created_at).getTime();

        return bTime - aTime;
      });
  }, [rooms, debouncedSearch, chatFilter, getRoomDisplayName]);

  const filteredFriends = useMemo(() => {
    return friends.filter((friend) =>
      (friend.username || '').toLowerCase().includes(debouncedSearch),
    );
  }, [friends, debouncedSearch]);

  const visibleRooms = filteredRooms.slice(0, visibleRoomCount);

  const handleChatListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (tab !== 'chats' || visibleRoomCount >= filteredRooms.length) return;

    const container = event.currentTarget;
    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceToBottom <= 80) {
      setVisibleRoomCount((prev) =>
        Math.min(prev + CHAT_PAGE_SIZE, filteredRooms.length),
      );
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const acceptedRequest = pendingRequests.find((request) => request.id === requestId);
      await friendsApi.acceptRequest(requestId);

      setPendingRequests((prev) => prev.filter((request) => request.id !== requestId));

      if (acceptedRequest?.sender) {
        setFriends((prev) => {
          const alreadyExists = prev.some((friend) => friend.id === acceptedRequest.sender.id);
          if (alreadyExists) return prev;
          return [acceptedRequest.sender, ...prev];
        });
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

  const handleStartChat = async (friend: any) => {
    try {
      // Check if room already exists
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

      // Create new direct message room
      const newRoom = await roomsApi.createRoom({
        name: null, // null means direct message
        members: [friend.id],
      });

      setRooms([...rooms, newRoom]);
      setCurrentRoomId(newRoom.id);
      setTab('chats');
      onRoomSelected?.();
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  const handleDeleteChat = useCallback(async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await requestConfirm({
      title: 'Xác nhận xóa',
      message: 'Bạn có chắc chắn muốn xóa lịch sử cuộc trò chuyện này không? Hành động này không thể hoàn tác ở phía bạn.',
      confirmText: 'Xóa trò chuyện',
      cancelText: 'Hủy',
    });
    if (!confirmed) return;
    try {
      await roomsApi.clearHistory(roomId);
      const clearedTs = Date.now();
      setClearedAt(roomId, clearedTs);

      setRooms((prev: any[]) =>
        prev
          .filter((r) => r.id !== roomId || r.is_group_chat)
          .map((r) => {
            if (r.id !== roomId) return r;
            return { ...r, last_message: null };
          }),
      );

      if (currentRoomId === roomId) {
        useChatStore.getState().setMessages([]);
      }
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      showToast('Không thể xóa lịch sử trò chuyện', 'error');
    }
  }, [requestConfirm, setClearedAt, setRooms, currentRoomId, showToast]);

  return (
    <div className="w-full md:w-[320px] bg-blue-50/70 border-r border-blue-100 flex flex-col h-full dark:bg-slate-900 dark:border-slate-700">
      {/* Header */}
      <div className="p-2 max-[480px]:p-2 border-b border-blue-100 dark:border-slate-700">
        {/* Search + quick actions */}
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
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
              <img src="/friend_add.svg" alt="Add friend" className="w-6 h-6 max-[420px]:w-4 max-[420px]:h-4 dark:invert" />
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
              <img src="/group-add.svg" alt="Create group" className="w-6 h-6 max-[420px]:w-4 max-[420px]:h-4 dark:invert" />
              <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 z-50 dark:bg-slate-700">
                Tạo nhóm
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 border-b border-blue-100 bg-blue-100/40 dark:border-slate-700 dark:bg-slate-800/40">
        <button
          onClick={() => setTab('chats')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'chats'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-blue-200 hover:text-blue-900 dark:text-slate-300 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          Trò chuyện
        </button>
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'friends'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-blue-200 hover:text-blue-900 dark:text-slate-300 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
          }`}
        >
          Bạn bè
          {pendingRequests.length > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>

      </div>
      
      {/* Sub-tabs for All/Unread */}
      {tab === 'chats' && (
        <div className="flex items-center gap-4 px-4 py-2 bg-blue-50/30 dark:bg-slate-900/40 border-b border-blue-100/50 dark:border-slate-800">
          <button
            onClick={() => setChatFilter('all')}
            className={`text-xs font-bold transition-colors ${
              chatFilter === 'all'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setChatFilter('unread')}
            className={`text-xs font-bold transition-colors flex items-center gap-1.5 ${
              chatFilter === 'unread'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            Chưa đọc
            {rooms.some(r => (r as any).last_message?.is_unread_for_me) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setChatFilter('groups')}
            className={`text-xs font-bold transition-colors ${
              chatFilter === 'groups'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            Nhóm
          </button>
        </div>
      )}

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto" onScroll={handleChatListScroll}>
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : tab === 'chats' ? (
          <>
            {filteredRooms.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No chats found</div>
            ) : (
              visibleRooms.map((room) => (
                  <RoomItem
                  key={room.id}
                  room={room}
                  currentRoomId={currentRoomId}
                  onSelect={handleSelectRoom}
                  onDeleteChat={handleDeleteChat}
                  getRoomDisplayName={getRoomDisplayName}
                  getLastMessagePreview={getLastMessagePreview}
                />
              ))
            )}
            {visibleRooms.length < filteredRooms.length && (
              <div className="py-2 text-center text-xs text-gray-400">Cuon de tai them...</div>
            )}
          </>
        ) : (
          <div className="flex flex-col h-full">
            {pendingRequests.length > 0 && (
              <div className="p-3 border-b border-blue-100/50 dark:border-slate-800">
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
            <div className="flex-1 overflow-y-auto">
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
        )}
       </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={() => setTab('chats')}
      />
      <AddFriendModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
      />

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
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
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
    </div>
  );
}

