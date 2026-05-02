'use client';

import { createContext, useContext } from 'react';

interface RoomListContextType {
  search: string;
  setSearch: (val: string) => void;
  debouncedSearch: string;
  tab: 'chats' | 'friends';
  setTab: (val: 'chats' | 'friends') => void;
  chatFilter: 'all' | 'unread' | 'groups';
  setChatFilter: (val: 'all' | 'unread' | 'groups') => void;
  showRequests: boolean;
  setShowRequests: (val: boolean) => void;
  friends: any[];
  setFriends: (val: any[]) => void;
  pendingRequests: any[];
  setPendingRequests: (val: any[]) => void;
  isLoading: boolean;
  onRoomSelected?: () => void;
  getRoomDisplayName: (room: any) => string;
}

const RoomListContext = createContext<RoomListContextType | undefined>(undefined);

export function RoomListProvider({ children, value }: { children: React.ReactNode, value: RoomListContextType }) {
  return (
    <RoomListContext.Provider value={value}>
      {children}
    </RoomListContext.Provider>
  );
}

export function useRoomList() {
  const context = useContext(RoomListContext);
  if (!context) {
    throw new Error('useRoomList must be used within a RoomListProvider');
  }
  return context;
}
