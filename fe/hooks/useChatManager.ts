import { useEffect, useState, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { messagesApi, Message } from '@/lib/api';

export function useChatManager(currentRoomId: string | null) {
  const PAGE_SIZE = 20;
  const setMessages = useChatStore(s => s.setMessages);
  const addMessage = useChatStore(s => s.addMessage);
  const setRooms = useChatStore(s => s.setRooms);
  const markRoomAsRead = useChatStore(s => s.markRoomAsRead);
  const setPinnedMessages = useChatStore(s => s.setPinnedMessages);

  const user = useAuthStore(s => s.user);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isLoadingNewer, setIsLoadingNewer] = useState(false);
  
  const [hasOlderMessages, _setHasOlderMessages] = useState(true);
  const [hasNewerMessages, _setHasNewerMessages] = useState(false);
  
  const [typingUsers, setTypingUsers] = useState<{ userId: string; username: string }[]>([]);

  const isMarkingSeenRef = useRef(false);
  const markSeenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPrependingMessagesRef = useRef(false);
  
  const isLoadingOlderRef = useRef(false);
  const isLoadingNewerRef = useRef(false);
  const hasOlderRef = useRef(true);
  const hasNewerRef = useRef(false);
  
  const olderCursorRef = useRef<string | undefined>(undefined);
  const newerCursorRef = useRef<string | undefined>(undefined);

  // Synchronous state + ref update wrappers
  const setHasOlderMessages = useCallback((val: boolean) => {
    _setHasOlderMessages(val);
    hasOlderRef.current = val;
  }, []);

  const setHasNewerMessages = useCallback((val: boolean) => {
    _setHasNewerMessages(val);
    hasNewerRef.current = val;
  }, []);

  const setOlderCursor = useCallback((val: string | undefined) => {
    olderCursorRef.current = val;
  }, []);

  const setNewerCursor = useCallback((val: string | undefined) => {
    newerCursorRef.current = val;
  }, []);

  const syncSeenState = useCallback(async () => {
    if (!currentRoomId || !user?.id || isMarkingSeenRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    const latestMessages = useChatStore.getState().messages;
    const hasUnreadIncoming = latestMessages.some(
      (message) =>
        message.sender.id !== user.id &&
        !(message.reads || []).some((read: any) => read.user?.id === user.id),
    );

    if (!hasUnreadIncoming) return;

    isMarkingSeenRef.current = true;
    try {
      const payload = await messagesApi.markRoomAsSeen(currentRoomId);
      markRoomAsRead(currentRoomId);
      if ((payload.updatedMessages || []).length > 0) {
        const currentClearedAt = useChatStore.getState().clearedAtByRoom;
        const clearedAtMs = currentClearedAt.get(String(currentRoomId)) ?? 0;
        const updatedMessages = payload.updatedMessages.map((m) => {
          if (clearedAtMs > 0) {
            const msgTs = new Date(m.created_at).getTime();
            if (msgTs <= clearedAtMs) {
              m.content = 'Tin nhắn không hiển thị';
              m.type = 'text';
            }
            if (m.reply_to) {
              const replyTs = new Date(m.reply_to.created_at).getTime();
              if (replyTs <= clearedAtMs) {
                m.reply_to.content = 'Tin nhắn không hiển thị';
                m.reply_to.type = 'text';
              }
            }
          }
          return m;
        });
        const updatedMap = new Map(updatedMessages.map((msg: any) => [msg.id, msg]));
        setMessages((prev) => prev.map((msg) => updatedMap.get(msg.id) || msg));
      }
    } catch (error) {
      console.error('Failed to mark room as seen:', error);
    } finally {
      isMarkingSeenRef.current = false;
    }
  }, [currentRoomId, markRoomAsRead, setMessages, user?.id]);

  const scheduleSyncSeenState = useCallback(() => {
    if (markSeenTimerRef.current) clearTimeout(markSeenTimerRef.current);
    markSeenTimerRef.current = setTimeout(() => syncSeenState(), 200);
  }, [syncSeenState]);

  // Initial Load
  useEffect(() => {
    if (!currentRoomId || !user?.id) return;
    
    const load = async () => {
      setIsLoading(true);
      try {
        const [msgRes, pinnedRes] = await Promise.all([
          messagesApi.getMessages(currentRoomId, PAGE_SIZE),
          messagesApi.getPinnedMessages(currentRoomId),
        ]);
        
        setMessages(msgRes.data);
        setPinnedMessages(pinnedRes);
        
        setOlderCursor(msgRes.pagination.olderCursor);
        setNewerCursor(msgRes.pagination.newerCursor);
        setHasOlderMessages(!!msgRes.pagination.olderCursor);
        setHasNewerMessages(false);

        getSocket().emit('join-room', { roomId: currentRoomId, userId: user.id });
        scheduleSyncSeenState();
      } catch (e) {
        console.error('Load failed', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentRoomId, user?.id, setMessages, scheduleSyncSeenState, setHasOlderMessages, setHasNewerMessages, setOlderCursor, setNewerCursor, setPinnedMessages]);

  const loadOlder = async (containerScrollHeight: number, containerScrollTop: number) => {
    if (!currentRoomId || isLoading || isLoadingOlderRef.current || !hasOlderRef.current) return null;
    
    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);
    if (!olderCursorRef.current) {
      console.warn('[loadOlder] Missing older cursor, skipping load');
      return null;
    }

    try {
      const res = await messagesApi.getMessages(currentRoomId, PAGE_SIZE, olderCursorRef.current);
      if (res.data.length === 0) { 
        setHasOlderMessages(false); 
        return null; 
      }
      
      isPrependingMessagesRef.current = true;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = res.data.filter(m => !existingIds.has(m.id));
        return [...newMsgs, ...prev];
      });
      
      setOlderCursor(res.pagination.olderCursor);
      setHasOlderMessages(!!res.pagination.olderCursor);
      
      return { prevH: containerScrollHeight, prevT: containerScrollTop };
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setIsLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  };

  const loadNewer = async (containerScrollHeight: number, containerScrollTop: number) => {
    if (!currentRoomId || isLoading || isLoadingNewerRef.current || !hasNewerRef.current) return null;

    isLoadingNewerRef.current = true;
    setIsLoadingNewer(true);
    if (!newerCursorRef.current) {
      console.warn('[loadNewer] Missing newer cursor, skipping load');
      return null;
    }

    try {
      const res = await messagesApi.getMessages(currentRoomId, PAGE_SIZE, undefined, newerCursorRef.current);
      
      if (res.data.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = res.data.filter(m => !existingIds.has(m.id));
          return [...prev, ...newMsgs];
        });
        setNewerCursor(res.pagination.newerCursor);
      }
      
      setHasNewerMessages(res.data.length === PAGE_SIZE && !!res.pagination.newerCursor);
      
      return { prevH: containerScrollHeight, prevT: containerScrollTop };
    } catch (error) {
      console.error('Load newer failed', error);
      return null;
    } finally {
      setIsLoadingNewer(false);
      isLoadingNewerRef.current = false;
    }
  };

  // Socket Events
  useEffect(() => {
    if (!currentRoomId) return;
    const socket = getSocket();
    
    const idxRoom = (id: string) => useChatStore.getState().rooms.findIndex(r => r.id === id);
    const updateRoomLastMsg = (rid: string, m: Message) => {
      setRooms(prev => prev.map(r => r.id === rid ? {
        ...r, 
        last_message: {
          content: m.content, 
          created_at: m.created_at, 
          sender_id: m.sender.id, 
          sender_name: m.sender.username,
          type: m.type,
          is_unread_for_me: m.sender.id !== user?.id
        }
      } : r).sort((a,b) => new Date(b.last_message?.created_at || 0).getTime() - new Date(a.last_message?.created_at || 0).getTime()));
    };

    const scrubMessage = (m: Message, rid: string) => {
      const currentClearedAt = useChatStore.getState().clearedAtByRoom;
      const clearedAtMs = currentClearedAt.get(String(rid)) ?? 0;
      if (clearedAtMs <= 0) return m;

      const msgTs = new Date(m.created_at).getTime();
      // Scrub main content
      if (msgTs <= clearedAtMs) {
        m.content = 'Tin nhắn không hiển thị';
        m.type = 'text';
      }
      // Scrub reply_to
      if (m.reply_to) {
        const replyTs = new Date(m.reply_to.created_at).getTime();
        if (replyTs <= clearedAtMs) {
          m.reply_to.content = 'Tin nhắn không hiển thị';
          m.reply_to.type = 'text';
        }
      }
      return m;
    };

    const handleNew = (m: Message) => {
      const rid = (m as any).room?.id || (m as any).roomId || (m as any).room_id;
      scrubMessage(m, String(rid));

      if (rid === currentRoomId) {
        if (!hasNewerRef.current) {
          addMessage(m);
          setNewerCursor(m.id);
        } else {
          setHasNewerMessages(true);
        }
        if (m.sender.id !== user?.id) scheduleSyncSeenState();
      }
      if (idxRoom(rid) !== -1) updateRoomLastMsg(rid, m);
    };



    const handleReactionUpdated = (m: Message) => {
      const rid = (m as any).room?.id || (m as any).roomId || (m as any).room_id || currentRoomId;
      if (rid) scrubMessage(m, String(rid));
      setMessages(prev => prev.map(mm => mm.id === m.id ? m : mm));
      setPinnedMessages(prev => prev.map(p => p.id === m.id ? m : p));
    };

    const handleMessageUpdated = (m: Message) => {
      const rid = (m as any).room?.id || (m as any).roomId || (m as any).room_id || currentRoomId;
      if (rid) scrubMessage(m, String(rid));

      // 1. Update the message itself + all messages that reply to it
      setMessages(prev => prev.map(mm => {
        const base = mm.id === m.id ? m : mm;
        if (base.reply_to?.id === m.id) {
          return { ...base, reply_to: m };
        }
        return base;
      }));
      
      // 2. Update Pinned list + its references
      setPinnedMessages(prev => {
        const isPinned = !!m.is_pinned;
        const exists = prev.find(p => p.id === m.id);
        
        let newList = prev;
        if (isPinned && !exists) newList = [m, ...prev];
        else if (!isPinned && exists) newList = prev.filter(p => p.id !== m.id);
        else if (isPinned && exists) newList = prev.map(p => p.id === m.id ? m : p);

        // Also update reply_to references in pinned list
        return newList.map(p => {
          if (p.reply_to?.id === m.id) {
            return { ...p, reply_to: m };
          }
          return p;
        });
      });
    };

    const handleMessageDeleted = (payload: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== payload.messageId));
      setPinnedMessages(prev => prev.filter(m => m.id !== payload.messageId));
    };

    const handleMessagesSeen = (p: { roomId: string; updatedMessages: Message[] }) => {
      if (p.roomId === currentRoomId) {
        markRoomAsRead(p.roomId);
        const scrubbed = p.updatedMessages.map(m => scrubMessage(m, p.roomId));
        const map = new Map(scrubbed.map(m => [m.id, m]));
        setMessages(prev => prev.map(m => map.get(m.id) || m));
      }
    };

    socket.on('new-message', handleNew);
    socket.on('reaction-updated', handleReactionUpdated);
    socket.on('message-updated', handleMessageUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('messages-seen', handleMessagesSeen);

    return () => {
      socket.off('new-message', handleNew);
      socket.off('reaction-updated', handleReactionUpdated);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('messages-seen', handleMessagesSeen);
    };
  }, [currentRoomId, addMessage, setMessages, setRooms, user?.id, markRoomAsRead, scheduleSyncSeenState, setHasNewerMessages, setNewerCursor, setPinnedMessages]);

  // Typing logic
  useEffect(() => {
    if (!currentRoomId) return;
    const socket = getSocket();
    const onT = (d: { userId: string; username: string }) => setTypingUsers(prev => prev.find(u => u.userId === d.userId) ? prev : [...prev, d]);
    const onST = (d: { userId: string }) => setTypingUsers(prev => prev.filter(u => u.userId !== d.userId));
    socket.on('user-typing', onT);
    socket.on('user-stopped-typing', onST);
    return () => { socket.off('user-typing', onT); socket.off('user-stopped-typing', onST); };
  }, [currentRoomId]);

  const loadLatest = useCallback(async () => {
    if (!currentRoomId || !user?.id) return;
    setIsLoading(true);
    try {
      const msgRes = await messagesApi.getMessages(currentRoomId, PAGE_SIZE);
      setMessages(msgRes.data);
      setOlderCursor(msgRes.pagination.olderCursor);
      setNewerCursor(msgRes.pagination.newerCursor);
      setHasOlderMessages(!!msgRes.pagination.olderCursor);
      setHasNewerMessages(false);
      scheduleSyncSeenState();
    } catch (e) {
      console.error('Jump to latest failed', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentRoomId, user?.id, setMessages, setHasOlderMessages, setHasNewerMessages, setOlderCursor, setNewerCursor, scheduleSyncSeenState]);

  return {
    isLoading,
    isLoadingOlder,
    isLoadingNewer,
    hasOlderMessages,
    hasNewerMessages,
    typingUsers,
    isPrependingMessagesRef,
    loadOlder,
    loadNewer,
    loadLatest,
    scheduleSyncSeenState,
    setIsLoading,
    setOlderCursor,
    setNewerCursor,
    setHasOlderMessages,
    setHasNewerMessages
  };
}
