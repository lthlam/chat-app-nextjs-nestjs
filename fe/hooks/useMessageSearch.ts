import { useState, useEffect, useCallback, useDeferredValue } from 'react';
import { messagesApi, Message } from '@/lib/api';

export function useMessageSearch(currentRoomId: string | null, handleJumpToMessage: (id: string) => void) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState<number>(-1);
  const [isPinnedListOpen, setIsPinnedListOpen] = useState(false);

  // Reset search when room changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setActiveSearchResultIndex(-1);
  }, [currentRoomId]);

  useEffect(() => {
    if (!currentRoomId || !deferredSearchQuery) {
      setSearchResults([]);
      setActiveSearchResultIndex(-1);
      return;
    }

    const runSearch = async () => {
      try {
        const results = await messagesApi.searchMessages(currentRoomId, deferredSearchQuery);
        const sorted = [...results].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setSearchResults(sorted);
        if (sorted.length > 0) {
          setActiveSearchResultIndex(0);
          setTimeout(() => handleJumpToMessage(sorted[0].id), 0);
        }
      } catch (e) {
        console.error('Search failed', e);
      }
    };
    runSearch();
  }, [currentRoomId, deferredSearchQuery, handleJumpToMessage]);

  const navigateSearchResult = useCallback((dir: 'prev' | 'next') => {
    if (searchResults.length === 0) return;
    setActiveSearchResultIndex(prev => {
      const idx = dir === 'next' ? (prev + 1) % searchResults.length : (prev - 1 + searchResults.length) % searchResults.length;
      handleJumpToMessage(searchResults[idx].id);
      return idx;
    });
  }, [searchResults, handleJumpToMessage]);

  return {
    searchQuery, setSearchQuery,
    deferredSearchQuery,
    searchResults, setSearchResults,
    activeSearchResultIndex, setActiveSearchResultIndex,
    isPinnedListOpen, setIsPinnedListOpen,
    navigateSearchResult,
  };
}
