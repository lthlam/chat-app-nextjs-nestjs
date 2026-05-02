'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Image as ImageIcon, Link as LinkIcon, ChevronRight, Play, Mic } from 'lucide-react';
import { messagesApi, Message } from '@/lib/api';

interface MediaGalleryModalProps {
  roomId: string | null;
  isOpen: boolean;
  onClose: () => void;
}



export function MediaGalleryModal({ roomId, isOpen, onClose }: MediaGalleryModalProps) {
  const [activeTab, setActiveTab] = useState<'media' | 'links'>('media');
  const [media, setMedia] = useState<Message[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      // Load Media
      const mediaData = await messagesApi.getMedia(roomId);
      setMedia(mediaData);

      // Load Links (from last 100 messages)
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
    } catch (error) {
      console.error('Failed to load storage:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (isOpen && roomId) {
      loadData();
    }
  }, [isOpen, roomId, loadData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Kho lưu trữ nội dung</h3>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setActiveTab('media')}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 ${
                  activeTab === 'media' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Media
              </button>
              <button
                onClick={() => setActiveTab('links')}
                className={`text-sm font-bold pb-2 transition-colors border-b-2 ${
                  activeTab === 'links' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Links
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : activeTab === 'media' ? (
            media.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                <ImageIcon className="w-16 h-16 opacity-20" />
                <p>Chưa có hình ảnh hoặc video nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {media.flatMap((item) => {
                  if (item.type === 'album') {
                    try {
                      const urls = JSON.parse(item.content);
                      return urls.map((url: string, idx: number) => ({
                        id: `modal-album-${item.id}-${idx}`,
                        content: url,
                        type: 'image',
                        sender: item.sender,
                        created_at: item.created_at
                      }));
                    } catch {
                      return [];
                    }
                  }
                  return [{ ...item, id: `modal-item-${item.id}` }];
                }).map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer border border-gray-100 dark:border-slate-800 bg-black flex items-center justify-center"
                    onClick={() => window.open(item.content, '_blank')}
                  >
                    {item.type === 'voice' ? (
                      <div className="w-full h-full bg-purple-50 dark:bg-purple-900/40 flex flex-col items-center justify-center gap-2">
                        <Mic className="w-8 h-8 text-purple-500" />
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Ghi âm</span>
                      </div>
                    ) : item.type === 'video' ? (
                      <video src={item.content} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <img
                        src={item.content}
                        alt="Media"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 z-10">
                      <p className="text-[10px] text-white truncate font-medium">
                        {item.sender.username} • {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {item.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white border border-white/50">
                          <Play className="w-6 h-6 fill-current ml-1" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {links.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                  <LinkIcon className="w-16 h-16 opacity-20" />
                  <p>Chưa có liên kết nào</p>
                </div>
              ) : (
                links.map((link, i) => (
                  <a
                    key={`modal-link-${i}-${link.substring(0, 10)}`}
                    href={link.startsWith('http') ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-900 group shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 shrink-0">
                      <LinkIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                        {link}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">Mở liên kết</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
                  </a>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
