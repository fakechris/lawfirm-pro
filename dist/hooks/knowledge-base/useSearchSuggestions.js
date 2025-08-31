"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSearchSuggestions = void 0;
const react_1 = require("react");
const client_1 = require("../../utils/api/client");
const useSearchSuggestions = (query, props = {}) => {
    const [suggestions, setSuggestions] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [debounceTimer, setDebounceTimer] = (0, react_1.useState)(null);
    const debounceMs = props.debounceMs || 300;
    const minQueryLength = props.minQueryLength || 2;
    const maxSuggestions = props.maxSuggestions || 10;
    (0, react_1.useEffect)(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        if (query.length < minQueryLength) {
            setSuggestions([]);
            setLoading(false);
            setError(null);
            return;
        }
        setDebounceTimer(setTimeout(async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await client_1.apiClient.get('/knowledge-base/search/suggestions', {
                    params: {
                        query: query.trim(),
                        limit: maxSuggestions,
                    },
                });
                setSuggestions(response.data.suggestions || []);
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : '获取搜索建议失败';
                setError(errorMessage);
                console.error('Error fetching search suggestions:', err);
                setSuggestions([]);
            }
            finally {
                setLoading(false);
            }
        }, debounceMs));
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
exports.useSearchSuggestions = useSearchSuggestions;
//# sourceMappingURL=useSearchSuggestions.js.map