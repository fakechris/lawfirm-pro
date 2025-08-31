"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryBrowser = void 0;
const react_1 = __importStar(require("react"));
const useKnowledgeBase_1 = require("../../hooks/knowledge-base/useKnowledgeBase");
const KnowledgeCard_1 = require("./KnowledgeCard");
const CategoryBrowser = ({ onArticleSelect, }) => {
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)(null);
    const [viewMode, setViewMode] = (0, react_1.useState)('grid');
    const { categories, articles, isLoading, getArticlesByCategory, } = (0, useKnowledgeBase_1.useKnowledgeBase)();
    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
    };
    const handleBackToCategories = () => {
        setSelectedCategory(null);
    };
    const categoryStats = react_1.default.useMemo(() => {
        return categories.map(category => {
            const categoryArticles = getArticlesByCategory(category.id);
            const totalViews = categoryArticles.reduce((sum, article) => sum + article.viewCount, 0);
            const totalLikes = categoryArticles.reduce((sum, article) => sum + article.likeCount, 0);
            const recentArticles = categoryArticles.filter(article => {
                const articleDate = new Date(article.createdAt);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return articleDate > thirtyDaysAgo;
            });
            return {
                ...category,
                articleCount: categoryArticles.length,
                totalViews,
                totalLikes,
                recentCount: recentArticles.length,
            };
        }).sort((a, b) => b.articleCount - a.articleCount);
    }, [categories, articles, getArticlesByCategory]);
    if (selectedCategory) {
        const categoryArticles = getArticlesByCategory(selectedCategory.id);
        return (<div className="bg-white rounded-lg shadow-sm border border-gray-200">
        
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button onClick={handleBackToCategories} className="flex items-center text-blue-600 hover:text-blue-700 transition-colors">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                返回分类
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{selectedCategory.icon || '📁'}</span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedCategory.name}</h2>
                  {selectedCategory.description && (<p className="text-sm text-gray-600">{selectedCategory.description}</p>)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                  </svg>
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">文章总数</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {categoryArticles.length}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">总浏览量</p>
                  <p className="text-2xl font-bold text-green-900">
                    {categoryArticles.reduce((sum, article) => sum + article.viewCount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">总点赞数</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {categoryArticles.reduce((sum, article) => sum + article.likeCount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">本月新增</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {categoryArticles.filter(article => {
                const articleDate = new Date(article.createdAt);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return articleDate > thirtyDaysAgo;
            }).length}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        
        <div className="p-6">
          {isLoading ? (<div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>) : categoryArticles.length === 0 ? (<div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无文章</h3>
              <p className="text-gray-600">该分类下暂无文章</p>
            </div>) : (<div className={viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'}>
              {categoryArticles.map((article) => (<div key={article.id} className="cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onArticleSelect?.(article)}>
                  <KnowledgeCard_1.KnowledgeCard article={article}/>
                </div>))}
            </div>)}
        </div>
      </div>);
    }
    return (<div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">知识库分类</h2>
        <p className="text-gray-600">按分类浏览和组织知识内容</p>
      </div>

      <div className="p-6">
        {isLoading ? (<div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>) : categoryStats.length === 0 ? (<div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分类</h3>
            <p className="text-gray-600">知识库中暂无分类</p>
          </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryStats.map((category) => (<div key={category.id} onClick={() => handleCategorySelect(category)} className="group cursor-pointer">
                <div className="bg-gray-50 rounded-lg p-6 hover:bg-gray-100 transition-colors border border-gray-200 group-hover:border-gray-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{category.icon || '📁'}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {category.name}
                        </h3>
                        {category.description && (<p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {category.description}
                          </p>)}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{category.articleCount}</p>
                      <p className="text-sm text-gray-600">文章数</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{category.totalViews.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">浏览量</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                        </svg>
                        {category.totalLikes} 点赞
                      </span>
                      {category.recentCount > 0 && (<span className="text-green-600">
                          {category.recentCount} 新增
                        </span>)}
                    </div>
                  </div>
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
};
exports.CategoryBrowser = CategoryBrowser;
//# sourceMappingURL=CategoryBrowser.js.map