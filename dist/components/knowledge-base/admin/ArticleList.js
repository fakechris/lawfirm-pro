"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArticleList = void 0;
const react_1 = __importDefault(require("react"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const ArticleList = ({ articles, onEdit, onDelete, onCreate, searchTerm, onSearchChange, statusFilter, onStatusFilterChange, }) => {
    const getStatusLabel = (status) => {
        const labels = {
            DRAFT: '草稿',
            REVIEW: '待审核',
            PUBLISHED: '已发布',
            ARCHIVED: '已归档',
            DEPRECATED: '已废弃',
        };
        return labels[status] || status;
    };
    const getStatusColor = (status) => {
        const colors = {
            DRAFT: 'bg-gray-100 text-gray-800',
            REVIEW: 'bg-yellow-100 text-yellow-800',
            PUBLISHED: 'bg-green-100 text-green-800',
            ARCHIVED: 'bg-blue-100 text-blue-800',
            DEPRECATED: 'bg-red-100 text-red-800',
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };
    const getContentTypeLabel = (contentType) => {
        const labels = {
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
    return (<div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input type="text" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索文章..." className="w-64 px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>

          <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="REVIEW">待审核</option>
            <option value="PUBLISHED">已发布</option>
            <option value="ARCHIVED">已归档</option>
            <option value="DEPRECATED">已废弃</option>
          </select>
        </div>

        <button onClick={onCreate} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          创建文章
        </button>
      </div>

      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  文章信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  统计
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {articles.length === 0 ? (<tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                      </svg>
                      <p className="text-sm">
                        {searchTerm || statusFilter !== 'all'
                ? '没有找到匹配的文章'
                : '暂无文章，点击上方按钮创建第一篇文章'}
                      </p>
                    </div>
                  </td>
                </tr>) : (articles.map((article) => (<tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {article.title}
                        </div>
                        {article.summary && (<p className="text-sm text-gray-600 line-clamp-2">
                            {article.summary}
                          </p>)}
                        {article.tags.length > 0 && (<div className="flex flex-wrap gap-1 mt-2">
                            {article.tags.slice(0, 3).map((tag) => (<span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {tag}
                              </span>))}
                            {article.tags.length > 3 && (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                +{article.tags.length - 3}
                              </span>)}
                          </div>)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getContentTypeLabel(article.contentType)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(article.status)}`}>
                        {getStatusLabel(article.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {article.author?.firstName} {article.author?.lastName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 space-y-1">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          {article.viewCount}
                        </div>
                        {article.likeCount > 0 && (<div className="flex items-center">
                            <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                            </svg>
                            {article.likeCount}
                          </div>)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {(0, date_fns_1.format)(new Date(article.updatedAt), 'yyyy-MM-dd HH:mm', { locale: locale_1.zhCN })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => onEdit(article)} className="text-blue-600 hover:text-blue-700 transition-colors" title="编辑">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => onDelete(article.id)} className="text-red-600 hover:text-red-700 transition-colors" title="删除">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>)))}
            </tbody>
          </table>
        </div>
      </div>

      
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>显示 {articles.length} 篇文章</span>
          <div className="flex items-center space-x-4">
            <span>已发布: {articles.filter(a => a.status === 'PUBLISHED').length}</span>
            <span>草稿: {articles.filter(a => a.status === 'DRAFT').length}</span>
            <span>待审核: {articles.filter(a => a.status === 'REVIEW').length}</span>
          </div>
        </div>
      </div>
    </div>);
};
exports.ArticleList = ArticleList;
//# sourceMappingURL=ArticleList.js.map