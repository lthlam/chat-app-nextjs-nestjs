'use client';

import { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Link as LinkIcon, ChevronRight, Play, Mic, ChevronLeft, Ban, ShieldAlert } from 'lucide-react';
import { messagesApi, Message, roomsApi, usersApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';


import { motion } from 'framer-motion';

interface RoomDetailsSidebarProps {
  roomId: string | null;
  isGroup?: boolean;
  onClose?: () => void;
}

export function RoomDetailsSidebar({ roomId, isGroup, onClose }: RoomDetailsSidebarProps) {
  const { user, blockedUsers, addBlockedUser, removeBlockedUser } = useAuthStore();
  const showToast = useUiStore(state => state.showToast);
  const requestConfirm = useUiStore(state => state.requestConfirm);

  const [activeTab, setActiveTab] = useState<'media' | 'links'>('media');
  const [media, setMedia] = useState<Message[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);


  useEffect(() => {
    if (!roomId) return;
    roomsApi.getMembers(roomId).then(setRoomMembers).catch(console.error);
  }, [roomId]);

  const otherPerson = !isGroup ? roomMembers.find(m => m.id !== user?.id) : null;
  const isBlocked = otherPerson && blockedUsers.includes(otherPerson.id);

  const handleBlockConfirm = async () => {
    if (!otherPerson) return;
    
    const accepted = await requestConfirm({
      title: isBlocked ? "Bỏ chặn người dùng" : "Chặn người dùng",
      message: isBlocked 
        ? `Bạn có chắc muốn bỏ chặn ${otherPerson.username}?` 
        : `Bạn có chắc muốn chặn ${otherPerson.username}? Hai bạn sẽ tự động hủy kết bạn và không thể nhắn tin/gọi điện cho nhau.`,
      confirmText: isBlocked ? "Bỏ chặn" : "Chặn ngay",
      cancelText: "Hủy",
    });

    if (!accepted) return;

    try {
      if (isBlocked) {
        await usersApi.unblockUser(otherPerson.id);
        removeBlockedUser(otherPerson.id);
        showToast('Đã bỏ chặn người dùng này', 'success');
      } else {
        await usersApi.blockUser(otherPerson.id);
        addBlockedUser(otherPerson.id);
        showToast('Đã chặn người dùng này', 'success');
      }
    } catch {
      showToast('Thao tác thất bại', 'error');
    }
  };


  const loadData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const mediaData = await messagesApi.getMedia(roomId);
      setMedia(mediaData);
      
      const msgData = await messagesApi.getMessages(roomId, 100);
      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
      const foundLinks: string[] = [];
      msgData.data.forEach(m => {
        if (m.type === 'text') {
          const mLinks = m.content.match(urlRegex);
          if (mLinks) foundLinks.push(...mLinks);
        }
      });
      setLinks(Array.from(new Set(foundLinks)));
    } catch (e) {
      console.error('Failed to load room details:', e);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

    const handleNewMessage = (msg: Message) => {
      const msgRoomId = (msg as any).roomId || (msg as any).room?.id;
      if (msgRoomId !== roomId) return;

      if (['image', 'video', 'album', 'voice'].includes(msg.type)) {
        setMedia(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [msg, ...prev];
        });
      } else if (msg.type === 'text') {
        const mLinks = msg.content.match(urlRegex);
        if (mLinks) {
          setLinks(prev => {
            const newLinks = mLinks.filter(l => !prev.includes(l));
            if (newLinks.length === 0) return prev;
            return [...newLinks, ...prev];
          });
        }
      }
    };

    socket.on('new-message', handleNewMessage);
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [roomId]);

  if (!roomId) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 xl:hidden"
        onClick={onClose}
      />

      <motion.div 
        initial={{ x: '100%', width: 0, opacity: 0 }}
        animate={{ x: 0, width: 320, opacity: 1 }}
        exit={{ x: '100%', width: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative h-full border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex flex-col z-50 shadow-2xl md:shadow-none overflow-hidden"
      >
        {/* Header with Back Arrow */}
        <div className="px-3 py-1 flex items-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title="Quay lại"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1 gap-1 bg-slate-200/60 dark:bg-slate-800 m-3 rounded-xl border border-slate-300/50 dark:border-slate-700 shadow-inner">
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors duration-200 border ${
              activeTab === 'media'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 border-slate-200 dark:border-slate-600 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Media
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors duration-200 border ${
              activeTab === 'links'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 border-slate-200 dark:border-slate-600 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" /> Links
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 xl:p-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : activeTab === 'media' ? (
            media.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Chưa có media nào</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {media.flatMap((item) => {
                  if (item.type === 'album') {
                    try {
                      const urls = JSON.parse(item.content);
                      return urls.map((url: string, idx: number) => ({
                        id: `media-album-${item.id}-${idx}`,
                        content: url,
                        type: 'image'
                      }));
                    } catch {
                      return [];
                    }
                  }
                  return [{ ...item, id: `media-item-${item.id}` }];
                }).map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 dark:border-slate-800 cursor-pointer group bg-black flex items-center justify-center"
                    onClick={() => window.open(item.content, '_blank')}
                  >
                    {item.type === 'voice' ? (
                      <div className="w-full h-full bg-purple-50 dark:bg-purple-900/40 flex flex-col items-center justify-center gap-1 text-purple-500">
                        <Mic className="w-6 h-6" />
                        <span className="text-[8px] font-bold uppercase">Voice</span>
                      </div>

                    ) : item.type === 'video' ? (
                      <video src={item.content} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <img src={item.content} alt="media" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    )}
                    {item.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2">
              {links.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Chưa có link nào</div>
              ) : (
                links.map((link, i) => (
                  <a
                    key={`sidebar-link-${i}-${link.substring(0, 10)}`}
                    href={link.startsWith('http') ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 group shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 shrink-0">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                        {link}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate tracking-tight font-extrabold uppercase">Mở liên kết</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5" />
                  </a>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!isGroup && otherPerson && (
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              onClick={handleBlockConfirm}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                isBlocked
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >


              {isBlocked ? (
                <>
                  <ShieldAlert className="w-4 h-4" /> Bỏ chặn người dùng
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" /> Chặn người dùng
                </>
              )}
            </button>
            <p className="mt-2 text-[10px] text-center text-slate-400 dark:text-slate-500">
              {isBlocked 
                ? "Bạn có thể bỏ chặn để tiếp tục trò chuyện." 
                : "Khi chặn, hai bạn sẽ không thể nhắn tin hay gọi điện cho nhau."}
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
}

