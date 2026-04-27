'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nextIsDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', nextIsDark);
    setIsDark(nextIsDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!/^[a-z0-9]+$/.test(username)) {
      setError('Username should only contain lowercase letters and numbers');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.register(username, email, password);
      useChatStore.getState().reset();
      useUiStore.getState().reset();
      setUser(response.user);
      setToken(response.access_token);
      router.push('/chat');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4 dark:bg-slate-950">
      <div className="relative max-w-md w-full space-y-8 bg-white/90 p-8 rounded-3xl border-4 border-white shadow-[0_18px_45px_-20px_rgba(67,24,122,0.45)] dark:bg-slate-900 dark:border-slate-700">
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute right-5 top-5 p-2 rounded-xl hover:bg-blue-100 dark:hover:bg-slate-800 transition"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-slate-100">Create account</h2>
        </div>

        <form onSubmit={handleRegister} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-xl text-gray-900 placeholder:text-gray-400 bg-white/95 ring-2 ring-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-slate-600 dark:focus:ring-blue-500/60"
              placeholder="johndoe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-xl text-gray-900 placeholder:text-gray-400 bg-white/95 ring-2 ring-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-slate-600 dark:focus:ring-blue-500/60"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-xl text-gray-900 placeholder:text-gray-400 bg-white/95 ring-2 ring-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-slate-600 dark:focus:ring-blue-500/60"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-xl text-gray-900 placeholder:text-gray-400 bg-white/95 ring-2 ring-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-slate-600 dark:focus:ring-blue-500/60"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 rounded-xl border-2 border-blue-300 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300 disabled:opacity-50"
          >
            {isLoading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

