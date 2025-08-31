import { useState, useEffect } from 'react';
import { apiClient } from '../../utils/api/client';
import type { 
  KnowledgeSearchQuery, 
  KnowledgeSearchResult, 
  KnowledgeSearchFilters,
  KnowledgeSearchSort 
} from '../../types/knowledge-base';

interface UseSearchProps {
  initialQuery?: string;
  initialFilters?: Partial<KnowledgeSearchFilters>;
  initialSort?: KnowledgeSearchSort;
  debounceMs?: number;
}

interface UseSearchReturn {
  searchResults: KnowledgeSearchResult;
  searchLoading: boolean;
  searchError: string | null;
  searchQuery: string;
  searchFilters: KnowledgeSearchFilters;
  searchSort: KnowledgeSearchSort;
  searchHistory: string[];
  searchKnowledge: (query: KnowledgeSearchQuery) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: KnowledgeSearchFilters) => void;
  setSearchSort: (sort: KnowledgeSearchSort) => void;
  clearSearch: () => void;
  addToHistory: (query: string) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
}

const defaultSearchResult: KnowledgeSearchResult = {
  documents: [],
  total: 0,
  page: 1,
  limit: 10,
  facets: {
    contentType: {},
    categories: {},
    tags: {},
    accessLevel: {},
    authors: {},
    dateRange: {
      min: new Date(),
      max: new Date(),
    },
  },
  query: '',
  processingTime: 0,
  suggestions: [],
};

export const useSearch = (props: UseSearchProps = {}): UseSearchReturn => {
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult>(defaultSearchResult);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(props.initialQuery || '');
  const [searchFilters, setSearchFilters] = useState<KnowledgeSearchFilters>(props.initialFilters || {});
  const [searchSort, setSearchSort] = useState<KnowledgeSearchSort>(
    props.initialSort || { field: 'relevance', order: 'desc' }
  );
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const debounceMs = props.debounceMs || 300;

  // Load search history from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('knowledge-search-history');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    } catch (err) {
      console.error('Error loading search history:', err);
    }
  }, []);

  // Save search history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('knowledge-search-history', JSON.stringify(searchHistory));
    } catch (err) {
      console.error('Error saving search history:', err);
    }
  }, [searchHistory]);

  const searchKnowledge = async (query: KnowledgeSearchQuery) => {
    try {
      setSearchLoading(true);
      setSearchError(null);

      const response = await apiClient.post('/knowledge-base/search', query);
      setSearchResults(response.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '搜索失败';
      setSearchError(errorMessage);
      console.error('Error searching knowledge base:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const debouncedSearch = (query: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    setDebounceTimer(
      setTimeout(() => {
        if (query.trim()) {
          searchKnowledge({
            query: query.trim(),
            filters: searchFilters,
            sortBy: searchSort,
            pagination: { page: 1, limit: 10 },
          });
        }
      }, debounceMs)
    );
  };

  const setSearchQuery = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const setSearchFilters = (filters: KnowledgeSearchFilters) => {
    setSearchFilters(filters);
    if (searchQuery.trim()) {
      searchKnowledge({
        query: searchQuery.trim(),
        filters,
        sortBy: searchSort,
        pagination: { page: 1, limit: 10 },
      });
    }
  };

  const setSearchSort = (sort: KnowledgeSearchSort) => {
    setSearchSort(sort);
    if (searchQuery.trim()) {
      searchKnowledge({
        query: searchQuery.trim(),
        filters: searchFilters,
        sortBy: sort,
        pagination: { page: 1, limit: 10 },
      });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchFilters({});
    setSearchSort({ field: 'relevance', order: 'desc' });
    setSearchResults(defaultSearchResult);
    setSearchError(null);
  };

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    
    setSearchHistory(prev => {
      // Remove if already exists
      const filtered = prev.filter(item => item !== query.trim());
      // Add to beginning
      return [query.trim(), ...filtered].slice(0, 10); // Keep only last 10
    });
  };

  const removeFromHistory = (query: string) => {
    setSearchHistory(prev => prev.filter(item => item !== query));
  };

  const clearHistory = () => {
    setSearchHistory([]);
  };

  return {
    searchResults,
    searchLoading,
    searchError,
    searchQuery,
    searchFilters,
    searchSort,
    searchHistory,
    searchKnowledge,
    setSearchQuery,
    setSearchFilters,
    setSearchSort,
    clearSearch,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
};