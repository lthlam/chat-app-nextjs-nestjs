import { create } from 'zustand';
import { Room, Message } from '@/lib/api';

export interface ChatStoreState {
  rooms: Room[];
  messages: Message[];
  currentRoomId: string | null;
  replyingTo: Message | null;
  typingUsers: Set<string>;
  isLoading: boolean;
  pendingJumpMessageId: string | null;
  pinnedMessages: Message[];
  shouldJumpToLatest: boolean;
  isSearchOpen: boolean;
  selectedUserProfileUser: any | null;

  setSelectedUserProfileUser: (user: any | null) => void;
  setRooms: (rooms: Room[] | ((prev: Room[]) => Room[])) => void;
  addRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  addMessage: (message: Message) => void;
  setReplyingTo: (message: Message | null) => void;
  markRoomAsRead: (roomId: string) => void;
  setCurrentRoomId: (roomId: string | null) => void;
  setTypingUsers: (users: Set<string>) => void;
  setIsLoading: (loading: boolean) => void;
  setPendingJumpMessageId: (id: string | null) => void;
  setPinnedMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setShouldJumpToLatest: (val: boolean) => void;
  setIsSearchOpen: (val: boolean) => void;
  updateUserStatus: (userId: string, status: 'online' | 'offline' | 'away', last_seen?: string) => void;
  clearedAtByRoom: Map<string, number>;
  setClearedAt: (roomId: string, ts: number) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  rooms: [],
  messages: [],
  currentRoomId: null,
  replyingTo: null,
  typingUsers: new Set(),
  isLoading: false,
  pendingJumpMessageId: null,
  pinnedMessages: [],
  shouldJumpToLatest: false,
  isSearchOpen: false,
  selectedUserProfileUser: null,
  clearedAtByRoom: new Map<string, number>(),

  setSelectedUserProfileUser: (user) => set({ selectedUserProfileUser: user }),
  setRooms: (rooms: Room[] | ((prev: Room[]) => Room[])) =>
    set((state) => ({
      rooms:
        typeof rooms === 'function'
          ? (rooms as (prev: Room[]) => Room[])(state.rooms)
          : rooms,
    })),
  addRoom: (room: Room) => set((state) => {
    const exists = state.rooms.some(r => r.id === room.id);
    if (exists) return state;
    return { rooms: [room, ...state.rooms] };
  }),
  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter((room) => String(room.id) !== String(roomId)),
      currentRoomId:
        state.currentRoomId && String(state.currentRoomId) === String(roomId)
          ? null
          : state.currentRoomId,
      messages:
        state.currentRoomId && String(state.currentRoomId) === String(roomId)
          ? []
          : state.messages,
    })),
  setMessages: (messages) =>
    set((state) => {
      const nextMessages = typeof messages === 'function'
        ? (messages as (prev: Message[]) => Message[])(state.messages)
        : messages;
      
      const uniqueMessages = Array.from(new Map(nextMessages.map(m => [m.id, m])).values());
      return { messages: uniqueMessages };
    }),
  addMessage: (message) => set((state) => {
    const exists = state.messages.some(m => m.id === message.id);
    if (exists) return state;
    return { messages: [...state.messages, message] };
  }),
  setReplyingTo: (message) => set({ replyingTo: message }),
  markRoomAsRead: (roomId) =>
    set((state) => ({
      rooms: state.rooms.map((room) => {
        if (String(room.id) !== String(roomId) || !room.last_message) {
          return room;
        }

        return {
          ...room,
          last_message: {
            ...room.last_message,
            is_unread_for_me: false,
          },
        };
      }),
    })),
  setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),
  setTypingUsers: (users) => set({ typingUsers: users }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setPendingJumpMessageId: (id) => set({ pendingJumpMessageId: id }),
  setPinnedMessages: (pinnedMessages) =>
    set((state) => {
      const nextPinned = typeof pinnedMessages === 'function'
        ? (pinnedMessages as (prev: Message[]) => Message[])(state.pinnedMessages)
        : pinnedMessages;
      
      const uniquePinned = Array.from(new Map(nextPinned.map(m => [m.id, m])).values());
      return { pinnedMessages: uniquePinned };
    }),
  setShouldJumpToLatest: (val) => set({ shouldJumpToLatest: val }),
  setIsSearchOpen: (val) => set({ isSearchOpen: val }),
  setClearedAt: (roomId, ts) => set((state) => {
    const next = new Map(state.clearedAtByRoom);
    next.set(String(roomId), ts);
    return { clearedAtByRoom: next };
  }),
  updateUserStatus: (userId, status, last_seen) => set((state) => ({
    rooms: state.rooms.map(room => {
      if (!room.members) return room;
      const hasMember = room.members.some(m => String(m.id) === String(userId));
      if (!hasMember) return room;
      
      return {
        ...room,
        members: room.members.map(m => 
          String(m.id) === String(userId) ? { ...m, status, last_seen } : m
        )
      };
    })
  })),
  reset: () => set({
    rooms: [],
    messages: [],
    currentRoomId: null,
    replyingTo: null,
    typingUsers: new Set(),
    isLoading: false,
    pendingJumpMessageId: null,
    pinnedMessages: [],
    shouldJumpToLatest: false,
    isSearchOpen: false,
    selectedUserProfileUser: null,
    clearedAtByRoom: new Map(),
  }),
}));

