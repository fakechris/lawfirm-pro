import { useState, useEffect } from 'react';
import { apiClient } from '../../utils/api/client';
import type { 
  KnowledgeBaseArticle, 
  KnowledgeBaseCategory, 
  KnowledgeArticleFilters 
} from '../../types/knowledge-base';

interface UseKnowledgeBaseProps {
  initialFilters?: Partial<KnowledgeArticleFilters>;
}

interface UseKnowledgeBaseReturn {
  articles: KnowledgeBaseArticle[];
  categories: KnowledgeBaseCategory[];
  tags: string[];
  loading: boolean;
  error: string | null;
  fetchArticles: (filters?: KnowledgeArticleFilters) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchTags: () => Promise<void>;
  createArticle: (data: any) => Promise<KnowledgeBaseArticle>;
  updateArticle: (id: string, data: any) => Promise<KnowledgeBaseArticle>;
  deleteArticle: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useKnowledgeBase = (props: UseKnowledgeBaseProps = {}): UseKnowledgeBaseReturn => {
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [categories, setCategories] = useState<KnowledgeBaseCategory[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Partial<KnowledgeArticleFilters>>(props.initialFilters || {});

  const fetchArticles = async (newFilters?: KnowledgeArticleFilters) => {
    try {
      setLoading(true);
      setError(null);
      
      const finalFilters = { ...filters, ...newFilters };
      setFilters(finalFilters);

      const response = await apiClient.get('/knowledge-base/articles', {
        params: finalFilters,
      });

      setArticles(response.data.articles || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取文章失败';
      setError(errorMessage);
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/knowledge-base/categories');
      setCategories(response.data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await apiClient.get('/knowledge-base/tags');
      setTags(response.data.tags || []);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  const createArticle = async (data: any): Promise<KnowledgeBaseArticle> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.post('/knowledge-base/articles', data);
      const newArticle = response.data.article;
      
      setArticles(prev => [newArticle, ...prev]);
      return newArticle;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建文章失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateArticle = async (id: string, data: any): Promise<KnowledgeBaseArticle> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.put(`/knowledge-base/articles/${id}`, data);
      const updatedArticle = response.data.article;
      
      setArticles(prev => 
        prev.map(article => 
          article.id === id ? updatedArticle : article
        )
      );
      
      return updatedArticle;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新文章失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteArticle = async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      await apiClient.delete(`/knowledge-base/articles/${id}`);
      
      setArticles(prev => prev.filter(article => article.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除文章失败';
      setError(errorMessage);
      throw err;
    } finally {
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

  useEffect(() => {
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