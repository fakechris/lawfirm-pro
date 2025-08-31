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
exports.ContentNavigation = void 0;
const react_1 = __importStar(require("react"));
const useKnowledgeBase_1 = require("../../hooks/knowledge-base/useKnowledgeBase");
const KnowledgeCard_1 = require("./KnowledgeCard");
const ContentNavigation = ({ onArticleSelect, onCategorySelect, }) => {
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)(null);
    const [selectedTag, setSelectedTag] = (0, react_1.useState)(null);
    const [viewMode, setViewMode] = (0, react_1.useState)('grid');
    const [sortBy, setSortBy] = (0, react_1.useState)('recent');
    const { articles, categories, tags, isLoading, error, getArticlesByCategory, getArticlesByTag, } = (0, useKnowledgeBase_1.useKnowledgeBase)();
    const filteredArticles = react_1.default.useMemo(() => {
        let filtered = articles;
        if (selectedCategory) {
            filtered = getArticlesByCategory(selectedCategory);
        }
        if (selectedTag) {
            filtered = getArticlesByTag(selectedTag);
        }
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'popular':
                    return b.viewCount - a.viewCount;
                case 'title':
                    return a.title.localeCompare(b.title, 'zh-CN');
                case 'recent':
                default:
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });
    }, [articles, selectedCategory, selectedTag, sortBy, getArticlesByCategory, getArticlesByTag]);
    const handleCategoryClick = (categoryId) => {
        setSelectedCategory(selectedCategory === categoryId ? null : categoryId);
        setSelectedTag(null);
        onCategorySelect?.(categories.find(c => c.id === categoryId));
    };
    const handleTagClick = (tagId) => {
        setSelectedTag(selectedTag === tagId ? null : tagId);
        setSelectedCategory(null);
    };
    const clearFilters = () => {
        setSelectedCategory(null);
        setSelectedTag(null);
    };
    const hasActiveFilters = selectedCategory || selectedTag;
    return (<div className="min-h-screen bg-gray-50">
      
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">内容浏览</h1>
              <p className="text-gray-600 mt-1">按分类和标签浏览知识库内容</p>
            </div>
            
            <div className="flex items-center space-x-4">
              
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="recent">最新发布</option>
                <option value="popular">最多浏览</option>
                <option value="title">按标题排序</option>
              </select>

              
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

          
          {hasActiveFilters && (<div className="flex items-center space-x-2 mb-4">
              <span className="text-sm text-gray-600">当前筛选:</span>
              {selectedCategory && (<span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  {categories.find(c => c.id === selectedCategory)?.name}
                  <button onClick={() => setSelectedCategory(null)} className="ml-2 text-blue-600 hover:text-blue-800">
                    ×
                  </button>
                </span>)}
              {selectedTag && (<span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  {tags.find(t => t.id === selectedTag)?.name}
                  <button onClick={() => setSelectedTag(null)} className="ml-2 text-green-600 hover:text-green-800">
                    ×
                  </button>
                </span>)}
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700">
                清除全部
              </button>
            </div>)}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          
          <div className="w-80 flex-shrink-0">
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">分类</h3>
              <div className="space-y-2">
                {categories.map((category) => {
            const articleCount = articles.filter(a => a.category?.id === category.id).length;
            const isSelected = selectedCategory === category.id;
            return (<button key={category.id} onClick={() => handleCategoryClick(category.id)} className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${isSelected
                    ? 'bg-blue-50 text-blue-900 border border-blue-200'
                    : 'hover:bg-gray-50 text-gray-700'}`}>
                      <div className="flex items-center">
                        <span className="text-lg mr-3">{category.icon || '📁'}</span>
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <span className={`text-sm ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                        {articleCount}
                      </span>
                    </button>);
        })}
              </div>
            </div>

            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">热门标签</h3>
              <div className="flex flex-wrap gap-2">
                {tags
            .sort((a, b) => b.articleCount - a.articleCount)
            .slice(0, 20)
            .map((tag) => {
            const isSelected = selectedTag === tag.id;
            return (<button key={tag.id} onClick={() => handleTagClick(tag.id)} className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors ${isSelected
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        {tag.name}
                        <span className={`ml-1 text-xs ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                          ({tag.articleCount})
                        </span>
                      </button>);
        })}
              </div>
            </div>
          </div>

          
          <div className="flex-1">
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedCategory
            ? categories.find(c => c.id === selectedCategory)?.name
            : selectedTag
                ? `标签: ${tags.find(t => t.id === selectedTag)?.name}`
                : '全部文章'}
                </h2>
                <p className="text-gray-600 mt-1">
                  共 {filteredArticles.length} 篇文章
                </p>
              </div>
            </div>

            
            {isLoading ? (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">加载中...</p>
              </div>) : error ? (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
                <p className="text-gray-600 mb-4">{error.message}</p>
                <button onClick={() => window.location.reload()} className="text-blue-600 hover:text-blue-700">
                  重新加载
                </button>
              </div>) : filteredArticles.length === 0 ? (<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无文章</h3>
                <p className="text-gray-600">
                  {hasActiveFilters
                ? '该分类或标签下暂无文章'
                : '知识库中暂无文章'}
                </p>
              </div>) : (<div className={viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'}>
                {filteredArticles.map((article) => (<div key={article.id} className="cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onArticleSelect?.(article)}>
                    <KnowledgeCard_1.KnowledgeCard article={article}/>
                  </div>))}
              </div>)}
          </div>
        </div>
      </div>
    </div>);
};
exports.ContentNavigation = ContentNavigation;
//# sourceMappingURL=ContentNavigation.js.map