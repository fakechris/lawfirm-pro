import React, { useState, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { KnowledgeCard } from './KnowledgeCard';
import { useSearch } from '../../hooks/knowledge-base/useSearch';
import { useKnowledgeBase } from '../../hooks/knowledge-base/useKnowledgeBase';
import type { KnowledgeBaseArticle, SearchFilters, SearchSuggestion } from '../../../types/knowledge-base';

interface SearchInterfaceProps {
  initialQuery?: string;
  onArticleSelect?: (article: KnowledgeBaseArticle) => void;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  initialQuery = '',
  onArticleSelect,
}) => {
  const [selectedFilters, setSelectedFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchSuggestions,
    isSearching,
    totalResults,
    currentPage,
    totalPages,
    performSearch,
    handleSearchSuggestionClick,
    goToPage,
  } = useSearch(initialQuery);

  const { categories, tags, isLoading: isLoadingMetadata } = useKnowledgeBase();

  // Initialize with initial query
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSearch = (query: string, filters?: SearchFilters) => {
    setSearchQuery(query);
    performSearch(query, filters);
  };

  const handleFilterChange = (filters: SearchFilters) => {
    setSelectedFilters(filters);
    performSearch(searchQuery, filters);
  };

  const clearFilters = () => {
    setSelectedFilters({});
    performSearch(searchQuery, {});
  };

  const hasActiveFilters = Object.keys(selectedFilters).some(key => {
    const value = selectedFilters[key as keyof SearchFilters];
    return Array.isArray(value) ? value.length > 0 : !!value;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">知识库搜索</h1>
            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
              
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  hasActiveFilters
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>筛选</span>
                {hasActiveFilters && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    {Object.keys(selectedFilters).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            suggestions={searchSuggestions}
            onSuggestionClick={handleSearchSuggestionClick}
            placeholder="搜索知识库文章、案例、模板..."
            className="max-w-3xl"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-80 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">筛选条件</h3>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      清除全部
                    </button>
                  )}
                </div>

                {/* Content Type Filter */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">内容类型</h4>
                  <div className="space-y-2">
                    {[
                      { value: 'BEST_PRACTICE', label: '最佳实践' },
                      { value: 'CASE_STUDY', label: '案例分析' },
                      { value: 'LEGAL_GUIDE', label: '法律指南' },
                      { value: 'TEMPLATE', label: '模板' },
                      { value: 'TRAINING_MATERIAL', label: '培训材料' },
                      { value: 'POLICY', label: '政策' },
                      { value: 'PROCEDURE', label: '程序' },
                      { value: 'RESEARCH_NOTE', label: '研究笔记' },
                    ].map((type) => (
                      <label key={type.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedFilters.contentTypes?.includes(type.value) || false}
                          onChange={(e) => {
                            const currentTypes = selectedFilters.contentTypes || [];
                            const newTypes = e.target.checked
                              ? [...currentTypes, type.value]
                              : currentTypes.filter(t => t !== type.value);
                            handleFilterChange({ ...selectedFilters, contentTypes: newTypes });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Category Filter */}
                {!isLoadingMetadata && categories.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">分类</h4>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <label key={category.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedFilters.categories?.includes(category.id) || false}
                            onChange={(e) => {
                              const currentCategories = selectedFilters.categories || [];
                              const newCategories = e.target.checked
                                ? [...currentCategories, category.id]
                                : currentCategories.filter(c => c !== category.id);
                              handleFilterChange({ ...selectedFilters, categories: newCategories });
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{category.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Access Level Filter */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">访问级别</h4>
                  <div className="space-y-2">
                    {[
                      { value: 'PUBLIC', label: '公开' },
                      { value: 'INTERNAL', label: '内部' },
                      { value: 'RESTRICTED', label: '限制' },
                      { value: 'CONFIDENTIAL', label: '机密' },
                    ].map((level) => (
                      <label key={level.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedFilters.accessLevels?.includes(level.value) || false}
                          onChange={(e) => {
                            const currentLevels = selectedFilters.accessLevels || [];
                            const newLevels = e.target.checked
                              ? [...currentLevels, level.value]
                              : currentLevels.filter(l => l !== level.value);
                            handleFilterChange({ ...selectedFilters, accessLevels: newLevels });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{level.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">发布时间</h4>
                  <div className="space-y-2">
                    {[
                      { value: 'today', label: '今天' },
                      { value: 'week', label: '本周' },
                      { value: 'month', label: '本月' },
                      { value: 'year', label: '今年' },
                    ].map((range) => (
                      <label key={range.value} className="flex items-center">
                        <input
                          type="radio"
                          name="dateRange"
                          checked={selectedFilters.dateRange === range.value}
                          onChange={() => handleFilterChange({ ...selectedFilters, dateRange: range.value })}
                          className="border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{range.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-gray-600">
                  {isSearching ? '搜索中...' : `找到 ${totalResults.toLocaleString()} 个结果`}
                  {searchQuery && (
                    <span className="ml-2">
                      对于 "<span className="font-medium text-gray-900">{searchQuery}</span>"
                    </span>
                  )}
                </p>
                {hasActiveFilters && (
                  <p className="text-xs text-gray-500 mt-1">
                    已应用筛选条件
                  </p>
                )}
              </div>
            </div>

            {/* Results Grid/List */}
            {isSearching ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">正在搜索...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">未找到相关结果</h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery
                    ? `尝试使用不同的关键词或调整筛选条件`
                    : '输入关键词开始搜索知识库内容'
                  }
                </p>
                {searchQuery && (
                  <button
                    onClick={clearFilters}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    清除筛选条件
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'
                }>
                  {searchResults.map((article) => (
                    <div
                      key={article.id}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => onArticleSelect?.(article)}
                    >
                      <KnowledgeCard article={article} />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};