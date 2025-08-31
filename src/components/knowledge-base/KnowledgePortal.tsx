import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeBase } from '../../hooks/knowledge-base/useKnowledgeBase';
import { useSearch } from '../../hooks/knowledge-base/useSearch';
import { useAuth } from '../../hooks/useAuth';
import { KnowledgeCard } from './KnowledgeCard';
import { SearchBar } from './SearchBar';
import { CategoryFilter } from './CategoryFilter';
import { TagFilter } from './TagFilter';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { Pagination } from '../common/Pagination';
import type { KnowledgeBaseArticle, KnowledgeSearchFilters } from '../../types/knowledge-base';

interface KnowledgePortalProps {
  className?: string;
}

export const KnowledgePortal: React.FC<KnowledgePortalProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    articles, 
    categories, 
    tags, 
    loading, 
    error, 
    fetchArticles, 
    fetchCategories, 
    fetchTags 
  } = useKnowledgeBase();
  
  const { 
    searchResults, 
    searchLoading, 
    searchError, 
    searchQuery, 
    searchFilters, 
    searchKnowledge, 
    setSearchQuery, 
    setSearchFilters 
  } = useSearch();

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'title' | 'views'>('relevance');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, [fetchCategories, fetchTags]);

  useEffect(() => {
    if (searchQuery) {
      searchKnowledge({
        query: searchQuery,
        filters: {
          ...searchFilters,
          categories: selectedCategory ? [selectedCategory] : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        },
        sortBy: { field: sortBy, order: 'desc' },
        pagination: { page: currentPage, limit: itemsPerPage },
        userId: user?.id,
      });
    } else {
      fetchArticles({
        category: selectedCategory,
        tags: selectedTags,
        sortBy,
        page: currentPage,
        limit: itemsPerPage,
      });
    }
  }, [
    searchQuery,
    selectedCategory,
    selectedTags,
    sortBy,
    currentPage,
    itemsPerPage,
    user?.id,
  ]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
    setCurrentPage(1);
  };

  const handleSortChange = (newSort: typeof sortBy) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const handleArticleClick = (article: KnowledgeBaseArticle) => {
    navigate(`/knowledge-base/${article.slug}`);
  };

  const displayArticles = searchQuery ? searchResults.documents : articles;
  const totalCount = searchQuery ? searchResults.total : articles.length;
  const isLoading = searchQuery ? searchLoading : loading;
  const displayError = searchQuery ? searchError : error;

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const getContentTypeLabel = (contentType: string) => {
    const labels: Record<string, string> = {
      BEST_PRACTICE: '最佳实践',
      CASE_STUDY: '案例分析',
      LEGAL_GUIDE: '法律指南',
      TEMPLATE: '模板',
      TRAINING_MATERIAL: '培训材料',
      POLICY: '政策',
      PROCEDURE: '程序',
      RESEARCH_NOTE: '研究笔记',
      LEGAL_OPINION: '法律意见',
      CHECKLIST: '清单',
      WORKFLOW: '工作流程',
      RESOURCE: '资源',
    };
    return labels[contentType] || contentType;
  };

  const getAccessLevelLabel = (accessLevel: string) => {
    const labels: Record<string, string> = {
      PUBLIC: '公开',
      INTERNAL: '内部',
      RESTRICTED: '受限',
      CONFIDENTIAL: '机密',
    };
    return labels[accessLevel] || accessLevel;
  };

  if (isLoading) {
    return (
      <div className={`flex justify-center items-center min-h-screen ${className}`}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (displayError) {
    return (
      <div className={`container mx-auto px-4 py-8 ${className}`}>
        <ErrorMessage 
          message={displayError}
          onRetry={() => {
            if (searchQuery) {
              searchKnowledge({
                query: searchQuery,
                filters: searchFilters,
                sortBy: { field: sortBy, order: 'desc' },
                pagination: { page: currentPage, limit: itemsPerPage },
                userId: user?.id,
              });
            } else {
              fetchArticles({
                category: selectedCategory,
                tags: selectedTags,
                sortBy,
                page: currentPage,
                limit: itemsPerPage,
              });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-3xl font-bold text-gray-900">知识库</h1>
              <p className="text-gray-600 mt-1">查找法律实践指南、案例分析和最佳实践</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                共 {totalCount} 篇文章
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            placeholder="搜索知识库..."
            className="w-full"
          />
        </div>
      </div>

      {/* Filters and Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Filters */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-6">
              {/* Category Filter */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">分类</h3>
                <CategoryFilter
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategoryChange={handleCategoryChange}
                />
              </div>

              {/* Tag Filter */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">标签</h3>
                <TagFilter
                  tags={tags}
                  selectedTags={selectedTags}
                  onTagToggle={handleTagToggle}
                />
              </div>

              {/* Sort Options */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">排序</h3>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as typeof sortBy)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="relevance">相关性</option>
                  <option value="date">发布日期</option>
                  <option value="title">标题</option>
                  <option value="views">浏览量</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Content Type Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {Object.entries({
                  BEST_PRACTICE: '最佳实践',
                  CASE_STUDY: '案例分析',
                  LEGAL_GUIDE: '法律指南',
                  TEMPLATE: '模板',
                  TRAINING_MATERIAL: '培训材料',
                }).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => {
                      const currentContentType = searchFilters.contentType || [];
                      const newContentType = currentContentType.includes(type)
                        ? currentContentType.filter(t => t !== type)
                        : [...currentContentType, type];
                      setSearchFilters({ ...searchFilters, contentType: newContentType });
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      searchFilters.contentType?.includes(type)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Articles Grid */}
            {displayArticles.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? '未找到相关文章' : '暂无文章'}
                </h3>
                <p className="text-gray-600">
                  {searchQuery 
                    ? '请尝试使用不同的关键词或调整筛选条件'
                    : '知识库正在建设中，敬请期待更多内容'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayArticles.map((article) => (
                  <KnowledgeCard
                    key={article.id}
                    article={article}
                    onClick={() => handleArticleClick(article)}
                    contentTypeLabel={getContentTypeLabel(article.contentType)}
                    accessLevelLabel={getAccessLevelLabel(article.accessLevel)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};