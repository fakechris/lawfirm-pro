"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useKnowledgeBase = void 0;
const react_1 = require("react");
const client_1 = require("../../utils/api/client");
const useKnowledgeBase = (props = {}) => {
    const [articles, setArticles] = (0, react_1.useState)([]);
    const [categories, setCategories] = (0, react_1.useState)([]);
    const [tags, setTags] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [filters, setFilters] = (0, react_1.useState)(props.initialFilters || {});
    const fetchArticles = async (newFilters) => {
        try {
            setLoading(true);
            setError(null);
            const finalFilters = { ...filters, ...newFilters };
            setFilters(finalFilters);
            const response = await client_1.apiClient.get('/knowledge-base/articles', {
                params: finalFilters,
            });
            setArticles(response.data.articles || []);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '获取文章失败';
            setError(errorMessage);
            console.error('Error fetching articles:', err);
        }
        finally {
            setLoading(false);
        }
    };
    const fetchCategories = async () => {
        try {
            const response = await client_1.apiClient.get('/knowledge-base/categories');
            setCategories(response.data.categories || []);
        }
        catch (err) {
            console.error('Error fetching categories:', err);
        }
    };
    const fetchTags = async () => {
        try {
            const response = await client_1.apiClient.get('/knowledge-base/tags');
            setTags(response.data.tags || []);
        }
        catch (err) {
            console.error('Error fetching tags:', err);
        }
    };
    const createArticle = async (data) => {
        try {
            setLoading(true);
            setError(null);
            const response = await client_1.apiClient.post('/knowledge-base/articles', data);
            const newArticle = response.data.article;
            setArticles(prev => [newArticle, ...prev]);
            return newArticle;
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '创建文章失败';
            setError(errorMessage);
            throw err;
        }
        finally {
            setLoading(false);
        }
    };
    const updateArticle = async (id, data) => {
        try {
            setLoading(true);
            setError(null);
            const response = await client_1.apiClient.put(`/knowledge-base/articles/${id}`, data);
            const updatedArticle = response.data.article;
            setArticles(prev => prev.map(article => article.id === id ? updatedArticle : article));
            return updatedArticle;
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '更新文章失败';
            setError(errorMessage);
            throw err;
        }
        finally {
            setLoading(false);
        }
    };
    const deleteArticle = async (id) => {
        try {
            setLoading(true);
            setError(null);
            await client_1.apiClient.delete(`/knowledge-base/articles/${id}`);
            setArticles(prev => prev.filter(article => article.id !== id));
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '删除文章失败';
            setError(errorMessage);
            throw err;
        }
        finally {
            setLoading(false);
        }
    };
    const refetch = async () => {
        await Promise.all([
            fetchArticles(),
            fetchCategories(),
            fetchTags(),
        ]);
    };
    (0, react_1.useEffect)(() => {
        fetchArticles();
        fetchCategories();
        fetchTags();
    }, []);
    return {
        articles,
        categories,
        tags,
        loading,
        error,
        fetchArticles,
        fetchCategories,
        fetchTags,
        createArticle,
        updateArticle,
        deleteArticle,
        refetch,
    };
};
exports.useKnowledgeBase = useKnowledgeBase;
//# sourceMappingURL=useKnowledgeBase.js.map