'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Moon, Sun, Search } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/ui/Logo';
import dynamic from 'next/dynamic';
const MyProfileModal = dynamic(() => import('@/features/profile/MyProfileModal').then(mod => mod.MyProfileModal), { ssr: false });
const GlobalSearchModal = dynamic(() => import('@/features/search/GlobalSearchModal').then(mod => mod.GlobalSearchModal), { ssr: false });
import { Avatar } from '@/components/ui/Avatar';

export function Navbar() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-blue-100 dark:bg-slate-900 dark:border-slate-700">
      <div className="w-full px-3 max-[480px]:px-2 max-[420px]:px-1.5 max-[380px]:px-1 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-14 max-[480px]:h-12 max-[420px]:h-11 max-[380px]:h-10 gap-3 max-[480px]:gap-2 max-[420px]:gap-1.5 max-[380px]:gap-1">
          <Logo />
          
          {/* Global Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <button
              onClick={() => setIsGlobalSearchOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition group shadow-inner"
            >
              <Search className="w-4 h-4 group-hover:text-blue-500 transition-colors" />
              <span className="text-sm font-medium">Tìm kiếm tất cả tin nhắn</span>
            </button>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3 max-[480px]:gap-2 max-[420px]:gap-1.5">
            <button
              onClick={() => setIsGlobalSearchOpen(true)}
              className="md:hidden flex items-center gap-1.5 px-2 py-1.5 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-xl transition font-bold text-[10px] sm:text-xs"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 h-4" />
              <span className="hidden min-[400px]:inline">Tìm kiếm tất cả tin nhắn</span>
            </button>
            <div
              onClick={() => setIsProfileOpen(true)}
              className="cursor-pointer hover:opacity-80 transition flex-shrink-0"
            >
              <Avatar 
                src={user?.avatar_url} 
                name={user?.username} 
                size="md" 
                className="max-[480px]:w-8 max-[480px]:h-8 max-[420px]:w-7 max-[420px]:h-7 max-[380px]:w-6 max-[380px]:h-6" 
              />
            </div>

            <div className="flex gap-2 max-[480px]:gap-1 max-[420px]:gap-0.5">
              <button
                onClick={toggleTheme}
                className="p-2 max-[480px]:p-1.5 max-[420px]:p-1 max-[380px]:p-0.5 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-5 h-5 max-[480px]:w-4 max-[480px]:h-4 max-[420px]:w-3.5 max-[420px]:h-3.5 max-[380px]:w-3 max-[380px]:h-3 text-yellow-400" /> : <Moon className="w-5 h-5 max-[480px]:w-4 max-[480px]:h-4 max-[420px]:w-3.5 max-[420px]:h-3.5 max-[380px]:w-3 max-[380px]:h-3 text-slate-600" />}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 max-[480px]:p-1.5 max-[420px]:p-1 max-[380px]:p-0.5 hover:bg-red-50 rounded-xl transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5 max-[480px]:w-4 max-[480px]:h-4 max-[420px]:w-3.5 max-[420px]:h-3.5 max-[380px]:w-3 max-[380px]:h-3 text-red-600" />
              </button>
            </div>
          </div>
        </div>

      </div>
      <MyProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
      <GlobalSearchModal 
        isOpen={isGlobalSearchOpen} 
        onClose={() => setIsGlobalSearchOpen(false)} 
      />
    </nav>
  );
}
