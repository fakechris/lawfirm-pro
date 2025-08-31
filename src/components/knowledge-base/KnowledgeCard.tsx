import React from 'react';
import type { KnowledgeBaseArticle } from '../../types/knowledge-base';

interface KnowledgeCardProps {
  article: KnowledgeBaseArticle;
  onClick: () => void;
  contentTypeLabel: string;
  accessLevelLabel: string;
}

export const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
  article,
  onClick,
  contentTypeLabel,
  accessLevelLabel,
}) => {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAccessLevelColor = (accessLevel: string) => {
    const colors: Record<string, string> = {
      PUBLIC: 'bg-green-100 text-green-800',
      INTERNAL: 'bg-blue-100 text-blue-800',
      RESTRICTED: 'bg-yellow-100 text-yellow-800',
      CONFIDENTIAL: 'bg-red-100 text-red-800',
    };
    return colors[accessLevel] || 'bg-gray-100 text-gray-800';
  };

  const getContentTypeColor = (contentType: string) => {
    const colors: Record<string, string> = {
      BEST_PRACTICE: 'bg-purple-100 text-purple-800',
      CASE_STUDY: 'bg-indigo-100 text-indigo-800',
      LEGAL_GUIDE: 'bg-blue-100 text-blue-800',
      TEMPLATE: 'bg-green-100 text-green-800',
      TRAINING_MATERIAL: 'bg-orange-100 text-orange-800',
      POLICY: 'bg-red-100 text-red-800',
      PROCEDURE: 'bg-gray-100 text-gray-800',
      RESEARCH_NOTE: 'bg-yellow-100 text-yellow-800',
      LEGAL_OPINION: 'bg-pink-100 text-pink-800',
      CHECKLIST: 'bg-teal-100 text-teal-800',
      WORKFLOW: 'bg-cyan-100 text-cyan-800',
      RESOURCE: 'bg-gray-100 text-gray-800',
    };
    return colors[contentType] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
              {article.title}
            </h3>
          </div>
          {article.isFeatured && (
            <div className="ml-2 flex-shrink-0">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                精选
              </span>
            </div>
          )}
        </div>

        {/* Summary */}
        {article.summary && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {article.summary}
          </p>
        )}

        {/* Meta Information */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center space-x-4">
            <span>{formatDate(article.publishedAt || article.createdAt)}</span>
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {article.viewCount}
            </span>
            {article.likeCount > 0 && (
              <span className="flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {article.likeCount}
              </span>
            )}
          </div>
          <span className="flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {article.author?.firstName} {article.author?.lastName}
          </span>
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {article.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                >
                  {tag}
                </span>
              ))}
              {article.tags.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  +{article.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getContentTypeColor(article.contentType)}`}>
              {contentTypeLabel}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(article.accessLevel)}`}>
              {accessLevelLabel}
            </span>
          </div>
          
          <div className="flex items-center text-blue-600 group-hover:text-blue-700">
            <span className="text-sm font-medium">阅读更多</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};