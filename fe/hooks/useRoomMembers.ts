import useSWR from 'swr';
import { roomsApi, User } from '@/lib/api';

export function useRoomMembers(roomId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<User[]>(
    roomId ? `rooms/${roomId}/members` : null,
    () => roomsApi.getMembers(roomId!)
  );
  
  return {
    membersData: data || [],
    isLoadingMembers: isLoading,
    membersError: error,
    mutateMembers: mutate
  };
}
