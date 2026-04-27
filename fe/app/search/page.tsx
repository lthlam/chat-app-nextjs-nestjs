'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usersApi, friendsApi } from '@/lib/api';
import { User } from '@/lib/api';
import { Search, UserPlus, X } from 'lucide-react';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFriend, setIsFriend] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const users = await usersApi.search(searchQuery);
      setResults(users);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const selectUser = async (user: User) => {
    setSelectedUser(user);
    setError('');
    try {
      const { areFriends } = await friendsApi.checkFriend(user.id);
      setIsFriend(areFriends);
    } catch {
      setIsFriend(false);
    }
  };

  const handleAddFriend = async () => {
    if (!selectedUser) return;
    setIsRequesting(true);
    try {
      await friendsApi.sendRequest(selectedUser.id);
      setError('Friend request sent!');
      setIsRequesting(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send request');
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-4 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-6 p-2 hover:bg-blue-100 rounded-xl"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by username or email..."
              className="w-full pl-10 pr-4 py-3 border-2 border-blue-200 rounded-2xl bg-white text-black placeholder-black focus:outline-none focus:ring-2 focus:ring-blue-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Results List */}
          <div className="lg:col-span-1 bg-white/90 rounded-3xl border-4 border-white shadow-[0_18px_45px_-20px_rgba(67,24,122,0.45)] dark:bg-slate-900 dark:border-slate-700">
            <div className="p-4 border-b border-blue-100 dark:border-slate-700">
              <h2 className="font-bold text-gray-900">
                Results ({results.length})
              </h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {isLoading && <div className="p-4 text-gray-500">Searching...</div>}
              {results.length === 0 && !isLoading && (
                <div className="p-4 text-gray-500 text-sm">No users found</div>
              )}
              {results.map((user) => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                    className={`w-full text-left p-4 hover:bg-blue-50 transition ${
                    selectedUser?.id === user.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="font-medium text-gray-900">{user.username}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </button>
              ))}
            </div>
          </div>

          {/* User Detail */}
          {selectedUser && (
            <div className="lg:col-span-2 bg-white/90 rounded-3xl border-4 border-white shadow-[0_18px_45px_-20px_rgba(67,24,122,0.45)] p-6 dark:bg-slate-900 dark:border-slate-700">
              <div className="text-center mb-8">
                {selectedUser.avatar_url ? (
                  <img
                    src={selectedUser.avatar_url}
                    alt={selectedUser.username}
                    className="w-24 h-24 rounded-full mx-auto object-cover mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 bg-blue-500 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold mb-4">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </div>
                )}

                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedUser.username}
                </h1>
                <p className="text-gray-600">{selectedUser.email}</p>
                {selectedUser.status && (
                  <p className={`text-sm mt-2 ${
                    selectedUser.status === 'online'
                      ? 'text-green-600'
                      : 'text-gray-500'
                  }`}>
                    {selectedUser.status}
                  </p>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">{error}</p>
                </div>
              )}

              {isFriend ? (
                <div className="text-center">
                  <p className="text-green-600 font-medium">Already friends</p>
                </div>
              ) : (
                <button
                  onClick={handleAddFriend}
                  disabled={isRequesting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 border-2 border-blue-300 text-white rounded-2xl hover:bg-blue-600 disabled:opacity-50 font-semibold"
                >
                  <UserPlus className="w-5 h-5" />
                  {isRequesting ? 'Sending...' : 'Add Friend'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

