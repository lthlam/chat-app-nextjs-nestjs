'use client';

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { messagesApi, Message } from '@/lib/api';
import { useUiStore } from '@/store/uiStore';
import { MessageItem } from '@/features/chat/MessageItem';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import dynamic from 'next/dynamic';
import { ChevronsDown } from 'lucide-react';

const MessageSearchBar = dynamic(() => import('@/features/search/MessageSearchBar').then(mod => mod.MessageSearchBar), { ssr: false });
const PinnedMessagesList = dynamic(() => import('@/features/room/PinnedMessagesList').then(mod => mod.PinnedMessagesList), { ssr: false });
const ForwardModal = dynamic(() => import('@/features/room/ForwardModal').then(mod => mod.ForwardModal), { ssr: false });
import { useChatManager } from '@/hooks/useChatManager';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { useRoomMembers } from '@/hooks/useRoomMembers';

export function ChatMessages() {
  const REACTION_CLOSE_DELAY_MS = 650;
  
  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const rooms = useChatStore((s) => s.rooms);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const pendingJumpMessageId = useChatStore((s) => s.pendingJumpMessageId);
  const setPendingJumpMessageId = useChatStore((s) => s.setPendingJumpMessageId);
  const pinnedMessages = useChatStore((s) => s.pinnedMessages);
  const setPinnedMessages = useChatStore((s) => s.setPinnedMessages);
  const isSearchOpen = useChatStore((s) => s.isSearchOpen);
  const setIsSearchOpen = useChatStore((s) => s.setIsSearchOpen);

  const user = useAuthStore((s) => s.user);
  const blockedUsers = useAuthStore((s) => s.blockedUsers);
  const blockedByUsers = useAuthStore((s) => s.blockedByUsers);
  const currentRoom = rooms.find((r) => r.id === currentRoomId);
  const shouldFetchMembers = currentRoomId && !currentRoom?.is_group_chat;
  const { membersData: roomMembers } = useRoomMembers(shouldFetchMembers ? currentRoomId : null);

  const otherPerson = !currentRoom?.is_group_chat ? roomMembers.find((m) => m.id !== user?.id) : null;
  const isBlocked = Boolean(otherPerson && blockedUsers.includes(otherPerson.id));
  const isBlockedBy = Boolean(otherPerson && blockedByUsers.includes(otherPerson.id));
  const isAnyBlocked = isBlocked || isBlockedBy;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isJumpingRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const previousMessageCountRef = useRef(0);
  
  // UI States
  // UI States (moved to store for performance)
  const setReactionPickerFor = useUiStore(s => s.setReactionPickerFor);
  const setActiveActionMenuMessageId = useUiStore(s => s.setActiveActionMenuMessageId);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  
  const showToast = useUiStore((state) => state.showToast);

  // Timers
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const {
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
    setIsLoading,
    setOlderCursor,
    setNewerCursor,
    setHasOlderMessages,
    setHasNewerMessages
  } = useChatManager(currentRoomId);

  const handleJumpToMessage = useCallback(async (targetMessageId?: string) => {
    if (!targetMessageId || !currentRoomId) return;

    // 1. Check if message exists in current store or pinned list and if it's hidden
    const currentState = useChatStore.getState();
    const existingMsg = currentState.messages.find(m => m.id === targetMessageId) 
                     || currentState.pinnedMessages.find(m => m.id === targetMessageId);
    
    if (existingMsg && existingMsg.content === 'Tin nhắn không hiển thị') {
      showToast('Tin nhắn không hiển thị', 'error');
      return;
    }

    let targetNode = document.querySelector(`[data-message-id="${targetMessageId}"]`);
    
    // If not in DOM, load it
    if (!targetNode) {
      setIsLoading(true);
      isJumpingRef.current = true;
      try {
        const res = await messagesApi.getMessagesAround(currentRoomId, targetMessageId, 20);
        
        // 2. Check if the target message we just fetched is hidden or missing
        const targetInRes = res.data.find((m: any) => m.id === targetMessageId);
        if (!targetInRes || targetInRes.content === 'Tin nhắn không hiển thị') {
          showToast('Tin nhắn không hiển thị', 'error');
          setIsLoading(false);
          isJumpingRef.current = false;
          return;
        }

        setMessages(res.data);
        setOlderCursor(res.pagination.olderCursor);
        setNewerCursor(res.pagination.newerCursor);
        setHasOlderMessages(res.pagination.hasOlder);
        setHasNewerMessages(res.pagination.hasNewer);

        // Crucial: Wait for the loading state to be processed by React and hidden in DOM
        setIsLoading(false);
        
        // Wait for DOM to render the new messages
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 150));
          targetNode = document.querySelector(`[data-message-id="${targetMessageId}"]`);
          if (targetNode) break;
        }
      } catch (e: any) {
        console.error('Failed to jump to message:', e);
        const errorMsg = e.response?.data?.message || 'Tin nhắn không hiển thị';
        showToast(errorMsg, 'error');
        setIsLoading(false);
        isJumpingRef.current = false;
        return;
      }
    }

    if (!targetNode) {
      console.warn('[JUMP] Target node still not found after loading');
      isJumpingRef.current = false;
      return; 
    }

    // Perform scroll and highlight
    const container = messagesContainerRef.current;
    if (container && targetNode instanceof HTMLElement) {
      // Small delay to ensure layout has settled (especially if images are being tracked)
      setTimeout(() => {
        if (targetNode instanceof HTMLElement) {
          container.scrollTo({ top: targetNode.offsetTop - 20, behavior: 'auto' });
          setHighlightedMessageId(targetMessageId);
          
          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
          highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 5000);
        }
      }, 50);
    }
    
    // Release the jumping lock after a delay to allow UI to settle
    setTimeout(() => {
      isJumpingRef.current = false;
    }, 1500); 
  }, [currentRoomId, setMessages, showToast, setIsLoading, setOlderCursor, setNewerCursor, setHasOlderMessages, setHasNewerMessages]);



  const {
    searchQuery, setSearchQuery,
    deferredSearchQuery,
    searchResults, setSearchResults,
    activeSearchResultIndex,
    isPinnedListOpen, setIsPinnedListOpen,
    navigateSearchResult,
  } = useMessageSearch(currentRoomId, handleJumpToMessage);

  const shouldJumpToLatest = useChatStore(s => s.shouldJumpToLatest);
  const setShouldJumpToLatest = useChatStore(s => s.setShouldJumpToLatest);

  useEffect(() => {
    if (shouldJumpToLatest) {
      const doJump = async () => {
        if (hasNewerMessages) {
          await loadLatest();
        }
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          setShouldJumpToLatest(false);
        }, 150);
      };
      doJump();
    }
  }, [shouldJumpToLatest, hasNewerMessages, loadLatest, setShouldJumpToLatest]);

  const lastJumpIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingJumpMessageId) return;
    if (lastJumpIdRef.current === pendingJumpMessageId) return;
    lastJumpIdRef.current = pendingJumpMessageId;

    const doGlobalJump = async () => {
      // Wait for useChatManager to finish initial load if it's currently loading
      let checkCount = 0;
      while (isLoading && checkCount < 30) {
        await new Promise(r => setTimeout(r, 200));
        checkCount++;
      }

      await handleJumpToMessage(pendingJumpMessageId);
      setPendingJumpMessageId(null);
    };

    doGlobalJump();
  }, [pendingJumpMessageId, isLoading, handleJumpToMessage, setPendingJumpMessageId]);

  const renderTextWithLinks = (text: string, baseKey: string | number) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      const uniqueKey = `${baseKey}-link-${i}`;
      if (part.match(urlRegex)) {
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a
            key={uniqueKey}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-inherit underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return <React.Fragment key={uniqueKey}>{part}</React.Fragment>;
    });
  };

  const renderHighlightedText = useCallback((text: string, shouldHighlight: boolean, mentions?: any[]) => {
    let resultNodes: React.ReactNode[] = [text];

    // Handle initial mentions formatting if we have them
    if (mentions && mentions.length > 0) {
      const mentionNames = mentions.map(m => m.username);
      resultNodes = [];
      const parts = text.split(new RegExp(`(@(?:${mentionNames.map(escapeRegExp).join('|')}))\\b`, 'i'));
      parts.forEach((part, i) => {
        if (i % 2 === 1) { // this is a mention
          resultNodes.push(
            <span 
              key={`mention-${i}`} 
              className="font-bold text-blue-700 dark:text-blue-300 bg-blue-200/40 dark:bg-blue-800/40 px-1.5 py-0.5 rounded-md border border-blue-300/30 dark:border-blue-600/30 transition hover:bg-blue-300/40 dark:hover:bg-blue-700/50 cursor-default"
            >
              {part}
            </span>
          );
        } else if (part) {
          resultNodes.push(part);
        }
      });
    }

    const keyword = deferredSearchQuery.trim();
    if (!keyword || !shouldHighlight) {
      // Just render links inside the text nodes
      return <>{resultNodes.map((node, i) => 
        typeof node === 'string' ? renderTextWithLinks(node, `base-${i}`) : node
      )}</>;
    }

    const unaccentedKeyword = removeAccents(keyword);
    const regex = new RegExp(escapeRegExp(unaccentedKeyword), 'gi');

    return <>{resultNodes.map((node, nodeIdx) => {
      if (typeof node !== 'string') return node;

      const unaccentedText = removeAccents(node);
      if (!unaccentedText.includes(unaccentedKeyword)) {
        return renderTextWithLinks(node, `base-${nodeIdx}`);
      }

      const segments: (string | React.ReactNode)[] = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(unaccentedText)) !== null) {
        if (match.index > lastIndex) {
          segments.push(...(renderTextWithLinks(node.substring(lastIndex, match.index), `pre-${nodeIdx}-${match.index}`) as any));
        }
        const matchedText = node.substring(match.index, match.index + unaccentedKeyword.length);
        segments.push(
          <mark key={`mark-${nodeIdx}-${match.index}`} className="rounded bg-yellow-200 px-0.5 text-black">
            {matchedText}
          </mark>
        );
        lastIndex = match.index + unaccentedKeyword.length;
      }

      if (lastIndex < node.length) {
        segments.push(...(renderTextWithLinks(node.substring(lastIndex), `post-${nodeIdx}`) as any));
      }

      return <React.Fragment key={`frag-${nodeIdx}`}>{segments}</React.Fragment>;
    })}</>;
  }, [deferredSearchQuery]);

  // UI Actions
  const openActionMenu = useCallback((id: string) => {
    if (actionCloseTimerRef.current) clearTimeout(actionCloseTimerRef.current);
    setActiveActionMenuMessageId(id);
  }, [setActiveActionMenuMessageId]);

  const closeActionMenu = useCallback(() => {
    if (actionCloseTimerRef.current) clearTimeout(actionCloseTimerRef.current);
    if (reactionCloseTimerRef.current) clearTimeout(reactionCloseTimerRef.current);
    if (reactionOpenTimerRef.current) clearTimeout(reactionOpenTimerRef.current);
    setActiveActionMenuMessageId(null);
    setReactionPickerFor(null);
  }, [setActiveActionMenuMessageId, setReactionPickerFor]);

  const scheduleCloseActionMenu = useCallback((id: string) => {
    if (actionCloseTimerRef.current) clearTimeout(actionCloseTimerRef.current);
    actionCloseTimerRef.current = setTimeout(() => {
      setActiveActionMenuMessageId(curr => curr === id ? null : curr);
    }, 280);
  }, [setActiveActionMenuMessageId]);

  const openReactionPicker = useCallback((id: string) => {
    if (reactionCloseTimerRef.current) clearTimeout(reactionCloseTimerRef.current);
    if (reactionOpenTimerRef.current) clearTimeout(reactionOpenTimerRef.current);
    setReactionPickerFor(id);
  }, [setReactionPickerFor]);

  const scheduleOpenReactionPicker = useCallback((id: string) => {
    if (reactionCloseTimerRef.current) clearTimeout(reactionCloseTimerRef.current);
    if (reactionOpenTimerRef.current) clearTimeout(reactionOpenTimerRef.current);
    reactionOpenTimerRef.current = setTimeout(() => {
      setReactionPickerFor(id);
    }, 180);
  }, [setReactionPickerFor]);

  const scheduleCloseReactionPicker = useCallback((id: string) => {
    if (reactionOpenTimerRef.current) clearTimeout(reactionOpenTimerRef.current);
    if (reactionCloseTimerRef.current) clearTimeout(reactionCloseTimerRef.current);
    reactionCloseTimerRef.current = setTimeout(() => {
      setReactionPickerFor(curr => curr === id ? null : curr);
    }, REACTION_CLOSE_DELAY_MS);
  }, [setReactionPickerFor]);

  const handleReactionSelect = useCallback(async (id: string, emoji: string) => {
    try {
      const updatedMessage = await messagesApi.addReaction(id, emoji);
      setMessages((prev) => prev.map((m) => m.id === (updatedMessage as Message).id ? (updatedMessage as Message) : m));
      closeActionMenu();
      
      if (!notificationSoundRef.current) notificationSoundRef.current = new Audio('/notification.mp3');
      notificationSoundRef.current.play().catch(() => {});
    } catch (error) {
      console.error('Reaction failed:', error);
    }
  }, [setMessages, closeActionMenu]);

  const handleRemoveReaction = useCallback(async (messageId: string, reactionId: string) => {
    try {
      const updatedMessage: any = await messagesApi.removeReaction(reactionId);
      if (updatedMessage && updatedMessage.id) {
        setMessages((prev) => prev.map((m) => m.id === updatedMessage.id ? updatedMessage : m));
      }
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  }, [setMessages]);

  const handleTogglePin = useCallback(async (id: string, isPinned: boolean) => {
    try {
      if (isPinned) {
        await messagesApi.unpinMessage(id);
        setPinnedMessages(prev => prev.filter(p => p.id !== id));
      } else {
        await messagesApi.pinMessage(id);
        const msg = messages.find(m => m.id === id);
        if (msg) setPinnedMessages(prev => {
          const exists = prev.some(p => p.id === id);
          if (exists) return prev;
          return [{ ...msg, is_pinned: true }, ...prev];
        });
      }
      setMessages((prev) => prev.map((m) => m.id === id ? ({ ...m, is_pinned: !isPinned } as Message) : m));
      closeActionMenu();
    } catch (error) {
      console.error('Toggle pin failed:', error);
    }
  }, [messages, setMessages, setPinnedMessages, closeActionMenu]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await messagesApi.deleteMessage(id);
      setMessages((prev) => prev.map((m) => m.id === id ? ({ ...m, content: 'Tin nhắn này đã bị xoá', deleted_at: new Date().toISOString() } as Message) : m));
      closeActionMenu();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [setMessages, closeActionMenu]);

  const handleReply = useCallback((m: Message) => {
    setReplyingTo(m);
    closeActionMenu();
  }, [setReplyingTo, closeActionMenu]);

  const handleForward = useCallback((id: string) => {
    setForwardMessageId(id);
    closeActionMenu();
  }, [closeActionMenu]);

  // Scroll to bottom
  useEffect(() => {
    if (isPrependingMessagesRef.current) {
      isPrependingMessagesRef.current = false;
    } else if (shouldStickToBottomRef.current && !isJumpingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    previousMessageCountRef.current = messages.length;
  }, [messages, isPrependingMessagesRef]);

  const activeSearchId = activeSearchResultIndex >= 0 ? searchResults[activeSearchResultIndex]?.id : null;
  const pinnedMsgs = [...pinnedMessages].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());



  // Use native passive scroll listener for better performance (#8)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const c = container;
      const isNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight <= 100;
      shouldStickToBottomRef.current = isNearBottom;
      setShowScrollBottom(!isNearBottom && c.scrollTop < c.scrollHeight - c.clientHeight - 200);
      
      // Load older messages (scroll up)
      if (c.scrollTop <= 50 && !isLoadingOlder && hasOlderMessages && !isJumpingRef.current) {
        loadOlder(c.scrollHeight, c.scrollTop).then((res) => {
          if (res && messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - res.prevH + res.prevT;
          }
        });
      }
      
      // Load newer messages (scroll down)
      const isAtBottom = c.scrollHeight - c.scrollTop - c.clientHeight <= 30;
      if (isAtBottom && !isLoadingNewer && hasNewerMessages && !isJumpingRef.current) {
        loadNewer(c.scrollHeight, c.scrollTop).then((res) => {
          if (res && messagesContainerRef.current) {
            const newC = messagesContainerRef.current;
            newC.scrollTop = res.prevH - newC.clientHeight;
          }
        });
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingOlder, hasOlderMessages, isLoadingNewer, hasNewerMessages, loadOlder, loadNewer]);


  // Pre-compute latest own message id — avoids O(n²) .slice().every() per message
  const latestOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender?.id === user?.id) return messages[i].id;
    }
    return null;
  }, [messages, user?.id]);

  // Pre-compute message list content to avoid IIFE in JSX and O(n) work on every render
  const renderedMessages = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 font-medium">
          Đang tải đoạn chat…
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 italic">
          No messages yet. Say hi!
        </div>
      );
    }

    const lastSeenMessageIdByUser = new Map<string, { messageId: string; user: any }>();
    messages.forEach((msg) => {
      (msg.reads || []).forEach((read: any) => {
        if (read.user?.id && read.user.id !== user?.id) {
          lastSeenMessageIdByUser.set(read.user.id, { messageId: msg.id, user: read.user });
        }
      });
    });

    const lastSeenByUsers = new Map<string, any[]>();
    lastSeenMessageIdByUser.forEach((val) => {
      if (!lastSeenByUsers.has(val.messageId)) lastSeenByUsers.set(val.messageId, []);
      lastSeenByUsers.get(val.messageId)!.push(val.user);
    });

    const getDateLabel = (date: Date) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Hôm nay';
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) {
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return days[date.getDay()];
      }
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    let lastDateLabel = '';

    return messages.map((m, idx) => {
      const nextMsg = messages[idx + 1];
      const isSameAsNext = nextMsg && nextMsg.sender?.id === m.sender?.id;
      const timeDiffToNext = nextMsg 
        ? (new Date(nextMsg.created_at).getTime() - new Date(m.created_at).getTime()) / 1000 / 60 
        : Infinity;
      const hideTimestamp = isSameAsNext && timeDiffToNext < 5;


      const msgDate = new Date(m.created_at);
      const dateLabel = getDateLabel(msgDate);
      let showDateSeparator = false;
      if (dateLabel !== lastDateLabel) {
        showDateSeparator = true;
        lastDateLabel = dateLabel;
      }

      return (
        <React.Fragment key={m.id}>
          {showDateSeparator && (
            <div className="flex items-center justify-center py-2 my-1">
              <div className="px-3 py-0.5 rounded-full bg-gray-200/70 dark:bg-slate-700/70 text-[10px] font-semibold text-gray-500 dark:text-slate-400">
                {dateLabel}
              </div>
            </div>
          )}
          <MessageItem 
            message={m}
            currentUser={user}
            isLatestOwnMessage={m.id === latestOwnMessageId}
            lastSeenByUsers={lastSeenByUsers.get(m.id) || []}
            highlightedMessageId={highlightedMessageId}
            isActiveSearchTarget={m.id === activeSearchId}
            deferredSearchQuery={deferredSearchQuery}
            variant={hideTimestamp ? 'grouped' : 'default'}
            onJumpToMessage={handleJumpToMessage}
            onOpenActionMenu={openActionMenu}
            onScheduleCloseActionMenu={scheduleCloseActionMenu}
            onScheduleOpenReactionPicker={scheduleOpenReactionPicker}
            onScheduleCloseReactionPicker={scheduleCloseReactionPicker}
            onOpenReactionPicker={openReactionPicker}
            onReactionSelect={handleReactionSelect}
            onReply={handleReply}
            onDelete={handleDelete}
            onTogglePin={handleTogglePin}
            onRemoveReaction={handleRemoveReaction}
            onForward={handleForward}
            renderHighlightedText={renderHighlightedText}
          />
        </React.Fragment>
      );
    });
  }, [
    messages, 
    user, 
    isLoading, 
    latestOwnMessageId, 
    highlightedMessageId, 
    activeSearchId, 
    deferredSearchQuery, 
    handleJumpToMessage, 
    openActionMenu, 
    scheduleCloseActionMenu, 
    scheduleOpenReactionPicker, 
    scheduleCloseReactionPicker, 
    openReactionPicker, 
    handleReactionSelect, 
    handleReply, 
    handleDelete, 
    handleTogglePin, 
    handleRemoveReaction, 
    handleForward, 
    renderHighlightedText
  ]);


  if (!currentRoomId) {
    return <div className="flex-1 flex items-center justify-center text-gray-500"><p>Select a chat to start messaging</p></div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-gradient-to-b from-white to-blue-50/50 dark:from-slate-950 dark:to-slate-900 transition-colors duration-300">
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <MessageSearchBar 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              activeIndex={activeSearchResultIndex}
              onNavigate={navigateSearchResult}
              onExit={() => { 
                setSearchQuery(''); 
                setSearchResults([]); 
                setIsSearchOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PinnedMessagesList 
        pinnedMessages={pinnedMsgs}
        isOpen={isPinnedListOpen}
        setIsOpen={setIsPinnedListOpen}
        onJumpToMessage={handleJumpToMessage}
        onUnpin={(id) => handleTogglePin(id, true)}
      />

      <div
        ref={messagesContainerRef}
        className="flex-1 flex flex-col overflow-y-auto p-3 space-y-0.5 relative"
      >
        {!isLoading && messages.length > 0 && <div className="flex-1 min-h-0" />}
        {isLoadingOlder && <div className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest py-2 shrink-0">Đang tải lịch sử…</div>}
        
        {renderedMessages}

        {isAnyBlocked && (
          <div className="mx-auto my-4 max-w-[80%] rounded-2xl bg-slate-100/80 px-4 py-3 text-center backdrop-blur-sm dark:bg-slate-800/80">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {isBlocked 
                ? "Bạn đã chặn người dùng này. Bỏ chặn để gửi tin nhắn." 
                : "Bạn không thể gửi tin nhắn cho người dùng này do bị chặn."}
            </p>
          </div>
        )}

        {isLoadingNewer && <div className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest py-2">Đang tải tin nhắn mới hơn…</div>}
        
        <TypingIndicator typingUsers={typingUsers} />
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={async () => {
              if (hasNewerMessages) {
                await loadLatest();
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              } else {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }
              setShowScrollBottom(false);
            }}
            className="absolute bottom-4 right-8 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700"
            title="Nhảy tới tin nhắn mới nhất"
          >
            <ChevronsDown className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {forwardMessageId && (
        <ForwardModal
          isOpen={!!forwardMessageId}
          onClose={() => setForwardMessageId(null)}
          messageId={forwardMessageId}
        />
      )}
    </div>
  );
}
