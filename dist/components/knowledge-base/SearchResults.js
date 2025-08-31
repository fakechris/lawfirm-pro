"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResults = void 0;
const react_1 = __importDefault(require("react"));
const SearchResults = ({ articles, viewMode, onArticleSelect, isLoading = false, totalResults = 0, searchQuery = '', }) => {
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
    const getAccessLevelColor = (accessLevel) => {
        const colors = {
            PUBLIC: 'bg-green-100 text-green-800',
            INTERNAL: 'bg-blue-100 text-blue-800',
            RESTRICTED: 'bg-yellow-100 text-yellow-800',
            CONFIDENTIAL: 'bg-red-100 text-red-800',
        };
        return colors[accessLevel] || 'bg-gray-100 text-gray-800';
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('zh-CN');
    };
    const highlightSearchTerm = (text, term) => {
        if (!term)
            return text;
        const regex = new RegExp(`(${term})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, index) => regex.test(part) ? (<span key={index} className="bg-yellow-200 text-yellow-800 px-1 rounded">
          {part}
        </span>) : part);
    };
    if (isLoading) {
        return (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">正在搜索...</p>
      </div>);
    }
    if (articles.length === 0) {
        return (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">未找到相关结果</h3>
        <p className="text-gray-600 mb-4">
          {searchQuery
                ? `尝试使用不同的关键词或调整筛选条件`
                : '输入关键词开始搜索知识库内容'}
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>搜索建议：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>使用更通用的关键词</li>
            <li>检查拼写是否正确</li>
            <li>尝试使用同义词</li>
            <li>减少筛选条件</li>
          </ul>
        </div>
      </div>);
    }
    return (<div className="space-y-4">
      
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          显示 {Math.min(articles.length, totalResults)} 个结果，共 {totalResults.toLocaleString()} 个
          {searchQuery && (<span className="ml-2">
              对于 "<span className="font-medium text-gray-900">{searchQuery}</span>"
            </span>)}
        </p>
      </div>

      
      {viewMode === 'grid' ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (<div key={article.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onArticleSelect(article)}>
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(article.accessLevel)}`}>
                      {getContentTypeLabel(article.contentType)}
                    </span>
                    {article.isFeatured && (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        精选
                      </span>)}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {highlightSearchTerm(article.title, searchQuery)}
                  </h3>
                </div>
              </div>

              
              {article.summary && (<p className="text-sm text-gray-600 mb-4 line-clamp-3">
                  {highlightSearchTerm(article.summary, searchQuery)}
                </p>)}

              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-3">
                  <span>{formatDate(article.createdAt)}</span>
                  {article.author && (<span className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                      </svg>
                      {article.author.firstName} {article.author.lastName}
                    </span>)}
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    {article.viewCount.toLocaleString()}
                  </span>
                  {article.likeCount > 0 && (<span className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                      </svg>
                      {article.likeCount}
                    </span>)}
                </div>
              </div>

              
              {article.tags && article.tags.length > 0 && (<div className="mt-3 flex flex-wrap gap-1">
                  {article.tags.slice(0, 3).map((tag) => (<span key={tag.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                      {tag.name}
                    </span>))}
                  {article.tags.length > 3 && (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">
                      +{article.tags.length - 3}
                    </span>)}
                </div>)}
            </div>))}
        </div>) : (<div className="space-y-4">
          {articles.map((article) => (<div key={article.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onArticleSelect(article)}>
              <div className="flex items-start space-x-4">
                
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                  {articles.indexOf(article) + 1}
                </div>

                
                <div className="flex-1 min-w-0">
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(article.accessLevel)}`}>
                          {getContentTypeLabel(article.contentType)}
                        </span>
                        {article.isFeatured && (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            精选
                          </span>)}
                        {article.category && (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {article.category.name}
                          </span>)}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {highlightSearchTerm(article.title, searchQuery)}
                      </h3>
                    </div>
                  </div>

                  
                  {article.summary && (<p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {highlightSearchTerm(article.summary, searchQuery)}
                    </p>)}

                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>{formatDate(article.createdAt)}</span>
                      {article.author && (<span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                          </svg>
                          {article.author.firstName} {article.author.lastName}
                        </span>)}
                      {article.readingTime && (<span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          {article.readingTime} 分钟阅读
                        </span>)}
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        {article.viewCount.toLocaleString()}
                      </span>
                      {article.likeCount > 0 && (<span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                          </svg>
                          {article.likeCount}
                        </span>)}
                    </div>
                  </div>

                  
                  {article.tags && article.tags.length > 0 && (<div className="mt-3 flex flex-wrap gap-1">
                      {article.tags.map((tag) => (<span key={tag.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                          {tag.name}
                        </span>))}
                    </div>)}
                </div>
              </div>
            </div>))}
        </div>)}
    </div>);
};
exports.SearchResults = SearchResults;
//# sourceMappingURL=SearchResults.js.map