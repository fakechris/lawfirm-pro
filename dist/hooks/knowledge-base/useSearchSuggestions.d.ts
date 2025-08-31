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
export declare const useSearchSuggestions: (query: string, props?: UseSearchSuggestionsProps) => UseSearchSuggestionsReturn;
export {};
//# sourceMappingURL=useSearchSuggestions.d.ts.map