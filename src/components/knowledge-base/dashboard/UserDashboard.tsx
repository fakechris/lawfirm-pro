import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useKnowledgeBase } from '../../hooks/knowledge-base/useKnowledgeBase';
import { DashboardHeader } from './DashboardHeader';
import { RecentArticles } from './RecentArticles';
import { PopularArticles } from './PopularArticles';
import { UserStats } from './UserStats';
import { QuickActions } from './QuickActions';
import { Recommendations } from './Recommendations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import type { KnowledgeAnalytics } from '../../types/knowledge-base';

export const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { articles, loading, error, refetch } = useKnowledgeBase();
  const [analytics, setAnalytics] = useState<KnowledgeAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        // In a real app, this would fetch from the API
        // For now, we'll use mock data
        const mockAnalytics: KnowledgeAnalytics = {
          totalArticles: articles.length,
          totalViews: articles.reduce((sum, article) => sum + article.viewCount, 0),
          totalLikes: articles.reduce((sum, article) => sum + article.likeCount, 0),
          popularArticles: articles
            .sort((a, b) => b.viewCount - a.viewCount)
            .slice(0, 5),
          recentArticles: articles
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5),
          categoryStats: [
            { category: '最佳实践', count: 45, views: 2340 },
            { category: '案例分析', count: 32, views: 1890 },
            { category: '法律指南', count: 28, views: 1650 },
            { category: '模板', count: 24, views: 1200 },
          ],
          contentTypeStats: [
            { type: '最佳实践', count: 45, views: 2340 },
            { type: '案例分析', count: 32, views: 1890 },
            { type: '法律指南', count: 28, views: 1650 },
            { type: '模板', count: 24, views: 1200 },
          ],
          userEngagement: [
            { userId: '1', userName: '张律师', views: 450, likes: 89, comments: 23 },
            { userId: '2', userName: '李律师', views: 380, likes: 76, comments: 18 },
            { userId: '3', userName: '王助理', views: 320, likes: 64, comments: 15 },
          ],
        };
        setAnalytics(mockAnalytics);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
  }, [articles]);

  if (loading || analyticsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage 
          message={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">
            您需要登录才能访问个人仪表板
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            前往登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        user={user}
        onNavigateToPortal={() => navigate('/knowledge-base')}
        onNavigateToAdmin={() => navigate('/knowledge-base/admin')}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Welcome Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                欢迎回来，{user.firstName} {user.lastName}
              </h1>
              <p className="text-gray-600">
                这是您的知识库个人仪表板，您可以查看最新文章、热门内容和个性化推荐。
              </p>
            </div>

            {/* Quick Actions */}
            <QuickActions
              onCreateArticle={() => navigate('/knowledge-base/admin?view=create')}
              onBrowseArticles={() => navigate('/knowledge-base')}
              onSearchArticles={() => {
                navigate('/knowledge-base');
                setTimeout(() => {
                  const searchInput = document.querySelector('input[placeholder*="搜索"]');
                  if (searchInput instanceof HTMLInputElement) {
                    searchInput.focus();
                  }
                }, 100);
              }}
            />

            {/* Recent Articles */}
            {analytics?.recentArticles && (
              <RecentArticles articles={analytics.recentArticles} />
            )}

            {/* Popular Articles */}
            {analytics?.popularArticles && (
              <PopularArticles articles={analytics.popularArticles} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Stats */}
            {analytics && (
              <UserStats analytics={analytics} />
            )}

            {/* Recommendations */}
            <Recommendations />
          </div>
        </div>
      </div>
    </div>
  );
};