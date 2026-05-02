'use client';

import { memo } from 'react';
import { Users, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { formatLastMessageTime } from '@/utils/timeAgo';
import { Avatar } from '@/components/ui/Avatar';

interface RoomItemProps {
  room: any;
  currentRoomId: string | null;
  onSelect: (roomId: string) => void;
  onDeleteChat?: (roomId: string, e: React.MouseEvent) => void;
  getRoomDisplayName: (room: any) => string;
  getLastMessagePreview: (room: any) => string;
}

export const RoomItem = memo(function RoomItem({ room, currentRoomId, onSelect, onDeleteChat, getRoomDisplayName, getLastMessagePreview }: RoomItemProps) {
  const user = useAuthStore(s => s.user);
  const otherUser = !room.is_group_chat
    ? room.members?.find((m: any) => m.id !== user?.id)
    : null;
  const displayRoomName = getRoomDisplayName(room);
  const dmStatus = otherUser?.status || 'offline';
  const isUnread = Boolean(room.last_message?.is_unread_for_me);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(room.id);
        }
      }}
      onClick={() => onSelect(room.id)}
      className={`group relative w-full text-left px-4 py-3 max-[420px]:px-3 max-[420px]:py-2.5 max-[380px]:px-2.5 max-[380px]:py-2 hover:bg-white/80 transition dark:hover:bg-slate-800 flex items-center justify-between ${
        currentRoomId === room.id ? 'bg-white dark:bg-slate-800' : ''
      }`}
    >
      {currentRoomId === room.id && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-1.5 rounded-r-full bg-blue-500" />
      )}
      <div className="flex items-center gap-3 max-[420px]:gap-2 min-w-0 flex-1">

        <div className="relative flex-shrink-0">
          <Avatar 
            src={otherUser?.avatar_url || room.avatar_url} 
            name={displayRoomName} 
            size="md" 
            status={dmStatus} 
            showStatus={!room.is_group_chat} 
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className={`truncate flex items-center gap-1 ${isUnread ? 'font-bold text-gray-900 dark:text-slate-100' : 'font-medium text-gray-900 dark:text-slate-200'}`}>
            {room.is_group_chat && <Users className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
            <span className="truncate">{displayRoomName}</span>
          </div>
          <div className={`text-sm max-[420px]:text-xs truncate ${isUnread ? 'font-semibold text-gray-900 dark:text-slate-200' : 'text-gray-500 dark:text-slate-400'}`}>
            {getLastMessagePreview(room)}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1 ml-2 shrink-0 h-full justify-start py-0">
        <div className="relative w-8 h-8 flex items-start justify-center pt-0">
          {/* Timestamp - hidden on hover */}
          {room.last_message && (
            <span className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap transition-opacity group-hover:opacity-0 mt-0.5">
              {formatLastMessageTime(room.last_message.created_at)}
            </span>
          )}
          
          {/* Delete Button - shown on hover */}
          {onDeleteChat && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteChat?.(room.id, e); }}
              className="group/trash absolute inset-0 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition focus:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
              <span className="pointer-events-none absolute top-full right-0 mt-2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/trash:opacity-100 z-50 dark:bg-slate-700">
                Xóa cuộc trò chuyện
              </span>
            </button>
          )}
        </div>
        
        {isUnread && (
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
        )}
      </div>
    </div>
  );
});
