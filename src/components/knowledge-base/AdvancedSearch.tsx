import React, { useState, useEffect } from 'react';
import { useSearch } from '../../hooks/knowledge-base/useSearch';
import { useKnowledgeBase } from '../../hooks/knowledge-base/useKnowledgeBase';
import type { SearchFilters, KnowledgeBaseArticle } from '../../../types/knowledge-base';

interface AdvancedSearchProps {
  onSearch: (results: KnowledgeBaseArticle[], filters: SearchFilters) => void;
  onClose: () => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const { categories, tags, isLoading: isLoadingMetadata } = useKnowledgeBase();

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('knowledge-base-search-history');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    // Update search history
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('knowledge-base-search-history', JSON.stringify(newHistory));

    // Perform search
    onSearch([], { ...filters, query: searchQuery });
    onClose();
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof SearchFilters];
    return Array.isArray(value) ? value.length > 0 : !!value;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">高级搜索</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜索关键词
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入搜索关键词..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex space-x-2">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">搜索技巧</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 使用空格分隔多个关键词</li>
              <li>• 使用引号进行精确匹配："合同纠纷"</li>
              <li>• 使用减号排除关键词：劳动 -合同</li>
              <li>• 使用 OR 搜索任一关键词：合同 OR 协议</li>
            </ul>
          </div>

          {/* Content Type Filters */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">内容类型</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'BEST_PRACTICE', label: '最佳实践', icon: '⭐' },
                { value: 'CASE_STUDY', label: '案例分析', icon: '📊' },
                { value: 'LEGAL_GUIDE', label: '法律指南', icon: '📖' },
                { value: 'TEMPLATE', label: '模板', icon: '📄' },
                { value: 'TRAINING_MATERIAL', label: '培训材料', icon: '🎓' },
                { value: 'POLICY', label: '政策', icon: '📋' },
                { value: 'PROCEDURE', label: '程序', icon: '🔄' },
                { value: 'RESEARCH_NOTE', label: '研究笔记', icon: '🔬' },
              ].map((type) => (
                <label
                  key={type.value}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    filters.contentTypes?.includes(type.value)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filters.contentTypes?.includes(type.value) || false}
                    onChange={(e) => {
                      const currentTypes = filters.contentTypes || [];
                      const newTypes = e.target.checked
                        ? [...currentTypes, type.value]
                        : currentTypes.filter(t => t !== type.value);
                      handleFilterChange('contentTypes', newTypes);
                    }}
                    className="sr-only"
                  />
                  <span className="text-lg mr-2">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Filters */}
          {!isLoadingMetadata && categories.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">分类</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      filters.categories?.includes(category.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.categories?.includes(category.id) || false}
                      onChange={(e) => {
                        const currentCategories = filters.categories || [];
                        const newCategories = e.target.checked
                          ? [...currentCategories, category.id]
                          : currentCategories.filter(c => c !== category.id);
                        handleFilterChange('categories', newCategories);
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">高级选项</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Access Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  访问级别
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'PUBLIC', label: '公开', color: 'bg-green-100 text-green-800' },
                    { value: 'INTERNAL', label: '内部', color: 'bg-blue-100 text-blue-800' },
                    { value: 'RESTRICTED', label: '限制', color: 'bg-yellow-100 text-yellow-800' },
                    { value: 'CONFIDENTIAL', label: '机密', color: 'bg-red-100 text-red-800' },
                  ].map((level) => (
                    <label key={level.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.accessLevels?.includes(level.value) || false}
                        onChange={(e) => {
                          const currentLevels = filters.accessLevels || [];
                          const newLevels = e.target.checked
                            ? [...currentLevels, level.value]
                            : currentLevels.filter(l => l !== level.value);
                          handleFilterChange('accessLevels', newLevels);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`ml-2 text-xs px-2 py-1 rounded-full ${level.color}`}>
                        {level.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  发布时间
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'today', label: '今天' },
                    { value: 'week', label: '本周' },
                    { value: 'month', label: '本月' },
                    { value: 'quarter', label: '本季度' },
                    { value: 'year', label: '今年' },
                  ].map((range) => (
                    <label key={range.value} className="flex items-center">
                      <input
                        type="radio"
                        name="dateRange"
                        checked={filters.dateRange === range.value}
                        onChange={() => handleFilterChange('dateRange', range.value)}
                        className="border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{range.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">搜索历史</h3>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchQuery(query)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                清除筛选
              </button>
            )}
            <span className="text-sm text-gray-500">
              {hasActiveFilters ? `${Object.keys(filters).length} 个筛选条件已应用` : '未应用筛选条件'}
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              搜索
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};