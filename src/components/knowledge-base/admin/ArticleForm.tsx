import React, { useState, useEffect } from 'react';
import { useKnowledgeBase } from '../../../hooks/knowledge-base/useKnowledgeBase';
import { useAuth } from '../../../hooks/useAuth';
import { RichTextEditor } from '../RichTextEditor';
import { TagInput } from '../TagInput';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import type { 
  KnowledgeBaseArticle, 
  KnowledgeArticleFormData, 
  KnowledgeBaseCategory 
} from '../../../types/knowledge-base';

interface ArticleFormProps {
  article?: KnowledgeBaseArticle;
  onSubmit: (data: KnowledgeArticleFormData) => Promise<void>;
  onCancel: () => void;
  categories: KnowledgeBaseCategory[];
  availableTags: string[];
}

export const ArticleForm: React.FC<ArticleFormProps> = ({
  article,
  onSubmit,
  onCancel,
  categories,
  availableTags,
}) => {
  const { user } = useAuth();
  const { loading } = useKnowledgeBase();
  const [formData, setFormData] = useState<KnowledgeArticleFormData>({
    title: '',
    content: '',
    summary: '',
    contentType: 'BEST_PRACTICE',
    accessLevel: 'INTERNAL',
    tags: [],
    categories: [],
    isFeatured: false,
    reviewerId: undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title,
        content: article.content,
        summary: article.summary || '',
        contentType: article.contentType,
        accessLevel: article.accessLevel,
        tags: article.tags,
        categories: article.categories,
        isFeatured: article.isFeatured,
        reviewerId: article.reviewerId,
      });
    }
  }, [article]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = '标题不能为空';
    } else if (formData.title.length > 200) {
      newErrors.title = '标题不能超过200个字符';
    }

    if (!formData.content.trim()) {
      newErrors.content = '内容不能为空';
    } else if (formData.content.length < 50) {
      newErrors.content = '内容至少需要50个字符';
    }

    if (formData.summary && formData.summary.length > 500) {
      newErrors.summary = '摘要不能超过500个字符';
    }

    if (formData.tags.length === 0) {
      newErrors.tags = '至少需要添加一个标签';
    } else if (formData.tags.length > 10) {
      newErrors.tags = '最多只能添加10个标签';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Error submitting article:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof KnowledgeArticleFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const contentTypeOptions = [
    { value: 'BEST_PRACTICE', label: '最佳实践' },
    { value: 'CASE_STUDY', label: '案例分析' },
    { value: 'LEGAL_GUIDE', label: '法律指南' },
    { value: 'TEMPLATE', label: '模板' },
    { value: 'TRAINING_MATERIAL', label: '培训材料' },
    { value: 'POLICY', label: '政策' },
    { value: 'PROCEDURE', label: '程序' },
    { value: 'RESEARCH_NOTE', label: '研究笔记' },
    { value: 'LEGAL_OPINION', label: '法律意见' },
    { value: 'CHECKLIST', label: '清单' },
    { value: 'WORKFLOW', label: '工作流程' },
    { value: 'RESOURCE', label: '资源' },
  ];

  const accessLevelOptions = [
    { value: 'PUBLIC', label: '公开' },
    { value: 'INTERNAL', label: '内部' },
    { value: 'RESTRICTED', label: '受限' },
    { value: 'CONFIDENTIAL', label: '机密' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {article ? '编辑文章' : '创建文章'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Title */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入文章标题"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              内容类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.contentType}
              onChange={(e) => handleInputChange('contentType', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {contentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Access Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              访问级别 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.accessLevel}
              onChange={(e) => handleInputChange('accessLevel', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accessLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              摘要
            </label>
            <textarea
              value={formData.summary}
              onChange={(e) => handleInputChange('summary', e.target.value)}
              rows={3}
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.summary ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入文章摘要（可选）"
            />
            {errors.summary && (
              <p className="mt-1 text-sm text-red-600">{errors.summary}</p>
            )}
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分类
            </label>
            <div className="space-y-2">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.categories.includes(category.slug)}
                    onChange={(e) => {
                      const newCategories = e.target.checked
                        ? [...formData.categories, category.slug]
                        : formData.categories.filter(c => c !== category.slug);
                      handleInputChange('categories', newCategories);
                    }}
                    className="mr-2 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{category.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标签 <span className="text-red-500">*</span>
            </label>
            <TagInput
              value={formData.tags}
              onChange={(tags) => handleInputChange('tags', tags)}
              suggestions={availableTags}
              placeholder="添加标签..."
            />
            {errors.tags && (
              <p className="mt-1 text-sm text-red-600">{errors.tags}</p>
            )}
          </div>

          {/* Reviewer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              审核人
            </label>
            <select
              value={formData.reviewerId || ''}
              onChange={(e) => handleInputChange('reviewerId', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">无需审核</option>
              {/* In a real app, you would fetch reviewers from the API */}
              <option value="1">李律师</option>
              <option value="2">王律师</option>
            </select>
          </div>

          {/* Featured */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="featured"
              checked={formData.isFeatured}
              onChange={(e) => handleInputChange('isFeatured', e.target.checked)}
              className="mr-2 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="featured" className="text-sm font-medium text-gray-700">
              设为精选文章
            </label>
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            内容 <span className="text-red-500">*</span>
          </label>
          <RichTextEditor
            value={formData.content}
            onChange={(content) => handleInputChange('content', content)}
            placeholder="请输入文章内容..."
          />
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <LoadingSpinner size="small" className="mr-2" />
                {article ? '更新中...' : '创建中...'}
              </div>
            ) : (
              article ? '更新文章' : '创建文章'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};