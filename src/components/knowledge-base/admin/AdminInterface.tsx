import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeBase } from '../../hooks/knowledge-base/useKnowledgeBase';
import { useAuth } from '../../hooks/useAuth';
import { AdminHeader } from './AdminHeader';
import { ArticleList } from './ArticleList';
import { ArticleForm } from './ArticleForm';
import { CategoryManager } from './CategoryManager';
import { AnalyticsPanel } from './AnalyticsPanel';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import type { KnowledgeBaseArticle, KnowledgeArticleFormData } from '../../types/knowledge-base';

type AdminView = 'list' | 'create' | 'edit' | 'categories' | 'analytics';

export const AdminInterface: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    articles,
    categories,
    tags,
    loading,
    error,
    createArticle,
    updateArticle,
    deleteArticle,
    refetch,
  } = useKnowledgeBase();

  const [currentView, setCurrentView] = useState<AdminView>('list');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Check if user has admin privileges
  if (!user || !['ADMIN', 'LAWYER'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">
            您没有访问知识库管理界面的权限
          </p>
          <button
            onClick={() => navigate('/knowledge-base')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            返回知识库
          </button>
        </div>
      </div>
    );
  }

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateArticle = async (data: KnowledgeArticleFormData) => {
    try {
      await createArticle(data);
      setCurrentView('list');
      await refetch();
    } catch (err) {
      console.error('Error creating article:', err);
    }
  };

  const handleUpdateArticle = async (data: KnowledgeArticleFormData) => {
    if (!selectedArticle) return;
    
    try {
      await updateArticle(selectedArticle.id, data);
      setCurrentView('list');
      setSelectedArticle(null);
      await refetch();
    } catch (err) {
      console.error('Error updating article:', err);
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!window.confirm('确定要删除这篇文章吗？此操作不可撤销。')) {
      return;
    }

    try {
      await deleteArticle(articleId);
      await refetch();
    } catch (err) {
      console.error('Error deleting article:', err);
    }
  };

  const handleEditArticle = (article: KnowledgeBaseArticle) => {
    setSelectedArticle(article);
    setCurrentView('edit');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <ErrorMessage 
            message={error}
            onRetry={refetch}
          />
        </div>
      );
    }

    switch (currentView) {
      case 'create':
        return (
          <ArticleForm
            onSubmit={handleCreateArticle}
            onCancel={() => setCurrentView('list')}
            categories={categories}
            availableTags={tags}
          />
        );

      case 'edit':
        return selectedArticle ? (
          <ArticleForm
            article={selectedArticle}
            onSubmit={handleUpdateArticle}
            onCancel={() => {
              setCurrentView('list');
              setSelectedArticle(null);
            }}
            categories={categories}
            availableTags={tags}
          />
        ) : null;

      case 'categories':
        return (
          <CategoryManager
            categories={categories}
            onCategoriesUpdated={refetch}
          />
        );

      case 'analytics':
        return (
          <AnalyticsPanel />
        );

      default:
        return (
          <ArticleList
            articles={filteredArticles}
            onEdit={handleEditArticle}
            onDelete={handleDeleteArticle}
            onCreate={() => setCurrentView('create')}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        currentView={currentView}
        onViewChange={setCurrentView}
        onBackToPortal={() => navigate('/knowledge-base')}
        articleCount={articles.length}
      />

      <div className="container mx-auto px-4 py-6">
        {renderContent()}
      </div>
    </div>
  );
};