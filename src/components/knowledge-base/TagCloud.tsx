import React, { useState } from 'react';
import { useKnowledgeBase } from '../../hooks/knowledge-base/useKnowledgeBase';
import { KnowledgeCard } from './KnowledgeCard';
import type { KnowledgeBaseArticle, KnowledgeBaseTag } from '../../../types/knowledge-base';

interface TagCloudProps {
  onArticleSelect?: (article: KnowledgeBaseArticle) => void;
}

export const TagCloud: React.FC<TagCloudProps> = ({
  onArticleSelect,
}) => {
  const [selectedTag, setSelectedTag] = useState<KnowledgeBaseTag | null>(null);
  const [viewMode, setViewMode] = useState<'cloud' | 'list'>('cloud');
  const [sortBy, setSortBy] = useState<'popular' | 'alphabetical'>('popular');

  const {
    tags,
    articles,
    isLoading,
    getArticlesByTag,
  } = useKnowledgeBase();

  const handleTagSelect = (tag: KnowledgeBaseTag) => {
    setSelectedTag(tag);
  };

  const handleBackToCloud = () => {
    setSelectedTag(null);
  };

  // Sort tags based on selected criteria
  const sortedTags = React.useMemo(() => {
    const tagsWithCount = tags.map(tag => ({
      ...tag,
      articleCount: getArticlesByTag(tag.id).length,
    }));

    return tagsWithCount.sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.name.localeCompare(b.name, 'zh-CN');
        case 'popular':
        default:
          return b.articleCount - a.articleCount;
      }
    });
  }, [tags, sortBy, getArticlesByTag]);

  // Calculate tag sizes for cloud visualization
  const getTagSize = (count: number, maxCount: number) => {
    const minSize = 0.875; // 14px
    const maxSize = 1.5;   // 24px
    const ratio = count / maxCount;
    return minSize + (maxSize - minSize) * ratio;
  };

  const getTagColor = (count: number, maxCount: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (ratio > 0.6) return 'text-green-600 bg-green-50 border-green-200';
    if (ratio > 0.4) return 'text-purple-600 bg-purple-50 border-purple-200';
    if (ratio > 0.2) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  if (selectedTag) {
    // Show articles with selected tag
    const tagArticles = getArticlesByTag(selectedTag.id);
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tag Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToCloud}
                className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回标签云
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  标签: {selectedTag.name}
                </h2>
                {selectedTag.description && (
                  <p className="text-sm text-gray-600 mt-1">{selectedTag.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tag Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">相关文章</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {tagArticles.length}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">总浏览量</p>
                  <p className="text-2xl font-bold text-green-900">
                    {tagArticles.reduce((sum, article) => sum + article.viewCount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">总点赞数</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {tagArticles.reduce((sum, article) => sum + article.likeCount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">平均阅读时间</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {tagArticles.length > 0 
                      ? Math.round(tagArticles.reduce((sum, article) => sum + (article.readingTime || 0), 0) / tagArticles.length)
                      : 0
                    }分钟
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : tagArticles.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无相关文章</h3>
              <p className="text-gray-600">该标签下暂无文章</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tagArticles.map((article) => (
                <div
                  key={article.id}
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onArticleSelect?.(article)}
                >
                  <KnowledgeCard article={article} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show tag cloud
  const maxCount = Math.max(...sortedTags.map(tag => tag.articleCount), 1);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">标签云</h2>
            <p className="text-gray-600">点击标签查看相关文章</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="popular">按热门程度</option>
              <option value="alphabetical">按字母排序</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cloud')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'cloud'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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
          </div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        ) : sortedTags.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无标签</h3>
            <p className="text-gray-600">知识库中暂无标签</p>
          </div>
        ) : viewMode === 'cloud' ? (
          <div className="flex flex-wrap gap-3 justify-center">
            {sortedTags.map((tag) => {
              const fontSize = getTagSize(tag.articleCount, maxCount);
              const colorClass = getTagColor(tag.articleCount, maxCount);
              
              return (
                <button
                  key={tag.id}
                  onClick={() => handleTagSelect(tag)}
                  className={`inline-flex items-center px-4 py-2 rounded-full border transition-all hover:scale-105 hover:shadow-md ${colorClass}`}
                  style={{ fontSize: `${fontSize}rem` }}
                >
                  <span className="font-medium">{tag.name}</span>
                  <span className="ml-2 text-sm opacity-75">({tag.articleCount})</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => handleTagSelect(tag)}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200 hover:border-gray-300"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${getTagColor(tag.articleCount, maxCount)}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{tag.name}</h3>
                    {tag.description && (
                      <p className="text-sm text-gray-600">{tag.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {tag.articleCount} 篇文章
                  </span>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};