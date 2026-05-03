'use client';

import { useState, useEffect } from 'react';
import { X, LogOut, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { roomsApi, friendsApi, User } from '@/lib/api';
import {
  GroupSettingsInfoTab,
  GroupMembersTab,
  GroupAddTab,
  GroupRemoveTab,
} from '@/features/room/GroupSettingsTabs';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { getSocket } from '@/lib/socket';

interface GroupSettingsModalProps {
  roomId: string | null;
  roomName: string | null;
  roomAvatar: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLeaveSuccess?: () => void;
}

export function GroupSettingsModal({
  roomId,
  roomName,
  roomAvatar,
  isOpen,
  onClose,
  onLeaveSuccess,
}: GroupSettingsModalProps) {
  const setCurrentRoomId = useChatStore(s => s.setCurrentRoomId);
  const setRooms = useChatStore(s => s.setRooms);
  const rooms = useChatStore(s => s.rooms);
  const user = useAuthStore(s => s.user);
  const showToast = useUiStore((state) => state.showToast);
  const requestConfirm = useUiStore((state) => state.requestConfirm);
  const [members, setMembers] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingFriendIds, setPendingFriendIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingGroupInfo, setIsSavingGroupInfo] = useState(false);
  const [tab, setTab] = useState<'members' | 'add' | 'remove' | 'settings'>('settings');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('');
  const currentRoom = rooms.find((room) => String(room.id) === String(roomId));
  const isOwner = String((currentRoom as any)?.owner?.id || '') === String(user?.id || '');
  const ownerId = String((currentRoom as any)?.owner?.id || '');

  useEffect(() => {
    if (!isOpen || !roomId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const membersList = await roomsApi.getMembers(roomId);
        setMembers(membersList);

        const friendsList = (await friendsApi.getFriendList()) as any as User[];
        setFriendIds(new Set((friendsList || []).map((friend) => String(friend.id))));
        // Filter out members already in the room
        const nonMembers = (friendsList || []).filter(
          (f) => !membersList.find((m) => m.id === f?.id),
        );
        setFriends(nonMembers);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, roomId]);

  useEffect(() => {
    if (!isOpen) return;
    setNewGroupName(roomName || '');
    setGroupAvatarUrl(roomAvatar || '');
  }, [isOpen, roomName, roomAvatar]);

  const groupDisplayName = (newGroupName || roomName || 'Nhom').trim();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Anh qua lon (toi da 5MB).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setGroupAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateGroupInfo = async () => {
    if (!roomId) return;
    if (!newGroupName.trim()) {
      showToast('Ten nhom khong duoc de trong.', 'error');
      return;
    }

    try {
      setIsSavingGroupInfo(true);
      const updatedRoom = await roomsApi.updateRoom(roomId, {
        name: newGroupName.trim(),
        avatar_url: groupAvatarUrl.trim() || null,
      });

      setRooms((prevRooms: any[]) =>
        prevRooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                name: updatedRoom.name,
                avatar_url: (updatedRoom as any).avatar_url,
              }
            : room,
        ),
      );
      showToast('Cap nhat thong tin nhom thanh cong.', 'success');
    } catch (error) {
      console.error('Failed to update group info:', error);
      showToast('Cap nhat thong tin nhom that bai.', 'error');
    } finally {
      setIsSavingGroupInfo(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!roomId) return;
    if (!isOwner) {
      showToast('Chi chu nhom moi co quyen xoa thanh vien.', 'error');
      return;
    }
    if (String(userId) === String(user?.id)) {
      showToast('Ban khong the tu kick chinh minh. Hay dung nut roi nhom.', 'info');
      return;
    }

    const targetMember = members.find((member) => member.id === userId);
    const accepted = await requestConfirm({
      title: 'Xoa thanh vien',
      message: `Ban co chac chan muon xoa ${targetMember?.username || 'thanh vien'} khoi nhom?`,
      confirmText: 'Xoa',
      cancelText: 'Huy',
    });
    if (!accepted) return;

    try {
      await roomsApi.removeMember(roomId, userId);
      setMembers(members.filter((m) => m.id !== userId));
      setRooms((prevRooms: any[]) =>
        prevRooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                members_count: Math.max((room.members_count || members.length) - 1, 0),
              }
            : room,
        ),
      );
      // Add to friends list
      if (targetMember) setFriends([...friends, targetMember]);
      showToast('Da xoa thanh vien khoi nhom.', 'success');
    } catch (error) {
      console.error('Failed to remove member:', error);
      showToast('Xoa thanh vien that bai.', 'error');
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!roomId) return;
    try {
      await roomsApi.addMember(roomId, userId);
      const user = friends.find((f) => f.id === userId);
      if (user) {
        setMembers([...members, user]);
        setFriends(friends.filter((f) => f.id !== userId));
        setRooms((prevRooms: any[]) =>
          prevRooms.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  members_count: (room.members_count || members.length) + 1,
                }
              : room,
          ),
        );
        showToast('Da them thanh vien vao nhom.', 'success');
      }
    } catch (error) {
      console.error('Failed to add member:', error);
      showToast('Them thanh vien that bai.', 'error');
    }
  };

  const handleSendFriendRequest = async (targetUserId: string, username: string) => {
    if (!targetUserId || String(targetUserId) === String(user?.id)) return;

    try {
      await friendsApi.sendRequest(targetUserId);
      setPendingFriendIds((prev) => {
        const next = new Set(prev);
        next.add(String(targetUserId));
        return next;
      });
      showToast(`Da gui loi moi ket ban toi ${username}.`, 'success');
    } catch (error: any) {
      const message = String(error?.message || 'Gui loi moi ket ban that bai.');
      showToast(message, 'error');
    }
  };

  const handleLeaveRoom = async () => {
    if (!roomId) return;

    const accepted = await requestConfirm({
      title: 'Roi nhom',
      message: 'Ban co chac chan muon roi nhom nay?',
      confirmText: 'Roi nhom',
      cancelText: 'O lai',
    });
    if (!accepted) return;

    try {
      await roomsApi.leaveRoom(roomId);
      // Remove room from list
      setRooms(rooms.filter((r) => r.id !== roomId));
      setCurrentRoomId(null);
      onLeaveSuccess?.();
      onClose();
      showToast('Ban da roi nhom.', 'success');
    } catch (error) {
      console.error('Failed to leave room:', error);
      showToast('Khong the roi nhom luc nay.', 'error');
    }
  };

  useEffect(() => {
    if (!isOpen || !roomId) return;

    const socket = getSocket();
    
    const onMemberAdded = (payload: { roomId: string; user: User }) => {
      if (String(payload.roomId) === String(roomId)) {
        setMembers(prev => {
          if (prev.some(m => m.id === payload.user.id)) return prev;
          return [...prev, payload.user];
        });
        setFriends(prev => prev.filter(f => f.id !== payload.user.id));
      }
    };

    const onMemberRemoved = (payload: { roomId: string; userId: string; newOwner?: User }) => {
      if (String(payload.roomId) === String(roomId)) {
        setMembers(prev => prev.filter(m => String(m.id) !== String(payload.userId)));
        
        // Globally update the room info (owner, members count)
        setRooms(prev => prev.map(r => {
          if (String(r.id) !== String(payload.roomId)) return r;
          return {
            ...r,
            owner: payload.newOwner || r.owner,
            members_count: Math.max((r.members_count || 0) - 1, 0)
          };
        }));
      }
    };

    socket.on('room-member-added', onMemberAdded);
    socket.on('room-member-removed', onMemberRemoved);

    return () => {
      socket.off('room-member-added', onMemberAdded);
      socket.off('room-member-removed', onMemberRemoved);
    };
  }, [isOpen, roomId, setRooms]);

  if (!roomId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between bg-blue-50/80 p-4 dark:bg-slate-800/90 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Cài đặt nhóm</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 transition hover:bg-blue-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-300" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Group info */}
          <div className="bg-blue-50/70 px-4 py-4 dark:bg-slate-800/70">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <Avatar 
                  src={groupAvatarUrl || '/group.png'} 
                  name={groupDisplayName} 
                  size={80} 
                  className="ring-4 ring-blue-50 dark:ring-slate-800 shadow-lg" 
                />
                {tab === 'settings' && (
                  <>
                    <input
                      id="group-avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="group-avatar-upload"
                      className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl transition hover:bg-violet-700 cursor-pointer border-2 border-white dark:border-slate-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                        Chọn ảnh nhóm
                      </span>
                    </label>
                  </>
                )}
              </div>
              <h3 className="font-bold text-gray-900 dark:text-slate-100">{roomName || 'Nhóm chưa đặt tên'}</h3>
            </div>
            <p className="mt-1 text-center text-sm text-gray-600 dark:text-slate-300">{members.length} thành viên</p>
          </div>

          {/* Tabs */}
          <div className="sticky top-0 z-10 flex border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
            <button
              onClick={() => setTab('settings')}
              className={`flex-1 py-3 text-sm font-bold text-center transition ${
                tab === 'settings'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              Thông tin
            </button>
            <button
              onClick={() => setTab('members')}
              className={`flex-1 py-3 text-sm font-bold text-center transition ${
                tab === 'members'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              Thành viên
            </button>
            <button
              onClick={() => setTab('add')}
              className={`flex-1 py-3 text-sm font-bold text-center transition ${
                tab === 'add'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              Thêm
            </button>
            <button
              onClick={() => setTab('remove')}
              className={`flex-1 py-3 text-sm font-bold text-center transition ${
                tab === 'remove'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              Xóa
            </button>

            {/* Stable Underline Indicator */}
            <motion.div 
              className="absolute bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              initial={false}
              animate={{ 
                left: tab === 'settings' ? '0%' : tab === 'members' ? '25%' : tab === 'add' ? '50%' : '75%',
                width: '25%' 
              }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            />
          </div>

          {/* Tab Content */}
          <div className="p-4 overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {isLoading ? (
                  <div className="py-4 text-center text-gray-500 dark:text-slate-400">Đang tải…</div>
                ) : tab === 'settings' ? (
                  <GroupSettingsInfoTab
                    newGroupName={newGroupName}
                    setNewGroupName={setNewGroupName}
                    isSavingGroupInfo={isSavingGroupInfo}
                    handleUpdateGroupInfo={handleUpdateGroupInfo}
                  />
                ) : tab === 'members' ? (
                  <GroupMembersTab
                    members={members}
                    ownerId={ownerId}
                    user={user}
                    friendIds={friendIds}
                    pendingFriendIds={pendingFriendIds}
                    handleSendFriendRequest={handleSendFriendRequest}
                  />
                ) : tab === 'add' ? (
                  <GroupAddTab friends={friends} handleAddMember={handleAddMember} />
                ) : (
                  <GroupRemoveTab
                    isOwner={isOwner}
                    members={members}
                    ownerId={ownerId}
                    user={user}
                    handleRemoveMember={handleRemoveMember}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Leave button */}
        <div className="sticky bottom-0 bg-white/40 dark:bg-slate-900/40 p-4 backdrop-blur-md shrink-0 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleLeaveRoom}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 rounded-2xl font-bold transition shadow-sm"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            Rời nhóm
          </button>
        </div>


      </motion.div>
    </div>
  );
}

