'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { usersApi } from '@/lib/api';
import { Pencil, User, X } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedAvatarName, setSelectedAvatarName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const updated = await usersApi.updateProfile(user!.id, {
        username,
        avatar_url: avatarUrl,
      });
      setUser(updated);
      setSuccess('Profile updated!');
      alert('Cập nhật hồ sơ thành công');
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await usersApi.changePassword(user!.id, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed!');
      alert('Đổi mật khẩu thành công');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large (max 5MB)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
      setSelectedAvatarName(file.name);
    };
    reader.readAsDataURL(file);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-transparent py-8 px-4 dark:bg-slate-950">
      <div className="max-w-md mx-auto bg-white/90 rounded-3xl border-4 border-white shadow-[0_18px_45px_-20px_rgba(67,24,122,0.45)] dark:bg-slate-900 dark:border-slate-700">
        <div className="flex justify-between items-center p-8 border-b border-blue-100 dark:border-slate-700">
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-blue-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex border-b border-blue-100 dark:border-slate-700 bg-blue-50/40 dark:bg-slate-800/40">
          <button
            onClick={() => setTab('profile')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors hover:bg-blue-100/70 hover:text-blue-700 dark:hover:bg-slate-700/60 dark:hover:text-slate-200 ${
              tab === 'profile'
                ? 'border-b-2 border-blue-600 bg-blue-100/70 text-blue-700 dark:bg-slate-700/70 dark:text-slate-100'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setTab('password')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors hover:bg-blue-100/70 hover:text-blue-700 dark:hover:bg-slate-700/60 dark:hover:text-slate-200 ${
              tab === 'password'
                ? 'border-b-2 border-blue-600 bg-blue-100/70 text-blue-700 dark:bg-slate-700/70 dark:text-slate-100'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Change Password
          </button>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {tab === 'profile' && (
            <>
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  {avatarUrl ? (
                    <img width={400} height={400}
                      src={avatarUrl}
                      alt={username}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <input
                    id="profile-avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="profile-avatar-upload"
                    className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-md transition hover:bg-blue-600 cursor-pointer"
                    title="Chon anh dai dien"
                  >
                    <Pencil className="h-4 w-4" />
                  </label>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/95 text-gray-900 shadow-md ring-2 ring-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600 dark:focus:ring-blue-400"
                  />
                </div>

                <div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                    JPG/PNG, toi da 5MB.
                  </p>
                  {selectedAvatarName && (
                    <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">
                      Da chon anh: {selectedAvatarName}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-xl border-2 border-blue-300 hover:bg-blue-600 disabled:opacity-50 font-semibold"
                >
                  {isLoading ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </form>
            </>
          )}

           {tab === 'password' && (
             <form onSubmit={handleChangePassword} className="space-y-6">
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                   Current Password
                 </label>
                 <input
                   type="password"
                   value={currentPassword}
                   onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/95 text-gray-900 shadow-md ring-2 ring-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600 dark:focus:ring-blue-400"
                   required
                 />
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                   New Password
                 </label>
                 <input
                   type="password"
                   value={newPassword}
                   onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/95 text-gray-900 shadow-md ring-2 ring-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600 dark:focus:ring-blue-400"
                   required
                 />
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                   Confirm Password
                 </label>
                 <input
                   type="password"
                   value={confirmPassword}
                   onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/95 text-gray-900 shadow-md ring-2 ring-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600 dark:focus:ring-blue-400"
                   required
                 />
               </div>

               <button
                 type="submit"
                 disabled={isLoading}
                 className="w-full py-2 px-4 bg-blue-500 text-white rounded-xl border-2 border-blue-300 hover:bg-blue-600 disabled:opacity-50 font-semibold"
               >
                 {isLoading ? 'Changing…' : 'Change Password'}
               </button>
             </form>
           )}

           {/* Requests section removed per latest UI requirement */}
        </div>
      </div>
    </div>
  );
}

