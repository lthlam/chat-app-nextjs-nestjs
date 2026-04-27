'use client';

import { Save, UserPlus, UserCheck, Trash2 } from 'lucide-react';
import { User } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { Avatar } from './Avatar';

export function GroupSettingsInfoTab({
  newGroupName,
  setNewGroupName,
  isSavingGroupInfo,
  handleUpdateGroupInfo,
}: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-200">Tên nhóm mới</label>
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
          placeholder="Nhập tên nhóm"
        />
      </div>

      <div>
        <p className="text-xs text-gray-500 dark:text-slate-400">Bam nut but tai avatar de doi anh nhom. JPG/PNG, toi da 5MB.</p>
      </div>

      <button
        onClick={handleUpdateGroupInfo}
        disabled={isSavingGroupInfo || !newGroupName.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-slate-600"
      >
        <Save className="w-4 h-4" />
        {isSavingGroupInfo ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
    </div>
  );
}

export function GroupMembersTab({ members, ownerId, user, friendIds, pendingFriendIds, handleSendFriendRequest }: any) {
  const { setSelectedUserProfileUser } = useChatStore();

  if (members.length === 0) return <div className="text-center text-gray-500 text-sm py-4">Không có thành viên</div>;
  return (
    <>
      {members.map((member: User) => (
        <div key={member.id} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div 
            className={`flex items-center gap-3 flex-1 min-w-0 ${String(member.id) !== String(user?.id) ? 'cursor-pointer hover:opacity-80 transition group/member' : ''}`}
            onClick={() => String(member.id) !== String(user?.id) && setSelectedUserProfileUser(member)}
          >
            <Avatar 
              src={member.avatar_url} 
              name={member.username} 
              size="sm" 
            />
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-900 dark:text-slate-100 group-hover/member:text-blue-600 transition-colors">
                <span className="truncate">{member.username}</span>
                {String(member.id) === String(ownerId) && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">Owner</span>}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{member.status || 'offline'}</p>
            </div>
          </div>
          {String(member.id) !== String(user?.id) && !friendIds.has(String(member.id)) && !pendingFriendIds.has(String(member.id)) && (
            <button onClick={() => handleSendFriendRequest(member.id, member.username)} className="p-1.5 hover:bg-blue-100 rounded transition text-blue-600 group/tooltip relative">
              <UserPlus className="w-4 h-4" />
              <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                Kết bạn
              </span>
            </button>
          )}
          {String(member.id) !== String(user?.id) && (friendIds.has(String(member.id)) || pendingFriendIds.has(String(member.id))) && (
            <span className="p-1.5 text-green-600 group/tooltip relative">
              <UserCheck className="w-4 h-4" />
              <span className="pointer-events-none absolute top-full mt-2 right-0 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                Đã là bạn bè
              </span>
            </span>
          )}
        </div>
      ))}
    </>
  );
}

export function GroupAddTab({ friends, handleAddMember }: any) {
  if (friends.length === 0) return <div className="text-center text-gray-500 text-sm py-4">Tất cả bạn bè đã trong nhóm</div>;
  return (
    <>
      {friends.map((friend: User) => (
        <div key={friend.id} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div className="flex items-center gap-3 flex-1">
            <Avatar 
              src={friend.avatar_url} 
              name={friend.username} 
              size="sm" 
            />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{friend.username}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{friend.status || 'offline'}</p>
            </div>
          </div>
          <button onClick={() => handleAddMember(friend.id)} className="p-1.5 hover:bg-green-100 rounded transition text-green-600 group/tooltip relative">
            <UserPlus className="w-4 h-4" />
            <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
              Thêm thành viên
            </span>
          </button>
        </div>
      ))}
    </>
  );
}

export function GroupRemoveTab({ isOwner, members, ownerId, user, handleRemoveMember }: any) {
  if (!isOwner) return <div className="text-center text-gray-500 text-sm py-4">Chỉ owner mới có quyền xóa thành viên.</div>;
  if (members.length <= 1) return <div className="text-center text-gray-500 text-sm py-4">Không có thành viên nào để xóa.</div>;
  
  return (
    <>
      {members.map((member: User) => (
        <div key={member.id} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div className="flex items-center gap-3 flex-1">
            <Avatar 
              src={member.avatar_url} 
              name={member.username} 
              size="sm" 
            />
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                <span className="truncate">{member.username}</span>
                {String(member.id) === String(ownerId) && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">Owner</span>}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{member.status || 'offline'}</p>
            </div>
          </div>
          {String(member.id) !== String(user?.id) && (
            <button onClick={() => handleRemoveMember(member.id)} className="p-1.5 hover:bg-red-100 rounded transition text-red-600 group/tooltip relative">
              <Trash2 className="w-4 h-4" />
              <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100 z-50 dark:bg-slate-700">
                Xóa thành viên
              </span>
            </button>
          )}
        </div>
      ))}
    </>
  );
}
