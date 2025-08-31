"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSearch = void 0;
const react_1 = require("react");
const client_1 = require("../../utils/api/client");
const defaultSearchResult = {
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
const useSearch = (props = {}) => {
    const [searchResults, setSearchResults] = (0, react_1.useState)(defaultSearchResult);
    const [searchLoading, setSearchLoading] = (0, react_1.useState)(false);
    const [searchError, setSearchError] = (0, react_1.useState)(null);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)(props.initialQuery || '');
    const [searchFilters, setSearchFilters] = (0, react_1.useState)(props.initialFilters || {});
    const [searchSort, setSearchSort] = (0, react_1.useState)(props.initialSort || { field: 'relevance', order: 'desc' });
    const [searchHistory, setSearchHistory] = (0, react_1.useState)([]);
    const [debounceTimer, setDebounceTimer] = (0, react_1.useState)(null);
    const debounceMs = props.debounceMs || 300;
    (0, react_1.useEffect)(() => {
        try {
            const savedHistory = localStorage.getItem('knowledge-search-history');
            if (savedHistory) {
                setSearchHistory(JSON.parse(savedHistory));
            }
        }
        catch (err) {
            console.error('Error loading search history:', err);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        try {
            localStorage.setItem('knowledge-search-history', JSON.stringify(searchHistory));
        }
        catch (err) {
            console.error('Error saving search history:', err);
        }
    }, [searchHistory]);
    const searchKnowledge = async (query) => {
        try {
            setSearchLoading(true);
            setSearchError(null);
            const response = await client_1.apiClient.post('/knowledge-base/search', query);
            setSearchResults(response.data);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '搜索失败';
            setSearchError(errorMessage);
            console.error('Error searching knowledge base:', err);
        }
        finally {
            setSearchLoading(false);
        }
    };
    const debouncedSearch = (query) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        setDebounceTimer(setTimeout(() => {
            if (query.trim()) {
                searchKnowledge({
                    query: query.trim(),
                    filters: searchFilters,
                    sortBy: searchSort,
                    pagination: { page: 1, limit: 10 },
                });
            }
        }, debounceMs));
    };
    const setSearchQuery = (query) => {
        setSearchQuery(query);
        debouncedSearch(query);
    };
    const setSearchFilters = (filters) => {
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
    const setSearchSort = (sort) => {
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
    const addToHistory = (query) => {
        if (!query.trim())
            return;
        setSearchHistory(prev => {
            const filtered = prev.filter(item => item !== query.trim());
            return [query.trim(), ...filtered].slice(0, 10);
        });
    };
    const removeFromHistory = (query) => {
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
exports.useSearch = useSearch;
//# sourceMappingURL=useSearch.js.map