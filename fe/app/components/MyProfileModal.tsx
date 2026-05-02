'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usersApi } from '@/lib/api';
import { Pencil, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from './Avatar';

interface MyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyProfileModal({ isOpen, onClose }: MyProfileModalProps) {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [, setSelectedAvatarName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  useEffect(() => {
    if (user && isOpen) {
      setUsername(user.username);
      setAvatarUrl(user.avatar_url || '');
      setError('');
      setSuccess('');
    }
  }, [user, isOpen]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!/^[a-z0-9]+$/.test(username)) {
      setError('Username chỉ được chứa chữ thường và số (không khoảng cách, không dấu)');
      return;
    }

    setIsLoading(true);

    try {
      const updated = await usersApi.updateProfile(user.id, {
        username,
        avatar_url: avatarUrl,
      });
      setUser(updated);
      setSuccess('Cập nhật hồ sơ thành công');
    } catch (err: any) {
      setError(err.message || 'Cập nhật thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    setIsLoading(true);

    try {
      await usersApi.changePassword(user.id, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Đổi mật khẩu thành công');
    } catch (err: any) {
      setError(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh quá lớn (tối đa 5MB)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
      setSelectedAvatarName(file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      {isOpen && user && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl border-4 border-white bg-white shadow-2xl dark:bg-slate-900 dark:border-slate-800 overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-blue-50/50 dark:bg-slate-800/50 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Hồ sơ cá nhân</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition shadow-sm"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-slate-300" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-blue-50/30 dark:bg-slate-800/50 shrink-0">
              <button
                onClick={() => setTab('profile')}
                className={`flex-1 py-3 text-center font-semibold transition ${
                  tab === 'profile'
                    ? 'border-b-2 border-blue-600 bg-white/50 text-blue-700 dark:bg-slate-700/50 dark:text-blue-300'
                    : 'text-gray-500 hover:text-blue-600 dark:text-slate-400'
                }`}
              >
                Thông tin
              </button>
              <button
                onClick={() => setTab('password')}
                className={`flex-1 py-3 text-center font-semibold transition ${
                  tab === 'password'
                    ? 'border-b-2 border-blue-600 bg-white/50 text-blue-700 dark:bg-slate-700/50 dark:text-blue-300'
                    : 'text-gray-500 hover:text-blue-600 dark:text-slate-400'
                }`}
              >
                Mật khẩu
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {error && (
                    <div className="mb-4 p-3 bg-red-100/80 border border-red-200 text-red-700 rounded-xl text-sm">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mb-4 p-3 bg-green-100/80 border border-green-200 text-green-700 rounded-xl text-sm">
                      {success}
                    </div>
                  )}

                  {tab === 'profile' ? (
                    <div className="space-y-6">
                      <div className="flex justify-center">
                        <div className="relative">
                          <Avatar 
                            src={avatarUrl} 
                            name={username} 
                            size={112} 
                            className="ring-4 ring-blue-50 dark:ring-slate-800 shadow-lg" 
                          />
                          <input
                            id="profile-modal-avatar-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <label
                            htmlFor="profile-modal-avatar-upload"
                            className="absolute bottom-1 right-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl transition hover:bg-violet-700 cursor-pointer border-2 border-white dark:border-slate-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </label>
                        </div>
                      </div>

                      <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                            Username
                          </label>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-blue-200 bg-white text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                            Email
                          </label>
                          <input
                            type="email"
                            value={user.email}
                            readOnly
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm text-gray-500 cursor-not-allowed outline-none dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-500"
                            title="Email không thể thay đổi"
                          />
                        </div>

                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 transition transform active:scale-[0.98]"
                          >
                            {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                          Mật khẩu hiện tại
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-blue-200 bg-white text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                          Mật khẩu mới
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-blue-200 bg-white text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                          Xác nhận mật khẩu mới
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-blue-200 bg-white text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
                          required
                        />
                      </div>
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 transition transform active:scale-[0.98]"
                        >
                          {isLoading ? 'Đang đổi...' : 'Đổi mật khẩu'}
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
