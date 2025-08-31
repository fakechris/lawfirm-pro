"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopularArticles = void 0;
const react_1 = __importDefault(require("react"));
const PopularArticles = ({ articles }) => {
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
    return (<div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">热门文章</h2>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            查看全部
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {articles.length === 0 ? (<div className="text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <p>暂无热门文章</p>
          </div>) : (<div className="space-y-4">
            {articles.map((article, index) => (<div key={article.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {getContentTypeLabel(article.contentType)}
                    </span>
                    {article.isFeatured && (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        精选
                      </span>)}
                  </div>
                  
                  <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                    {article.title}
                  </h3>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
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
                    
                    <button className="text-blue-600 hover:text-blue-700 transition-colors">
                      阅读
                    </button>
                  </div>
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
};
exports.PopularArticles = PopularArticles;
//# sourceMappingURL=PopularArticles.js.map