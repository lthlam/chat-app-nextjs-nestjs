 'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { friendsApi, roomsApi } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';

import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: () => void;
}

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const rooms = useChatStore(s => s.rooms);
  const setRooms = useChatStore(s => s.setRooms);
  const setCurrentRoomId = useChatStore(s => s.setCurrentRoomId);
  const showToast = useUiStore((state) => state.showToast);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchFriends = async () => {
      try {
        setIsLoading(true);
        const friendList = (await friendsApi.getFriendList()) as any[];
        setFriends(friendList);
      } catch (error) {
        console.error('Failed to fetch friends:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFriends();
  }, [isOpen]);

  const toggleMember = (friendId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      showToast('Vui lòng nhập tên nhóm.', 'error');
      return;
    }

    if (selectedMembers.size < 2) {
      showToast('Vui lòng chọn ít nhất 2 thành viên.', 'error');
      return;
    }

    try {
      setIsCreating(true);
      const newRoom = await roomsApi.createRoom({
        name: groupName,
        members: Array.from(selectedMembers),
      });

      setRooms([...rooms, newRoom]);
      setCurrentRoomId(newRoom.id);

      // Reset form
      setGroupName('');
      setSelectedMembers(new Set());
      onClose();
      onGroupCreated?.();
      showToast('Tạo nhóm thành công.', 'success');
    } catch (error) {
      console.error('Failed to create group:', error);
      showToast('Tạo nhóm thất bại.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const hasGroupName = groupName.trim().length > 0;
  const hasEnoughMembers = selectedMembers.size >= 2;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 shadow-2xl backdrop-blur-[2px]"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md max-h-screen overflow-y-auto rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between bg-primary-light/80 p-4 dark:bg-slate-800/90 z-20">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Tạo nhóm chat</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1 transition hover:bg-primary-light dark:hover:bg-slate-700"
                disabled={isCreating}
              >
                <X className="w-5 h-5 text-gray-500 dark:text-slate-300" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Group Name Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200">
                  Tên nhóm <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nhập tên nhóm..."
                  className="w-full rounded-xl border-2 border-primary-light bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                  disabled={isCreating}
                />
                {!hasGroupName && (
                  <p className="mt-2 text-xs text-danger">Bạn cần nhập tên nhóm trước khi tạo.</p>
                )}
              </div>

              {/* Members Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200">
                  Chọn thành viên ({selectedMembers.size} đã chọn, tối thiểu 2)
                </label>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">

                  {isLoading ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">Đang tải danh sách bạn bè...</div>
                  ) : friends.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">Bạn chưa có bạn bè</div>
                  ) : (
                    friends.map((friend) => (
                      <label
                        key={friend.id}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 cursor-pointer ${
                          selectedMembers.has(friend.id) ? 'bg-blue-50 dark:bg-slate-800' : ''
                        }`}
                      >

                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedMembers.has(friend.id)}
                            onChange={() => toggleMember(friend.id)}
                            disabled={isCreating}
                              className="h-4 w-4 rounded border-primary-light text-primary focus:ring-primary dark:border-slate-500"
                          />
                          <Avatar 
                            src={friend.avatar_url} 
                            name={friend.username} 
                            size="sm" 
                            status={friend.status} 
                            showStatus={false} 
                          />

                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium text-gray-900 dark:text-slate-100">{friend.username}</div>
                            <div className="truncate text-xs text-gray-500 dark:text-slate-400">{friend.email}</div>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {!hasEnoughMembers && (
                  <p className="mt-2 text-xs text-danger">
                    Hãy chọn ít nhất 2 thành viên để tạo nhóm.
                  </p>
                )}
              </div>

              {/* Selected Members Tags */}
              {selectedMembers.size > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedMembers).map((memberId) => {
                    const friend = friends.find((f) => f.id === memberId);
                    return (
                      <div
                        key={memberId}
                        className="flex items-center gap-2 rounded-full border border-primary-light bg-primary-light px-3 py-1 text-sm font-medium text-primary-dark dark:border-primary-dark/40 dark:bg-primary-dark/30 dark:text-primary-light"
                      >
                        {friend?.username}
                        <button
                          onClick={() => toggleMember(memberId)}
                          className="hover:text-primary-dark/80"
                          disabled={isCreating}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex gap-3 bg-primary-light/80 p-4 dark:bg-slate-900/90">
              <button
                onClick={onClose}
                disabled={isCreating}
                className="flex-1 rounded-lg border border-primary-light bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-primary-light disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isCreating || !hasGroupName || !hasEnoughMembers}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:bg-gray-400 dark:disabled:bg-slate-600"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Tạo nhóm
                  </>
                )}
              </button>
            </div>

          </motion.div>

        </div>
      )}
    </AnimatePresence>
  );
}


