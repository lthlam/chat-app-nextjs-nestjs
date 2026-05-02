'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { usersApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Phone, Settings, Video, Menu, ChevronLeft, Search } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { RoomList } from '@/features/room/RoomList';
import { ChatMessages } from '@/features/chat/ChatMessages';
import dynamic from 'next/dynamic';
import { MessageInput } from '@/features/chat/MessageInput';
const GroupSettingsModal = dynamic(() => import('@/features/room/GroupSettingsModal').then(mod => mod.GroupSettingsModal), { ssr: false });
const UserProfileModal = dynamic(() => import('@/features/profile/UserProfileModal').then(mod => mod.UserProfileModal), { ssr: false });
const RoomDetailsSidebar = dynamic(() => import('@/features/room/RoomDetailsSidebar').then(mod => mod.RoomDetailsSidebar), { ssr: false });
import { useUiStore } from '@/store/uiStore';
import { formatTimeAgo } from '@/utils/timeAgo';
import { Avatar } from '@/components/ui/Avatar';

export function ChatLayout() {
  const rooms = useChatStore((s) => s.rooms);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const setCurrentRoomId = useChatStore((s) => s.setCurrentRoomId);
  const removeRoom = useChatStore((s) => s.removeRoom);
  const updateUserStatus = useChatStore((s) => s.updateUserStatus);
  const isSearchOpen = useChatStore((s) => s.isSearchOpen);
  const setIsSearchOpen = useChatStore((s) => s.setIsSearchOpen);
  const selectedUserProfileUser = useChatStore((s) => s.selectedUserProfileUser);
  const setSelectedUserProfileUser = useChatStore((s) => s.setSelectedUserProfileUser);

  const user = useAuthStore((s) => s.user);
  const setBlockedUsers = useAuthStore((s) => s.setBlockedUsers);
  const blockedUsers = useAuthStore((s) => s.blockedUsers);
  const blockedByUsers = useAuthStore((s) => s.blockedByUsers);
  const setBlockedByUsers = useAuthStore((s) => s.setBlockedByUsers);
  const addBlockedByUser = useAuthStore((s) => s.addBlockedByUser);
  const removeBlockedByUser = useAuthStore((s) => s.removeBlockedByUser);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isMobileRoomListOpen, setIsMobileRoomListOpen] = useState(true);
  const showToast = useUiStore((state) => state.showToast);

  const loadBlocked = useCallback(async () => {
    try {
      const [blocked, blockedBy] = await Promise.all([
        usersApi.getBlockedUsers(),
        usersApi.getBlockedByUsers()
      ]);
      setBlockedUsers(blocked.map(u => u.id));
      setBlockedByUsers(blockedBy.map(u => u.id));
    } catch (e) {
      console.error('Failed to load blocked lists', e);
    }
  }, [setBlockedUsers, setBlockedByUsers]);

  useEffect(() => {
    if (!user) return;
    loadBlocked();

    const socket = getSocket();
    socket.on('user-status-changed', ({ userId, status, last_seen }: { userId: string, status: 'online' | 'offline' | 'away', last_seen?: string }) => {
      updateUserStatus(userId, status, last_seen);
    });
    socket.on('user-blocked', ({ blockerId }: { blockerId: string }) => {
      addBlockedByUser(blockerId);
    });
    socket.on('user-unblocked', ({ blockerId }: { blockerId: string }) => {
      removeBlockedByUser(blockerId);
    });

    return () => {
      socket.off('user-status-changed');
      socket.off('user-blocked');
      socket.off('user-unblocked');
    };
  }, [user, loadBlocked, updateUserStatus, addBlockedByUser, removeBlockedByUser]);

  const currentRoom = rooms.find((r) => r.id === currentRoomId);
  const otherPerson = currentRoom?.members?.find((m: any) => String(m.id) !== String(user?.id));
  const isTargetBlocked = otherPerson && (blockedUsers.includes(otherPerson.id) || blockedByUsers.includes(otherPerson.id));

  const displayName = currentRoom?.is_group_chat
    ? currentRoom.name
    : otherPerson?.username || 'Direct Message';


  useEffect(() => {
    if (currentRoomId) {
      setIsMobileRoomListOpen(false);
      return;
    }
    setIsMobileRoomListOpen(true);
  }, [currentRoomId]);

  const openCallWindow = (roomId: string, role: 'offerer' | 'answerer', type: 'audio' | 'video' = 'audio') => {
    const url = `/chat/call/${roomId}?role=${role}&type=${type}`;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      window.open(url, '_blank');
    } else {
      const features = 'width=450,height=650,menubar=no,toolbar=no,location=no,status=no';
      window.open(url, `call_${roomId}`, features);
    }
  };

  useEffect(() => {
    const socket = getSocket();
    const onRoomRemoved = (payload: { roomId?: string; reason?: string }) => {
      if (!payload?.roomId) return;
      removeRoom(payload.roomId);
      if (payload.reason === 'kicked') {
        showToast('Ban da bi xoa khoi nhom nay.', 'info');
      }
    };
    socket.on('room-removed', onRoomRemoved);
    return () => {
      socket.off('room-removed', onRoomRemoved);
    };
  }, [removeRoom, showToast]);

  return (
    <div className="flex h-screen max-[480px]:h-[100dvh] flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Column 1: Room List */}
        <div className={`${isMobileRoomListOpen ? 'flex' : 'hidden'} md:flex h-full w-full md:w-auto shrink-0 transition-all`}>
          <RoomList onRoomSelected={() => setIsMobileRoomListOpen(false)} />
        </div>

        {/* Column 2 & 3: Chat Area + Sidebar Wrapper */}
        <motion.div 
          layout
          className={`
            fixed top-[56px] max-[480px]:top-[48px] max-[420px]:top-[44px] max-[380px]:top-[40px] inset-x-0 bottom-0 z-40 bg-white dark:bg-slate-950 flex transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${isMobileRoomListOpen ? 'translate-x-full' : 'translate-x-0'}
            md:relative md:top-0 md:translate-x-0 md:z-0 flex-1 min-w-0
          `}
        >
          {/* Column 2: Chat Area */}
          <motion.div 
            layout
            className="flex-1 flex flex-col min-w-0 border-r border-blue-100 dark:border-slate-800"
          >
           {currentRoom ? (
             <>
               <div className="px-4 max-[480px]:px-1.5 py-1.5 border-b border-blue-100 bg-blue-50/70 flex items-center justify-between dark:bg-slate-900 dark:border-slate-700 shrink-0">
                 <div className="flex items-center gap-3 min-w-0">
                   <button
                     onClick={() => {
                       setIsMobileRoomListOpen(true);
                       setCurrentRoomId(null);
                     }}
                     className="md:hidden p-1 text-blue-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-full transition-all"
                   >
                     <ChevronLeft className="w-6 h-6" />
                   </button>
                    <Avatar 
                      src={currentRoom.is_group_chat ? (currentRoom as any).avatar_url : otherPerson?.avatar_url} 
                      name={displayName} 
                      size="sm"
                      status={!currentRoom.is_group_chat ? otherPerson?.status : undefined}
                      showStatus={!currentRoom.is_group_chat}
                    />

                   <div className="min-w-0 flex flex-col">
                     <h2 className="font-bold text-gray-900 dark:text-slate-100 truncate leading-tight">{displayName}</h2>
                     {!currentRoom.is_group_chat && otherPerson && (
                       <span className="text-xs text-gray-500 dark:text-slate-400">
                         {otherPerson.status === 'online' ? 'Đang hoạt động' : formatTimeAgo(otherPerson.last_seen)}
                       </span>
                     )}
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    {currentRoom.is_group_chat && (
                      <button
                        onClick={() => setShowSettings(true)}
                        className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-100 dark:text-slate-200 dark:hover:bg-slate-700 group/tooltip relative"
                      >
                        <Settings className="h-5 w-5" />
                        <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                          Cài đặt nhóm
                        </span>
                      </button>
                    )}

                    {!currentRoom.is_group_chat && currentRoomId && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openCallWindow(currentRoomId, 'offerer', 'video')}
                          disabled={isTargetBlocked}
                          className={`p-2 rounded-full transition-all group/tooltip relative ${
                            isTargetBlocked 
                              ? 'text-gray-400 cursor-not-allowed opacity-50' 
                              : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          }`}
                        >
                          <Video className="w-5 h-5 md:w-6 md:h-6" />
                          <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                            {isTargetBlocked ? "Bạn đã chặn người dùng này" : "Video Call"}
                          </span>
                        </button>
                        <button
                          onClick={() => openCallWindow(currentRoomId, 'offerer', 'audio')}
                          disabled={isTargetBlocked}
                          className={`p-2 rounded-full transition-all group/tooltip relative ${
                            isTargetBlocked 
                              ? 'text-gray-400 cursor-not-allowed opacity-50' 
                              : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                          }`}
                        >
                          <Phone className="w-5 h-5 md:w-5 md:h-5" />
                          <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                            {isTargetBlocked ? "Bạn đã chặn người dùng này" : "Audio Call"}
                          </span>
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setIsSearchOpen(!isSearchOpen)}
                      className={`p-2 rounded-full transition group/tooltip relative ${isSearchOpen ? 'text-blue-600 bg-blue-50 dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <Search className="h-5 w-5 md:h-6 md:w-6" />
                      <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                        Tìm kiếm tin nhắn
                      </span>
                    </button>

                    <button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className={`p-2 rounded-full transition group/tooltip relative ${isSidebarOpen ? 'text-indigo-600 bg-indigo-50 dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <Menu className="h-5 w-5 md:h-6 md:w-6" />
                      <span className="pointer-events-none absolute top-full mt-2 left-[calc(50%-12px)] -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                        Thông tin cuộc trò chuyện
                      </span>
                    </button>
                  </div>
               </div>
               <ChatMessages />
               <MessageInput />
             </>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center p-8 bg-blue-50/10 dark:bg-slate-900/10">
               <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Chào mừng bạn!</h3>
               <p className="text-gray-500 text-center max-w-sm">Hãy chọn một đoạn hội thoại bên trái để bắt đầu nhắn tin.</p>
             </div>
           )}
          </motion.div>
          {/* Column 3: Room Details Sidebar (Drawer on mobile, Sidebar on desktop) */}
          <AnimatePresence>
            {currentRoomId && isSidebarOpen && (
              <RoomDetailsSidebar 
                roomId={currentRoomId} 
                isGroup={currentRoom?.is_group_chat}
                onClose={() => setIsSidebarOpen(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <GroupSettingsModal
            roomId={currentRoomId}
            roomName={currentRoom?.name || null}
            roomAvatar={(currentRoom as any)?.avatar_url || null}
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onLeaveSuccess={() => {
              setShowSettings(false);
              setIsSidebarOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUserProfileUser && (
          <UserProfileModal
            user={selectedUserProfileUser}
            isOpen={!!selectedUserProfileUser}
            onClose={() => setSelectedUserProfileUser(null)}
            onBlockSuccess={() => {
              loadBlocked();
              setSelectedUserProfileUser(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
