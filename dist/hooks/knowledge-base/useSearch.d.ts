import type { KnowledgeSearchQuery, KnowledgeSearchResult, KnowledgeSearchFilters, KnowledgeSearchSort } from '../../types/knowledge-base';
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
export declare const useSearch: (props?: UseSearchProps) => UseSearchReturn;
export {};
//# sourceMappingURL=useSearch.d.ts.map