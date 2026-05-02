import useSWR from 'swr';
import { roomsApi, Room } from '@/lib/api';

export function useRooms() {
  const { data, error, isLoading, mutate } = useSWR<Room[]>('rooms', () => roomsApi.getRooms());
  
  return {
    roomsData: data || [],
    isLoadingRooms: isLoading,
    roomsError: error,
    mutateRooms: mutate
  };
}
