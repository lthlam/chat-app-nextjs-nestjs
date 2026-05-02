import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';

interface UseRoomListSocketProps {
  userId?: string;
  currentRoomId: string | null;
  clearedAtByRoom: Map<string, number>;
  setRooms: (updater: any) => void;
  setClearedAt: (roomId: string, timestamp: number) => void;
  setFriends: (updater: any) => void;
  setPendingRequests: (updater: any) => void;
}

export function useRoomListSocket({
  userId,
  currentRoomId,
  clearedAtByRoom,
  setRooms,
  setClearedAt,
  setFriends,
  setPendingRequests
}: UseRoomListSocketProps) {
  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (message: any) => {
      const roomId = message?.room?.id || message?.roomId || message?.room_id;
      if (!roomId) return;

      const normalizedRoomId = String(roomId);
      const senderId = message?.sender?.id || message?.sender_id;
      const senderName = message?.sender?.username || message?.sender_name || 'User';

      setRooms((prevRooms: any[]) => {
        const roomExists = prevRooms.some((r: any) => String(r.id) === normalizedRoomId);

        if (roomExists) {
          const updatedRooms = prevRooms.map((room: any) => {
            if (String(room.id) !== normalizedRoomId) return room;
            const clearedAtMs = clearedAtByRoom.get(normalizedRoomId) ?? 0;
            const msgTs = new Date(message.created_at).getTime();
            const isCleared = clearedAtMs > 0 && msgTs <= clearedAtMs;
            return {
              ...room,
              last_message: {
                id: message.id,
                content: isCleared ? 'Tin nhắn không hiển thị' : message.content,
                type: isCleared ? 'text' : message.type,
                created_at: message.created_at,
                sender_id: senderId,
                sender_name: senderName,
                is_unread_for_me:
                  currentRoomId === normalizedRoomId ? false : String(senderId) !== String(userId),
              },
            };
          });

          return updatedRooms.sort((a: any, b: any) => {
            const aTime = a?.last_message?.created_at
              ? new Date(a.last_message.created_at).getTime()
              : new Date(a.created_at).getTime();
            const bTime = b?.last_message?.created_at
              ? new Date(b.last_message.created_at).getTime()
              : new Date(b.created_at).getTime();
            return bTime - aTime;
          });
        }

        // Room was cleared — fetch it back then prepend
        // Note: we'd need roomsApi here. Let's just return prevRooms for now or implement fetching.
        // Or wait, since we need roomsApi, we can import it directly.
        import('@/lib/api').then(({ roomsApi }) => {
          roomsApi.getRooms().then((freshRooms) => {
            const found = freshRooms.find((r: any) => String(r.id) === normalizedRoomId);
            if (found) {
              if (found.cleared_at) {
                setClearedAt(String(found.id), new Date(found.cleared_at).getTime());
              }
              setRooms((prev: any[]) => {
                const withoutDupe = prev.filter((r: any) => String(r.id) !== normalizedRoomId);
                return [found, ...withoutDupe].sort((a: any, b: any) => {
                  const aTime = a?.last_message?.created_at
                    ? new Date(a.last_message.created_at).getTime()
                    : new Date(a.created_at).getTime();
                  const bTime = b?.last_message?.created_at
                    ? new Date(b.last_message.created_at).getTime()
                    : new Date(b.created_at).getTime();
                  return bTime - aTime;
                });
              });
            }
          });
        });

        return prevRooms; // optimistic: keep unchanged until fetch completes
      });
    };

    const handleMessageUpdated = (message: any) => {
      const roomId = message?.room?.id || message?.roomId;
      if (!roomId) return;

      const normalizedRoomId = String(roomId);
      const clearedAtMs = clearedAtByRoom.get(normalizedRoomId) ?? 0;
      const msgTs = new Date(message.created_at).getTime();
      const isCleared = clearedAtMs > 0 && msgTs <= clearedAtMs;

      setRooms((prevRooms: any[]) =>
        prevRooms.map((room: any) => {
          if (String(room.id) !== normalizedRoomId) return room;
          if (room.last_message?.id && String(room.last_message.id) !== String(message.id)) return room;
          return {
            ...room,
            last_message: {
              ...room.last_message,
              id: message.id,
              content: isCleared ? 'Tin nhắn không hiển thị' : message.content,
              type: isCleared ? 'text' : message.type,
              deleted_at: message.deleted_at ?? null,
            },
          };
        }),
      );
    };

    const handleMessagesSeen = (payload: { roomId?: string; user?: { id?: string } }) => {
      const roomId = payload?.roomId;
      const seenByUserId = payload?.user?.id;
      if (!roomId || !seenByUserId) return;

      if (String(seenByUserId) === String(userId)) {
        setRooms((prevRooms: any[]) =>
          prevRooms.map((room: any) => {
            if (String(room.id) !== String(roomId)) return room;
            if (!room.last_message) return room;
            return {
              ...room,
              last_message: { ...room.last_message, is_unread_for_me: false },
            };
          }),
        );
      }
    };

    const handleRoomAdded = (payload: { room?: any }) => {
      const incomingRoom = payload?.room;
      if (!incomingRoom?.id) return;

      setRooms((prevRooms: any[]) => {
        const withoutSameRoom = prevRooms.filter(
          (room) => String(room.id) !== String(incomingRoom.id),
        );

        return [incomingRoom, ...withoutSameRoom].sort((a: any, b: any) => {
          const aTime = a?.last_message?.created_at
            ? new Date(a.last_message.created_at).getTime()
            : new Date(a.created_at).getTime();
          const bTime = b?.last_message?.created_at
            ? new Date(b.last_message.created_at).getTime()
            : new Date(b.created_at).getTime();

          return bTime - aTime;
        });
      });
    };

    const handleFriendRemoved = (payload: { friendId?: string }) => {
      if (!payload?.friendId) return;
      setFriends((prev: any[]) =>
        prev.filter((friend) => String(friend.id) !== String(payload.friendId)),
      );
    };

    const handleFriendRequestReceived = (payload: {
      requestId?: string;
      sender?: any;
      created_at?: string;
    }) => {
      if (!payload?.requestId || !payload?.sender?.id) return;

      setPendingRequests((prev: any[]) => {
        const exists = prev.some((request) => String(request.id) === String(payload.requestId));
        if (exists) return prev;

        const nextRequest = {
          id: payload.requestId,
          sender: payload.sender,
          created_at: payload.created_at,
          status: 'pending',
        };

        return [nextRequest, ...prev];
      });
    };

    const handleFriendRequestAccepted = (payload: {
      requestId?: string;
      friend?: any;
    }) => {
      const friend = payload?.friend;
      if (!friend?.id) return;

      setFriends((prev: any[]) => {
        const exists = prev.some((item) => String(item.id) === String(friend.id));
        if (exists) return prev;
        return [friend, ...prev];
      });

      if (payload?.requestId) {
        setPendingRequests((prev: any[]) =>
          prev.filter((request) => String(request.id) !== String(payload.requestId)),
        );
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-updated', handleMessageUpdated);
    socket.on('messages-seen', handleMessagesSeen);
    socket.on('room-added', handleRoomAdded);
    socket.on('friend-removed', handleFriendRemoved);
    socket.on('friend-request-received', handleFriendRequestReceived);
    socket.on('friend-request-accepted', handleFriendRequestAccepted);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('messages-seen', handleMessagesSeen);
      socket.off('room-added', handleRoomAdded);
      socket.off('friend-removed', handleFriendRemoved);
      socket.off('friend-request-received', handleFriendRequestReceived);
      socket.off('friend-request-accepted', handleFriendRequestAccepted);
    };
  }, [setRooms, userId, currentRoomId, clearedAtByRoom, setClearedAt, setFriends, setPendingRequests]);
}
