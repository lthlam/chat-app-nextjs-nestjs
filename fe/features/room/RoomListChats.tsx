'use client';

import { UIEvent, useMemo, useState, useEffect, useCallback } from 'react';
import { useRoomList } from './RoomListContext';
import { useChatStore } from '@/store/chatStore';
import { RoomItem } from './RoomItem';
import { roomsApi } from '@/lib/api';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';

const CHAT_PAGE_SIZE = 10;
const IMAGE_UPLOAD_REGEX = /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i;
const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;

export function RoomListChats() {
  const { tab, debouncedSearch, chatFilter, isLoading, onRoomSelected, getRoomDisplayName } = useRoomList();
  const rooms = useChatStore(s => s.rooms);
  const setRooms = useChatStore(s => s.setRooms);
  const currentRoomId = useChatStore(s => s.currentRoomId);
  const setCurrentRoomId = useChatStore(s => s.setCurrentRoomId);
  const markRoomAsRead = useChatStore(s => s.markRoomAsRead);
  const setClearedAt = useChatStore(s => s.setClearedAt);
  const user = useAuthStore(s => s.user);
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const showToast = useUiStore(s => s.showToast);
  
  const [visibleRoomCount, setVisibleRoomCount] = useState(CHAT_PAGE_SIZE);

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
        if (chatFilter === 'all') return !!(room as any).last_message;
        return true;
      })
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

  const handleSelectRoom = useCallback((roomId: string) => {
    markRoomAsRead(roomId);
    setCurrentRoomId(roomId);
    onRoomSelected?.();
  }, [markRoomAsRead, setCurrentRoomId, onRoomSelected]);

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

  if (tab !== 'chats') return null;

  return (
    <div className="flex-1 overflow-y-auto" onScroll={handleChatListScroll}>
      {isLoading ? (
        <div className="p-4 text-center text-gray-500">Loading...</div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">No chats found</div>
      ) : (
        <>
          {visibleRooms.map((room) => (
            <RoomItem
              key={room.id}
              room={room}
              currentRoomId={currentRoomId}
              onSelect={handleSelectRoom}
              onDeleteChat={handleDeleteChat}
              getRoomDisplayName={getRoomDisplayName}
              getLastMessagePreview={getLastMessagePreview}
            />
          ))}
          {visibleRooms.length < filteredRooms.length && (
            <div className="py-2 text-center text-xs text-gray-400">Cuộn để tải thêm...</div>
          )}
        </>
      )}
    </div>
  );
}
