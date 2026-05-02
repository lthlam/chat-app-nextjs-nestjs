'use client';

import { Message, User } from '@/lib/api';
import { Pin, Check, Forward } from 'lucide-react';
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import { MessageMediaPreview } from '@/features/chat/MessageMediaPreview';
import { MessageActionMenu } from '@/features/chat/MessageActionMenu';
import { Avatar } from '@/components/ui/Avatar';

interface MessageItemProps {
  message: Message;
  currentUser: User | null;
  isLatestOwnMessage: boolean;
  highlightedMessageId: string | null;

  isActiveSearchTarget: boolean;
  deferredSearchQuery: string;
  onJumpToMessage: (id: string) => void;
  onOpenActionMenu: (id: string) => void;
  onScheduleCloseActionMenu: (id: string) => void;
  onScheduleOpenReactionPicker: (id: string) => void;
  onScheduleCloseReactionPicker: (id: string) => void;
  onOpenReactionPicker: (id: string) => void;
  onReactionSelect: (id: string, emoji: string) => void;
  onReply: (message: Message) => void;
  onDelete: (id: string) => void;
  onForward?: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onRemoveReaction: (messageId: string, reactionId: string) => void;
  renderHighlightedText: (text: string, highlight: boolean, mentions?: any[]) => React.ReactNode;
  lastSeenByUsers?: User[];
}

const MessageItemBase = memo(function MessageItemBase({
  message,
  currentUser,
  isLatestOwnMessage,
  highlightedMessageId,

  isActiveSearchTarget,
  onJumpToMessage,
  onOpenActionMenu,
  onScheduleCloseActionMenu,
  onScheduleOpenReactionPicker,
  onScheduleCloseReactionPicker,
  onOpenReactionPicker,
  onReactionSelect,
  onReply,
  onDelete,
  onForward,
  onTogglePin,
  onRemoveReaction,
  renderHighlightedText,
  lastSeenByUsers = [],
  variant = 'default',
}: MessageItemProps & { variant?: 'default' | 'grouped' }) {
  const hideTimestamp = variant === 'grouped';
  const hideAvatar = variant === 'grouped';
  const activeActionMenuMessageId = useUiStore(s => s.activeActionMenuMessageId);
  const reactionPickerFor = useUiStore(s => s.reactionPickerFor);

  const isCurrentUser = currentUser?.id === message.sender.id;
  
  const isImageLikeContent = (content?: string) => {
    if (!content || typeof content !== 'string') return false;
    return (
      content.startsWith('data:image/') ||
      /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(content) ||
      /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(content)
    );
  };

  const isImageMessage = message.type === 'image' || isImageLikeContent(message.content);
  const isVideoMessage = message.type === 'video';
  const isAlbumMessage = message.type === 'album';
  const isMediaMessage = isImageMessage || isVideoMessage || isAlbumMessage;

  const formattedTime = (() => {
    const d = new Date(message.created_at);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (diffDays === 0) return time;
    if (diffDays === 1) return `Hôm qua ${time}`;
    if (diffDays < 7) {
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      return `${days[d.getDay()]} ${time}`;
    }
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${time}`;
  })();

  const setSelectedUserProfileUser = useChatStore(s => s.setSelectedUserProfileUser);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} gap-2 relative group`}
      style={{ zIndex: (activeActionMenuMessageId === message.id || reactionPickerFor === message.id) ? 200 : 'auto' }}
      data-message-id={message.id}
    >
      {!isCurrentUser && (
        <div 
          className="flex-shrink-0 relative w-8 max-[420px]:w-7 cursor-pointer hover:opacity-80 transition"
          onClick={() => setSelectedUserProfileUser(message.sender)}
        >
          {!hideAvatar && (
            <Avatar 
              src={message.sender.avatar_url} 
              name={message.sender.username} 
              size="sm" 
            />
          )}
        </div>
      )}

      <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} max-w-[50%]`}>

        <div
          className={`${
            isMediaMessage
              ? 'p-0 bg-transparent shadow-none'
              : `px-3 py-1.5 rounded-xl ${message.type === 'text' ? 'break-words' : 'break-all'} whitespace-pre-wrap shadow-sm ${


                  isCurrentUser
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-purple-100 text-purple-900 rounded-bl-md border border-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-100'
                }`
          } cursor-context-menu relative ${message.deleted_at ? 'opacity-60 grayscale' : ''} ${
            highlightedMessageId === String(message.id)
              ? 'ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-[1.02] shadow-lg shadow-blue-500/20'
              : ''
          } transition duration-300 active:scale-[0.98] active:opacity-90`}
          onMouseEnter={() => onOpenActionMenu(message.id)}
          onMouseLeave={() => onScheduleCloseActionMenu(message.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onOpenActionMenu(message.id);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenActionMenu(message.id);
          }}
        >
          {message.is_pinned && (
            <div 
              className={`absolute -top-1.5 ${isCurrentUser ? '-left-1.5' : '-right-1.5'} z-10 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 animate-in fade-in zoom-in duration-300`}
              title="Tin nhắn đã ghim"
            >
              <Pin className="h-2.5 w-2.5 text-white fill-white" />
            </div>
          )}

          {message.is_forwarded && (
            <div className="flex items-center gap-1 mb-1 text-[11px] text-gray-500/80 dark:text-gray-400 font-medium italic">
              <Forward className="w-3 h-3" />
              <span>Chuyển tiếp</span>
            </div>
          )}

          <MessageMediaPreview 
            message={message}
            isCurrentUser={isCurrentUser}
            onJumpToMessage={onJumpToMessage}
            renderHighlightedText={renderHighlightedText}
            isActiveSearchTarget={isActiveSearchTarget}
          />

          <MessageActionMenu
            message={message}
            isCurrentUser={isCurrentUser}
            activeActionMenuMessageId={activeActionMenuMessageId}
            reactionPickerFor={reactionPickerFor}
            onOpenActionMenu={onOpenActionMenu}
            onScheduleCloseActionMenu={onScheduleCloseActionMenu}
            onScheduleOpenReactionPicker={onScheduleOpenReactionPicker}
            onScheduleCloseReactionPicker={onScheduleCloseReactionPicker}
            onOpenReactionPicker={onOpenReactionPicker}
            onReactionSelect={onReactionSelect}
            onReply={onReply}
            onDelete={onDelete}
            onForward={onForward}
            onTogglePin={onTogglePin}
          />
        </div>

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            {(() => {
              const emojiGroups = new Map<string, { users: string[]; userReacted: boolean; reactionId?: string }>();
              message.reactions.forEach((reaction) => {
                if (!emojiGroups.has(reaction.emoji)) {
                  emojiGroups.set(reaction.emoji, { users: [], userReacted: false });
                }
                const group = emojiGroups.get(reaction.emoji)!;
                group.users.push(reaction.user.username);
                if (reaction.user.id === currentUser?.id) {
                  group.userReacted = true;
                  group.reactionId = reaction.id;
                }
              });

              return Array.from(emojiGroups).map(([emoji, group]) => (
                <button
                  key={emoji}
                  onClick={() => group.reactionId && group.userReacted && onRemoveReaction(message.id, group.reactionId)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                    group.userReacted
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
                  }`}
                  title={group.users.join(', ')}
                >
                  <span>{emoji}</span>
                  <span>{group.users.length}</span>
                </button>
              ));
            })()}
          </div>
        )}

        {(!hideTimestamp || (isCurrentUser && (lastSeenByUsers.length > 0 || isLatestOwnMessage))) && (
        <div className={`mt-1 flex items-center gap-1.5 text-[10px] text-gray-400 font-medium min-h-[18px]`}>
          {!isCurrentUser && !hideTimestamp && <span>{message.sender.username}</span>}
          {!isCurrentUser && !hideTimestamp && <span className="text-gray-300">•</span>}
          {!hideTimestamp && <span>{formattedTime}</span>}
          {isCurrentUser && (
            <>
              {lastSeenByUsers.length > 0 ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="flex -space-x-1.5 justify-end w-full">
                    {lastSeenByUsers.slice(0, 3).map((u) => (
                      <div key={u.id} className="w-3.5 h-3.5 rounded-full border border-white dark:border-slate-900 bg-gray-200 overflow-hidden" title={u.username}>
                        {u.avatar_url ? (
                          <img width={400} height={400} src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-400 text-white text-[7px] uppercase">{u.username.charAt(0)}</div>
                        )}
                      </div>
                    ))}
                    {lastSeenByUsers.length > 3 && (
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[7px] font-bold text-slate-600">
                        +{lastSeenByUsers.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              ) : isLatestOwnMessage ? (
                <>
                  <span>•</span>
                  {message.delivered_at ? (
                    <div 
                      className="w-3.5 h-3.5 flex-shrink-0 rounded-full flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: '#8a57d7' }}
                    >
                      <Check className="w-2 h-2 text-white stroke-[4px]" />
                    </div>
                  ) : message.id.startsWith('temp-') ? (
                    <div 
                      className="w-3.5 h-3.5 flex-shrink-0 rounded-full animate-pulse" 
                      style={{ border: '1.5px solid #8a57d7' }}
                    />
                  ) : (
                    <div 
                      className="w-3.5 h-3.5 flex-shrink-0 rounded-full flex items-center justify-center"
                      style={{ border: '1.5px solid #8a57d7' }}
                    >
                      <Check className="w-2 h-2 text-[#8a57d7] stroke-[4px]" />
                    </div>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
        )}
      </div>


    </motion.div>
  );
});

export const MessageItem = Object.assign(MessageItemBase, {
  Grouped: (props: MessageItemProps) => (
    <MessageItemBase {...props} variant="grouped" />
  ),
});

MessageItem.displayName = 'MessageItem';
