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
exports.KnowledgePortal = void 0;
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const useKnowledgeBase_1 = require("../../hooks/knowledge-base/useKnowledgeBase");
const useSearch_1 = require("../../hooks/knowledge-base/useSearch");
const useAuth_1 = require("../../hooks/useAuth");
const KnowledgeCard_1 = require("./KnowledgeCard");
const SearchBar_1 = require("./SearchBar");
const CategoryFilter_1 = require("./CategoryFilter");
const TagFilter_1 = require("./TagFilter");
const LoadingSpinner_1 = require("../common/LoadingSpinner");
const ErrorMessage_1 = require("../common/ErrorMessage");
const Pagination_1 = require("../common/Pagination");
const KnowledgePortal = ({ className = '' }) => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const { user } = (0, useAuth_1.useAuth)();
    const { articles, categories, tags, loading, error, fetchArticles, fetchCategories, fetchTags } = (0, useKnowledgeBase_1.useKnowledgeBase)();
    const { searchResults, searchLoading, searchError, searchQuery, searchFilters, searchKnowledge, setSearchQuery, setSearchFilters } = (0, useSearch_1.useSearch)();
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)('');
    const [selectedTags, setSelectedTags] = (0, react_1.useState)([]);
    const [sortBy, setSortBy] = (0, react_1.useState)('relevance');
    const [currentPage, setCurrentPage] = (0, react_1.useState)(1);
    const [itemsPerPage] = (0, react_1.useState)(12);
    (0, react_1.useEffect)(() => {
        fetchCategories();
        fetchTags();
    }, [fetchCategories, fetchTags]);
    (0, react_1.useEffect)(() => {
        if (searchQuery) {
            searchKnowledge({
                query: searchQuery,
                filters: {
                    ...searchFilters,
                    categories: selectedCategory ? [selectedCategory] : undefined,
                    tags: selectedTags.length > 0 ? selectedTags : undefined,
                },
                sortBy: { field: sortBy, order: 'desc' },
                pagination: { page: currentPage, limit: itemsPerPage },
                userId: user?.id,
            });
        }
        else {
            fetchArticles({
                category: selectedCategory,
                tags: selectedTags,
                sortBy,
                page: currentPage,
                limit: itemsPerPage,
            });
        }
    }, [
        searchQuery,
        selectedCategory,
        selectedTags,
        sortBy,
        currentPage,
        itemsPerPage,
        user?.id,
    ]);
    const handleSearch = (query) => {
        setSearchQuery(query);
        setCurrentPage(1);
    };
    const handleCategoryChange = (category) => {
        setSelectedCategory(category);
        setCurrentPage(1);
    };
    const handleTagToggle = (tag) => {
        setSelectedTags(prev => prev.includes(tag)
            ? prev.filter(t => t !== tag)
            : [...prev, tag]);
        setCurrentPage(1);
    };
    const handleSortChange = (newSort) => {
        setSortBy(newSort);
        setCurrentPage(1);
    };
    const handleArticleClick = (article) => {
        navigate(`/knowledge-base/${article.slug}`);
    };
    const displayArticles = searchQuery ? searchResults.documents : articles;
    const totalCount = searchQuery ? searchResults.total : articles.length;
    const isLoading = searchQuery ? searchLoading : loading;
    const displayError = searchQuery ? searchError : error;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
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
    const getAccessLevelLabel = (accessLevel) => {
        const labels = {
            PUBLIC: '公开',
            INTERNAL: '内部',
            RESTRICTED: '受限',
            CONFIDENTIAL: '机密',
        };
        return labels[accessLevel] || accessLevel;
    };
    if (isLoading) {
        return (<div className={`flex justify-center items-center min-h-screen ${className}`}>
        <LoadingSpinner_1.LoadingSpinner size="large"/>
      </div>);
    }
    if (displayError) {
        return (<div className={`container mx-auto px-4 py-8 ${className}`}>
        <ErrorMessage_1.ErrorMessage message={displayError} onRetry={() => {
                if (searchQuery) {
                    searchKnowledge({
                        query: searchQuery,
                        filters: searchFilters,
                        sortBy: { field: sortBy, order: 'desc' },
                        pagination: { page: currentPage, limit: itemsPerPage },
                        userId: user?.id,
                    });
                }
                else {
                    fetchArticles({
                        category: selectedCategory,
                        tags: selectedTags,
                        sortBy,
                        page: currentPage,
                        limit: itemsPerPage,
                    });
                }
            }}/>
      </div>);
    }
    return (<div className={`min-h-screen bg-gray-50 ${className}`}>
      
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-3xl font-bold text-gray-900">知识库</h1>
              <p className="text-gray-600 mt-1">查找法律实践指南、案例分析和最佳实践</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                共 {totalCount} 篇文章
              </div>
            </div>
          </div>
        </div>
      </div>

      
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <SearchBar_1.SearchBar value={searchQuery} onChange={handleSearch} placeholder="搜索知识库..." className="w-full"/>
        </div>
      </div>

      
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-6">
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">分类</h3>
                <CategoryFilter_1.CategoryFilter categories={categories} selectedCategory={selectedCategory} onCategoryChange={handleCategoryChange}/>
              </div>

              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">标签</h3>
                <TagFilter_1.TagFilter tags={tags} selectedTags={selectedTags} onTagToggle={handleTagToggle}/>
              </div>

              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">排序</h3>
                <select value={sortBy} onChange={(e) => handleSortChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="relevance">相关性</option>
                  <option value="date">发布日期</option>
                  <option value="title">标题</option>
                  <option value="views">浏览量</option>
                </select>
              </div>
            </div>
          </div>

          
          <div className="flex-1">
            
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {Object.entries({
            BEST_PRACTICE: '最佳实践',
            CASE_STUDY: '案例分析',
            LEGAL_GUIDE: '法律指南',
            TEMPLATE: '模板',
            TRAINING_MATERIAL: '培训材料',
        }).map(([type, label]) => (<button key={type} onClick={() => {
                const currentContentType = searchFilters.contentType || [];
                const newContentType = currentContentType.includes(type)
                    ? currentContentType.filter(t => t !== type)
                    : [...currentContentType, type];
                setSearchFilters({ ...searchFilters, contentType: newContentType });
            }} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${searchFilters.contentType?.includes(type)
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {label}
                  </button>))}
              </div>
            </div>

            
            {displayArticles.length === 0 ? (<div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? '未找到相关文章' : '暂无文章'}
                </h3>
                <p className="text-gray-600">
                  {searchQuery
                ? '请尝试使用不同的关键词或调整筛选条件'
                : '知识库正在建设中，敬请期待更多内容'}
                </p>
              </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayArticles.map((article) => (<KnowledgeCard_1.KnowledgeCard key={article.id} article={article} onClick={() => handleArticleClick(article)} contentTypeLabel={getContentTypeLabel(article.contentType)} accessLevelLabel={getAccessLevelLabel(article.accessLevel)}/>))}
              </div>)}

            
            {totalPages > 1 && (<div className="mt-8">
                <Pagination_1.Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}/>
              </div>)}
          </div>
        </div>
      </div>
    </div>);
};
exports.KnowledgePortal = KnowledgePortal;
//# sourceMappingURL=KnowledgePortal.js.map