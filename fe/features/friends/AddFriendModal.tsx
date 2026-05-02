'use client';

import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { usersApi, User } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
const UserProfileModal = dynamic(() => import('@/features/profile/UserProfileModal').then(mod => mod.UserProfileModal), { ssr: false });
import { Avatar } from '@/components/ui/Avatar';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFriendModal({ isOpen, onClose }: AddFriendModalProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setFoundUser(null);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      void handleSearch(query.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSearch = async (searchTerm: string) => {
    setIsSearching(true);
    setSearched(false);
    try {
      const user = await usersApi.findExact(searchTerm);
      setFoundUser(user);
      setSearched(true);
    } catch (error: any) {
      console.error('Search error:', error);
      // Don't show toast for every debounce error to avoid noise
    } finally {
      setIsSearching(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setFoundUser(null);
    setSearched(false);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute inset-0 bg-black/55 shadow-2xl backdrop-blur-[2px]"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between px-6 py-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 font-display">Tìm kiếm bạn bè</h2>
                <button
                  onClick={handleClose}
                  className="rounded-full p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-red-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-6 pb-6">
                <div className="relative group">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nhập chính xác username hoặc email..."
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 px-5 py-4 pl-12 text-sm text-gray-900 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-400/10 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"

                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}
                </div>


                <div className="mt-6 min-h-[110px] flex flex-col items-center justify-center transition-all overflow-hidden font-display">
                  {isSearching && !foundUser ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-xs font-medium text-slate-400">Đang tìm người dùng...</p>
                    </div>
                  ) : foundUser ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:bg-blue-50/50 dark:hover:bg-slate-700/80 transition cursor-pointer"

                      onClick={() => setShowProfile(true)}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar 
                          src={foundUser.avatar_url} 
                          name={foundUser.username} 
                          size="lg" 
                          className="shadow-lg ring-2 ring-white dark:ring-slate-800" 
                        />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{foundUser.username}</h4>
                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-wider">{foundUser.email}</p>

                        </div>
                      </div>
                    </motion.div>
                  ) : searched ? (
                    <div className="text-center p-4">
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Không tìm thấy người dùng</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Vui lòng kiểm tra lại thông tin</p>

                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UserProfileModal
        isOpen={showProfile}
        user={foundUser}
        onClose={() => setShowProfile(false)}
      />
    </>
  );
}
