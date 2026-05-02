import useSWR from 'swr';
import { friendsApi } from '@/lib/api';

export function useFriends() {
  const { data, error, isLoading, mutate } = useSWR('friends', () => friendsApi.getFriendList());
  
  return {
    friendsData: (data as any[]) || [],
    isLoadingFriends: isLoading,
    friendsError: error,
    mutateFriends: mutate
  };
}
