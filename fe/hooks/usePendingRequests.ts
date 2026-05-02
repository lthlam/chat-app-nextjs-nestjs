import useSWR from 'swr';
import { friendsApi } from '@/lib/api';

export function usePendingRequests() {
  const { data, error, isLoading, mutate } = useSWR('pendingRequests', () => friendsApi.getPending());
  
  return {
    pendingRequestsData: (data as any[]) || [],
    isLoadingPending: isLoading,
    pendingError: error,
    mutatePending: mutate
  };
}
