// Type definitions
export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'away';
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Room {
  id: string;
  name?: string;
  is_group_chat: boolean;
  cleared_at?: string;
  avatar_url?: string;
  owner?: { id: string; username: string };
  members?: any[];
  members_count?: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_id?: string;
    sender_name?: string;
    is_unread_for_me?: boolean;
  } | null;
  created_at: string;
}

export interface Message {
  id: string;
  roomId: string;
  sender: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  content: string;
  type: 'text' | 'image' | 'call' | 'voice' | 'album' | 'video' | 'location';
  reply_to?: {
    id: string;
    content: string;
    type: 'text' | 'image' | 'call' | 'voice' | 'album' | 'video' | 'location';
    deleted_at?: string;
    sender?: {
      id: string;
      username: string;
      avatar_url?: string;
    };
    created_at: string;
  } | null;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  delivered_at?: string;
  is_pinned?: boolean;
  reactions?: Array<{
    id: string;
    emoji: string;
    user: {
      id: string;
      username: string;
    };
  }>;
  reads?: Array<{
    id: string;
    read_at: string;
    user: {
      id: string;
      username: string;
      avatar_url?: string;
    };
  }>;
  is_forwarded?: boolean;
  mentions?: Array<Omit<User, 'email' | 'status'>>;
}

export async function apiCall<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (!apiUrl) {
    console.error('❌ NEXT_PUBLIC_API_URL is not defined!');
  }

  const fullUrl = `${apiUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (response.status === 401 && !url.includes('/auth/login')) {
    console.warn('🔑 Token expired or unauthorized. Logging out...');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/auth/login';
    }
  }

  const responseText = await response.text();

  if (!response.ok) {
    let errorMessage = `API Error (${response.status})`;
    try {
      if (responseText) {
        const error = JSON.parse(responseText);
        errorMessage = error.message || errorMessage;
      }
    } catch (e) {
      console.error('❌ Error parsing error response:', e);
    }
    console.error('❌ API Error Detail:', responseText);
    throw new Error(errorMessage);
  }

  return responseText ? JSON.parse(responseText) : (null as any);
}

// Auth API calls
export const authApi = {
  register: (username: string, email: string, password: string) =>
    apiCall<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  login: (email: string, password: string) =>
    apiCall<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// Users API calls
export const usersApi = {
  getProfile: (userId: string) =>
    apiCall<User>(`/users/${userId}`),

  updateProfile: (userId: string, data: any) =>
    apiCall<User>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (userId: string, currentPassword: string, newPassword: string) =>
    apiCall<{ message: string }>(`/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  search: (query: string) =>
    apiCall<User[]>(`/users/search?q=${encodeURIComponent(query)}`),

  findExact: (query: string) =>
    apiCall<User | null>(`/users/find-exact?q=${encodeURIComponent(query)}`),

  blockUser: (userId: string) =>
    apiCall(`/users/${userId}/block`, {
      method: 'POST',
    }),

  unblockUser: (userId: string) =>
    apiCall(`/users/${userId}/block`, {
      method: 'DELETE',
    }),

  getBlockedUsers: () =>
    apiCall<User[]>('/users/blocked/list'),

  getBlockedByUsers: () =>
    apiCall<User[]>('/users/blocked-by/list'),
};

// Rooms API calls
export const roomsApi = {
  getRooms: () =>
    apiCall<Room[]>('/rooms'),

  getRoom: (roomId: string) =>
    apiCall<Room>(`/rooms/${roomId}`),

  createRoom: (data: any) =>
    apiCall<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRoom: (roomId: string, data: any) =>
    apiCall<Room>(`/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRoom: (roomId: string) =>
    apiCall<void>(`/rooms/${roomId}`, {
      method: 'DELETE',
    }),

  addMember: (roomId: string, userId: string) =>
    apiCall<User>(`/rooms/${roomId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  removeMember: (roomId: string, userId: string) =>
    apiCall(`/rooms/${roomId}/members/${userId}`, {
      method: 'DELETE',
    }),

  getMembers: (roomId: string) =>
    apiCall<User[]>(`/rooms/${roomId}/members`),

  leaveRoom: (roomId: string) =>
    apiCall(`/rooms/${roomId}/leave`, {
      method: 'POST',
    }),

  clearHistory: (roomId: string) =>
    apiCall(`/rooms/${roomId}/history`, {
      method: 'DELETE',
    }),

  getIceServers: () =>
    apiCall<any[]>('/webrtc/ice-servers'),
};

export const messagesApi = {
  getMessages: (roomId: string, limit = 50, beforeId?: string, afterId?: string) => {
    const url = `/messages/${roomId}?limit=${limit}` + 
      (beforeId ? `&beforeId=${beforeId}` : '') + 
      (afterId ? `&afterId=${afterId}` : '');
    return apiCall<{ 
      data: Message[]; 
      pagination: { 
        limit: number; 
        olderCursor?: string; 
        newerCursor?: string;
        hasOlder?: boolean;
        hasNewer?: boolean;
      } 
    }>(url);
  },

  getMessagesAround: (
    roomId: string, 
    messageId: string, 
    limit = 40,
    direction: 'around' | 'forward' | 'backward' = 'around'
  ) =>
    apiCall<{ 
      data: Message[]; 
      pagination: { 
        limit: number; 
        olderCursor?: string; 
        newerCursor?: string;
        hasOlder: boolean;
        hasNewer: boolean;
      } 
    }>(`/messages/${roomId}/around/${messageId}?limit=${limit}&direction=${direction}`),

  markRoomAsSeen: (roomId: string) =>
    apiCall<{
      roomId: string;
      user: { id: string; username: string; avatar_url?: string } | null;
      updatedMessages: Message[];
    }>(`/messages/${roomId}/read`, {
      method: 'POST',
    }),

  markAsDelivered: (messageId: string) =>
    apiCall<Message>(`/messages/${messageId}/delivered`, {
      method: 'POST',
    }),

  searchMessages: (roomId: string, query: string) =>
    apiCall<Message[]>(`/messages/${roomId}/search?q=${encodeURIComponent(query)}`),

  globalSearch: (query: string) =>
    apiCall<Message[]>(`/messages/global-search?q=${encodeURIComponent(query)}`),

  getPinnedMessages: (roomId: string) =>
    apiCall<Message[]>(`/messages/${roomId}/pinned`),

  sendMessage: (roomId: string, content: string, replyToMessageId?: string, type: Message['type'] = 'text') =>
    apiCall<Message>(`/messages/${roomId}`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToMessageId, type }),
    }),

  uploadImage: async (file: File): Promise<{ imageUrl: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/auth/login';
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  uploadVoice: async (blob: Blob): Promise<{ voiceUrl: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', blob, 'voice.webm');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/upload-voice`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/auth/login';
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  uploadVideo: async (file: File): Promise<{ videoUrl: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/upload-video`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/auth/login';
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  editMessage: (messageId: string, content: string) =>
    apiCall<Message>(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (messageId: string) =>
    apiCall<void>(`/messages/${messageId}`, {
      method: 'DELETE',
    }),

  addReaction: (messageId: string, emoji: string) =>
    apiCall(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  removeReaction: (reactionId: string) =>
    apiCall<void>(`/messages/reactions/${reactionId}`, {
      method: 'DELETE',
    }),

  pinMessage: (messageId: string) =>
    apiCall(`/messages/${messageId}/pin`, {
      method: 'POST',
    }),

  unpinMessage: (messageId: string) =>
    apiCall(`/messages/${messageId}/pin`, {
      method: 'DELETE',
    }),

  getMedia: (roomId: string) =>
    apiCall<Message[]>(`/messages/${roomId}/media`),

  getLinkPreview: (url: string) =>
    apiCall<{ url: string; title: string; description: string; image: string; siteName: string }>(
      `/messages/link-preview?url=${encodeURIComponent(url)}`,
    ),
};

// Friends API calls
export const friendsApi = {
  sendRequest: (userId: string) =>
    apiCall(`/friends/request/${userId}`, {
      method: 'POST',
    }),

  getPending: () =>
    apiCall('/friends/pending'),

  acceptRequest: (requestId: string) =>
    apiCall(`/friends/request/${requestId}/accept`, {
      method: 'PUT',
    }),

  rejectRequest: (requestId: string) =>
    apiCall(`/friends/request/${requestId}/reject`, {
      method: 'PUT',
    }),

  getFriendList: () =>
    apiCall('/friends/list'),

  checkFriend: (userId: string) =>
    apiCall<{ areFriends: boolean }>(`/friends/check/${userId}`),

  checkStatus: (userId: string) =>
    apiCall<{ isFriend: boolean; isPending: boolean }>(`/friends/status/${userId}`),

  removeFriend: (userId: string) =>
    apiCall<{ message: string }>(`/friends/${userId}`, {
      method: 'DELETE',
    }),
};
