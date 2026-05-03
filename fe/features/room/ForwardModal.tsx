'use client';

import { useState, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { X, Forward as ForwardIcon, Search } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
}

export function ForwardModal({ isOpen, onClose, messageId }: ForwardModalProps) {
  const rooms = useChatStore(s => s.rooms);
  const user = useAuthStore(s => s.user);
  const showToast = useUiStore((state) => state.showToast);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);

  const getRoomName = (room: any) => {
    if (room.is_group_chat) {
      return `[Nhóm] ${room.name || room.members?.map((m: any) => m.username).join(', ') || 'Chưa đặt tên'}`;
    }
    return room.members?.find((m: any) => m.id !== user?.id)?.username || 'Người dùng';
  };

  const filteredRooms = rooms.filter(room => {
    const name = getRoomName(room);
    return name.toLowerCase().includes(deferredSearch.toLowerCase());
  });

  const toggleRoom = (roomId: string) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) ? prev.filter(r => r !== roomId) : [...prev, roomId]
    );
  };

  const handleForward = async () => {
    if (selectedRooms.length === 0) return;
    setIsLoading(true);
    try {
      const socket = getSocket();
      for (const targetRoomId of selectedRooms) {
        socket.emit('forward-message', {
          messageId,
          targetRoomId,
        });
      }
      showToast('Đã chuyển tiếp tin nhắn', 'success');
      setSelectedRooms([]);
      onClose();
    } catch {
      showToast('Chuyển tiếp thất bại', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col max-h-[80vh]"
        >
          <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ForwardIcon className="w-5 h-5 text-blue-500" />
              Chuyển tiếp đến
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm kiếm cuộc trò chuyện…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-y-auto overscroll-contain flex-1 p-2">
            {filteredRooms.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Không tìm thấy cuộc trò chuyện nào</p>
            ) : (
              <div className="space-y-1">
                {filteredRooms.map((room) => {
                  const isSelected = selectedRooms.includes(room.id);
                  return (
                    <button
                      key={room.id}
                      onClick={() => toggleRoom(room.id)}
                      disabled={isLoading}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors disabled:opacity-50 text-left"
                    >
                      <div className="relative flex items-center justify-center w-5 h-5 rounded-md border border-gray-300 dark:border-slate-600 shrink-0">
                        {isSelected && (
                          <div className="absolute inset-0 bg-blue-500 rounded-md border-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>
                      <Avatar 
                        src={room.avatar_url || room.members?.find((m: any) => m.id !== user?.id)?.avatar_url} 
                        name={getRoomName(room)} 
                        size="md" 
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {getRoomName(room)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded-b-2xl flex justify-end">
            <button
              onClick={handleForward}
              disabled={selectedRooms.length === 0 || isLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-blue-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
            >
              Chuyển tiếp {selectedRooms.length > 0 ? `(${selectedRooms.length})` : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
