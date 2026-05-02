'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { ImagePlus, Send, X, Mic, MapPin, Loader2 } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { AudioRecorder } from '@/components/ui/AudioRecorder';
import { messagesApi } from '@/lib/api';
import { useRoomMembers } from '@/hooks/useRoomMembers';


export function MessageInput() {
  const currentRoomId = useChatStore(s => s.currentRoomId);
  const replyingTo = useChatStore(s => s.replyingTo);
  const setReplyingTo = useChatStore(s => s.setReplyingTo);
  const rooms = useChatStore(s => s.rooms);
  const setShouldJumpToLatest = useChatStore(s => s.setShouldJumpToLatest);
  const user = useAuthStore(s => s.user);
  const blockedUsers = useAuthStore(s => s.blockedUsers);
  const blockedByUsers = useAuthStore(s => s.blockedByUsers);
  const showToast = useUiStore((state) => state.showToast);
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  
  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const shouldFetchMembers = currentRoomId && !currentRoom?.is_group_chat;
  const { membersData: roomMembers } = useRoomMembers(shouldFetchMembers ? currentRoomId : null);

  const otherPerson = !currentRoom?.is_group_chat ? roomMembers.find(m => m.id !== user?.id) : null;
  const isBlocked = Boolean(otherPerson && blockedUsers.includes(otherPerson.id));
  const isBlockedBy = Boolean(otherPerson && blockedByUsers.includes(otherPerson.id));
  const isAnyBlocked = isBlocked || isBlockedBy;

  useEffect(() => {
    setReplyingTo(null);
  }, [currentRoomId, setReplyingTo]);

  useEffect(() => {
    if (!replyingTo) return;
    textInputRef.current?.focus();
  }, [replyingTo]);

  const handleTyping = () => {
    if (!currentRoomId || !user) return;

    // Emit typing event
    const socket = getSocket();
    socket.emit('typing', {
      roomId: currentRoomId,
      userId: user.id,
      username: user.username,
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', {
        roomId: currentRoomId,
        userId: user.id,
      });
    }, 1000);
  };

  const sendPayload = async (payload: string) => {
    if (!payload.trim() || !currentRoomId || isLoading) return;
    setIsLoading(true);

    try {
      // Stop typing indicator
      const socket = getSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socket.emit('stop-typing', {
        roomId: currentRoomId,
        userId: user?.id,
      });

      socket.emit('send-message', {
        roomId: currentRoomId,
        content: payload,
        replyToMessageId: replyingTo?.id,
        mentions: mentions.length > 0 ? mentions : undefined,
      });

      setReplyingTo(null);
      setShouldJumpToLatest(true);
      setMentions([]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMentionSelect = (member: any) => {
    const lastAtSymbolIndex = content.lastIndexOf('@');
    const newContent = content.slice(0, lastAtSymbolIndex) + `@${member.username} `;
    setContent(newContent);
    if (!mentions.includes(member.id)) {
      setMentions([...mentions, member.id]);
    }
    setShowMentions(false);
    textInputRef.current?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = content.trim();
    if (!payload) return;

    await sendPayload(payload);
    setContent('');
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt không hỗ trợ định vị', 'error');
      return;
    }

    const options = {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60000,
    };

    const socket = getSocket();

    const success = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      socket.emit('send-message', {
        roomId: currentRoomId,
        content: `${latitude},${longitude}`,
        type: 'location',
      });
    };

    const finalizeFailure = (error: GeolocationPositionError) => {
      let errorMsg = 'Lỗi định vị';
      if (error.code === 1) errorMsg = 'Vui lòng cấp quyền truy cập vị trí';
      else if (error.code === 2) errorMsg = 'Vị trí hiện không khả dụng (Hãy kiểm tra cài đặt GPS của thiết bị/trình duyệt)';
      else if (error.code === 3) errorMsg = 'Hết thời gian tìm vị trí';
      showToast(errorMsg + ': ' + error.message, 'error');
    };

    navigator.geolocation.getCurrentPosition(
      success,
      finalizeFailure,
      options
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const socket = getSocket();
      
      const images: File[] = [];
      const videos: File[] = [];

      for (let file of files) {
        // Handle HEIC
        const isHEIC = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic';
        if (isHEIC) {
          try {
            const heic2any = (await import('heic2any')).default;
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.8
            });
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
          } catch (e) {
            console.error('HEIC conversion failed:', e);
            throw new Error(`Không thể chuyển đổi file HEIC: ${file.name}`);
          }
        }

        if (file.type.startsWith('image/')) {
          // Allow larger original, we will compress it
          if (file.size > 15 * 1024 * 1024) throw new Error(`Ảnh gốc quá lớn (>15MB): ${file.name}`);
          
          try {
            const options = {
              maxSizeMB: 1, // Compress to ~1MB
              maxWidthOrHeight: 1600,
              useWebWorker: true,
            };
            const imageCompression = (await import('browser-image-compression')).default;
            const compressedFile = await imageCompression(file, options);
            file = new File([compressedFile], file.name, { type: compressedFile.type });
          } catch (error) {
            console.error('Compression failed:', error);
          }
          
          images.push(file);
        } else if (file.type.startsWith('video/')) {
          if (file.size > 10 * 1024 * 1024) throw new Error(`Video quá lớn (>10MB): ${file.name}`);
          videos.push(file);
        } else {
          throw new Error(`Định dạng không hỗ trợ: ${file.name}`);
        }
      }

      // Handle images
      if (images.length > 0) {
        const results = await Promise.all(images.map(f => messagesApi.uploadImage(f)));
        const urls = results.map(r => r.imageUrl);
        if (urls.length > 1) {
          socket.emit('send-message', { roomId: currentRoomId, content: JSON.stringify(urls), replyToMessageId: replyingTo?.id, type: 'album' });
        } else {
          socket.emit('send-message', { roomId: currentRoomId, content: urls[0], replyToMessageId: replyingTo?.id, type: 'image' });
        }
      }

      // Handle videos
      if (videos.length > 0) {
        for (const vid of videos) {
          const result = await messagesApi.uploadVideo(vid);
          socket.emit('send-message', { roomId: currentRoomId, content: result.videoUrl, replyToMessageId: replyingTo?.id, type: 'video' });
        }
      }

      setReplyingTo(null);
      setShouldJumpToLatest(true);
    } catch (error: any) {
      showToast(error.message || 'Upload thất bại', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-blue-100/70 p-2 max-[480px]:p-3 max-[420px]:p-2.5 max-[380px]:p-2 shadow-[0_-8px_24px_-20px_rgba(67,24,122,0.45)] dark:bg-slate-900 dark:border-slate-700">
      <form onSubmit={handleSend} className="flex flex-col gap-2">
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="overflow-hidden"
            >
              <div className="mb-2 w-full rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-slate-800 dark:text-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate mb-1">
                      Reply {replyingTo.sender?.username ? `to ${replyingTo.sender.username}` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const r = replyingTo;
                        const isImage = r.type === 'image' || (r.content && (
                          r.content.startsWith('data:image/') ||
                          /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(r.content) ||
                          /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(r.content)
                        ));
                        const isAlbum = r.type === 'album';

                        if (isImage && r.content) {
                          return <img width={400} height={400} src={r.content} alt="Preview" className="h-10 w-10 rounded-lg object-cover bg-gray-200 shrink-0 shadow-sm" />;
                        }
                        if (isAlbum && r.content) {
                          try {
                            const urls = JSON.parse(r.content);
                            return <img width={400} height={400} src={urls[0]} alt="Preview" className="h-10 w-10 rounded-lg object-cover bg-gray-200 shrink-0 shadow-sm" />;
                          } catch {
                            return null;
                          }
                        }
                        return null;
                      })()}

                      <p className="truncate opacity-80 text-[11px] min-w-0">
                        {(() => {
                          const r = replyingTo;
                          if (r.deleted_at) return 'Tin nhắn đã bị xóa';
                          const isImageOrAlbum = r.type === 'image' || r.type === 'album' || (r.content && (
                             r.content.startsWith('data:image/') ||
                             /\/uploads\/chat\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(r.content) ||
                             /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(r.content)
                          ));
                          
                          if (isImageOrAlbum) return '';

                          if (r.type === 'video') return '[Video]';
                          if (r.type === 'voice') return '[Tin nhắn thoại]';
                          if (r.type === 'call') {
                            return (r.content || '').includes(':video:') ? '[Cuộc gọi video]' : '[Cuộc gọi thoại]';
                          }
                          return r.content || 'Tin nhắn';
                        })()}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="shrink-0 rounded-full p-1 text-blue-700 hover:bg-blue-100 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors self-start"
                    title="Bỏ trả lời"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex w-full gap-2 max-[420px]:gap-1.5 max-[380px]:gap-1 items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        {!showRecorder && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!currentRoomId || isUploading || isAnyBlocked}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed group/tooltip relative"
            >
              <ImagePlus className="w-6 h-6 max-[420px]:w-5 max-[420px]:h-5" />
              <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                {isAnyBlocked ? "Bạn không thể gửi tin nhắn" : "Gửi ảnh/video"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowRecorder(true)}
              disabled={!currentRoomId || isUploading || isAnyBlocked}
              className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed group/tooltip relative"
            >
              <Mic className="w-6 h-6 max-[420px]:w-5 max-[420px]:h-5" />
              <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                {isAnyBlocked ? "Bạn không thể gửi tin nhắn" : "Tin nhắn thoại"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleSendLocation}
              disabled={!currentRoomId || isUploading || isAnyBlocked}
              className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed group/tooltip relative"
            >
              <MapPin className="w-6 h-6 max-[420px]:w-5 max-[420px]:h-5" />
              <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                {isAnyBlocked ? "Bạn không thể gửi tin nhắn" : "Gửi vị trí"}
              </span>
            </button>
          </div>
        )}

        {showRecorder ? (
          <div className="flex-1">
            <AudioRecorder 
              roomId={currentRoomId || ''} 
              onSuccess={() => setShowRecorder(false)} 
              onCancel={() => setShowRecorder(false)} 
            />
          </div>
        ) : (
          <>
          <div className="flex-1 relative">
            {isUploading && (
              <div className="absolute -top-7 left-2 flex items-center gap-1.5 px-2 py-0.5 bg-blue-50/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-t-lg border-x border-t border-blue-100 dark:border-slate-700 text-[10px] text-blue-600 dark:text-blue-400 font-bold animate-in fade-in slide-in-from-bottom-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Đang gửi...
              </div>
            )}
            <AnimatePresence>
                {showMentions && currentRoom?.is_group_chat && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50 flex flex-col max-h-48"
                  >
                    <div className="overflow-y-auto p-1 text-sm">
                      {roomMembers
                        .filter(m => m.id !== user?.id && m.username.toLowerCase().includes(mentionSearch.toLowerCase()))
                        .map(member => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleMentionSelect(member)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                              {member.avatar_url ? (
                                <img width={400} height={400} src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                                  {member.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{member.username}</span>
                          </button>
                        ))}
                      {roomMembers.filter(m => m.id !== user?.id && m.username.toLowerCase().includes(mentionSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-center">Không tìm thấy</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                ref={textInputRef}
                type="text"
                value={content}
                onChange={(e) => {
                  const val = e.target.value;
                  setContent(val);
                  handleTyping();
                  
                  const lastAt = val.lastIndexOf('@');
                  if (lastAt !== -1) {
                    const textAfterAt = val.slice(lastAt + 1);
                    if (!textAfterAt.includes(' ')) {
                      setShowMentions(true);
                      setMentionSearch(textAfterAt);
                    } else {
                      setShowMentions(false);
                    }
                  } else {
                    setShowMentions(false);
                  }
                }}
                placeholder={isAnyBlocked ? (isBlocked ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn") : "Nhập tin nhắn..."}
                disabled={!currentRoomId || isAnyBlocked}
                className="w-full px-5 py-2.5 max-[420px]:px-3 max-[420px]:py-2 rounded-full bg-white/95 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed text-black placeholder:text-gray-500 max-[420px]:text-sm dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
            </div>
            
            <button
              type="submit"
              disabled={!currentRoomId || isLoading || !content.trim() || isAnyBlocked}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition disabled:opacity-30 group/tooltip relative"
            >
              <Send className="w-6 h-6 max-[420px]:w-5 max-[420px]:h-5" />
              <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                Gửi tin nhắn
              </span>
            </button>
          </>
        )}
        </div>
      </form>
    </div>
  );
}
