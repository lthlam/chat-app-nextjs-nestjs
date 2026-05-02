'use client';

import { useState, useEffect } from 'react';
import { Unlock, UserPlus, UserMinus, Ban, X } from 'lucide-react';
import { usersApi, friendsApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';

interface UserProfileModalProps {
  user: {
    id: string;
    username: string;
    email: string;
    avatar_url?: string;
    status?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onBlockSuccess?: () => void;
}

export function UserProfileModal({ user, isOpen, onClose, onBlockSuccess }: UserProfileModalProps) {
  const blockedUsers = useAuthStore(s => s.blockedUsers);
  const setBlockedUsers = useAuthStore(s => s.setBlockedUsers);
  const [isFriend, setIsFriend] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);
  const requestConfirm = useUiStore((state) => state.requestConfirm);

  const isBlocked = user ? blockedUsers.includes(user.id) : false;

  useEffect(() => {
    if (!user || !isOpen) return;

    const checkRelation = async () => {
      try {
        const { isFriend, isPending } = await friendsApi.checkStatus(user.id);
        setIsFriend(isFriend);
        setIsPending(isPending);
      } catch (error) {
        console.error('Failed to check friendship:', error);
      }
    };

    checkRelation();
  }, [user, isOpen]);

  const handleBlock = async () => {
    if (!user) return;
    
    const confirm = await requestConfirm({
      title: 'Chặn người dùng?',
      message: `Bạn sẽ không nhận được tin nhắn từ ${user.username}. Đồng ý?`,
      confirmText: 'Chặn ngay',
      cancelText: 'Bỏ qua'
    });

    if (!confirm) return;

    setIsLoading(true);
    try {
      await usersApi.blockUser(user.id);
      setBlockedUsers([...blockedUsers, user.id]);
      showToast(`Đã chặn ${user.username}`, 'success');
      onBlockSuccess?.();
      onClose();
    } catch (error) {
      console.error(error);
      showToast('Không thể chặn người dùng', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await usersApi.unblockUser(user.id);
      setBlockedUsers(blockedUsers.filter(id => id !== user.id));
      showToast(`Đã bỏ chặn ${user.username}`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Không thể bỏ chặn', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await friendsApi.sendRequest(user.id);
      setIsPending(true);
      showToast('Đã gửi lời mời kết bạn', 'success');
    } catch (error: any) {
      showToast(error.message || 'Không thể gửi lời mời', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!user) return;

    const confirm = await requestConfirm({
      title: 'Hủy kết bạn?',
      message: `Bạn có chắc chắn muốn xóa ${user.username} khỏi danh sách bạn bè?`,
      confirmText: 'Hủy bạn',
      cancelText: 'Để sau'
    });

    if (!confirm) return;

    setIsLoading(true);
    try {
      await friendsApi.removeFriend(user.id);
      setIsFriend(false);
      showToast('Đã hủy kết bạn', 'info');
    } catch (error) {
      console.error(error);
      showToast('Không thể hủy kết bạn', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 shadow-2xl backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="relative w-full max-w-[320px] overflow-hidden overscroll-contain rounded-[2.5rem] bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-white/10"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center gap-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <Avatar 
                      src={user.avatar_url} 
                      name={user.username} 
                      size={80} 
                      className="ring-4 ring-blue-50/50 dark:ring-slate-800 shadow-xl" 
                    />
                  </div>

                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">{user.username}</h3>
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{user.email}</p>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="w-full flex gap-2">
                  {/* Friend Actions */}
                  {!isFriend && !isPending && !isBlocked && (
                    <button
                      onClick={handleAddFriend}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      Kết bạn
                    </button>
                  )}

                  {isPending && (
                    <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm font-bold dark:bg-slate-800 dark:text-slate-400">
                      Đã gửi
                    </div>
                  )}

                  {isFriend && (
                    <button
                      onClick={handleRemoveFriend}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-400 group"
                    >
                      <UserMinus className="w-4 h-4 group-hover:scale-105 transition-transform duration-300" />
                      Hủy kết bạn
                    </button>
                  )}

                  {/* Block Actions */}
                  {isBlocked ? (
                    <button
                      onClick={handleUnblock}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition active:scale-[0.98] group"
                    >
                      <Unlock className="w-4 h-4 group-hover:scale-105 transition-transform duration-300" />
                      Bỏ chặn
                    </button>
                  ) : (
                    <button
                      onClick={handleBlock}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-400 group border border-slate-200 dark:border-slate-700"
                    >
                      <Ban className="w-4 h-4 group-hover:-rotate-6 transition-transform duration-300 opacity-70" />
                      Chặn
                    </button>
                  )}

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
