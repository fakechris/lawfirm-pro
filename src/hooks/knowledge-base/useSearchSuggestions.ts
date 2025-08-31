import { useState, useEffect } from 'react';
import { apiClient } from '../../utils/api/client';

interface UseSearchSuggestionsProps {
  debounceMs?: number;
  minQueryLength?: number;
  maxSuggestions?: number;
}

interface UseSearchSuggestionsReturn {
  suggestions: string[];
  loading: boolean;
  error: string | null;
}

export const useSearchSuggestions = (
  query: string,
  props: UseSearchSuggestionsProps = {}
): UseSearchSuggestionsReturn => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const debounceMs = props.debounceMs || 300;
  const minQueryLength = props.minQueryLength || 2;
  const maxSuggestions = props.maxSuggestions || 10;

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (query.length < minQueryLength) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setDebounceTimer(
      setTimeout(async () => {
        try {
          setLoading(true);
          setError(null);

          const response = await apiClient.get('/knowledge-base/search/suggestions', {
            params: {
              query: query.trim(),
              limit: maxSuggestions,
            },
          });

          setSuggestions(response.data.suggestions || []);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '获取搜索建议失败';
          setError(errorMessage);
          console.error('Error fetching search suggestions:', err);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs)
    );

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [query, debounceMs, minQueryLength, maxSuggestions]);

  return {
    suggestions,
    loading,
    error,
  };
};