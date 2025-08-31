import React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { KnowledgeBaseArticle } from '../../../types/knowledge-base';

interface RecentArticlesProps {
  articles: KnowledgeBaseArticle[];
}

export const RecentArticles: React.FC<RecentArticlesProps> = ({ articles }) => {
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

  const getAccessLevelColor = (accessLevel: string) => {
    const colors: Record<string, string> = {
      PUBLIC: 'bg-green-100 text-green-800',
      INTERNAL: 'bg-blue-100 text-blue-800',
      RESTRICTED: 'bg-yellow-100 text-yellow-800',
      CONFIDENTIAL: 'bg-red-100 text-red-800',
    };
    return colors[accessLevel] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最新文章</h2>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            查看全部
          </button>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {articles.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>暂无最新文章</p>
          </div>
        ) : (
          articles.map((article) => (
            <div key={article.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(article.accessLevel)}`}>
                      {getContentTypeLabel(article.contentType)}
                    </span>
                    {article.isFeatured && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        精选
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-base font-medium text-gray-900 mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  
                  {article.summary && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>{format(new Date(article.createdAt), 'yyyy-MM-dd', { locale: zhCN })}</span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {article.author?.firstName} {article.author?.lastName}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
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
                  </div>
                </div>
                
                <div className="ml-4 flex-shrink-0">
                  <button className="text-blue-600 hover:text-blue-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};