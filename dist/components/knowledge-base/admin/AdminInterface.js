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
exports.AdminInterface = void 0;
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const useKnowledgeBase_1 = require("../../hooks/knowledge-base/useKnowledgeBase");
const useAuth_1 = require("../../hooks/useAuth");
const AdminHeader_1 = require("./AdminHeader");
const ArticleList_1 = require("./ArticleList");
const ArticleForm_1 = require("./ArticleForm");
const CategoryManager_1 = require("./CategoryManager");
const AnalyticsPanel_1 = require("./AnalyticsPanel");
const LoadingSpinner_1 = require("../common/LoadingSpinner");
const ErrorMessage_1 = require("../common/ErrorMessage");
const AdminInterface = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const { user } = (0, useAuth_1.useAuth)();
    const { articles, categories, tags, loading, error, createArticle, updateArticle, deleteArticle, refetch, } = (0, useKnowledgeBase_1.useKnowledgeBase)();
    const [currentView, setCurrentView] = (0, react_1.useState)('list');
    const [selectedArticle, setSelectedArticle] = (0, react_1.useState)(null);
    const [searchTerm, setSearchTerm] = (0, react_1.useState)('');
    const [statusFilter, setStatusFilter] = (0, react_1.useState)('all');
    if (!user || !['ADMIN', 'LAWYER'].includes(user.role)) {
        return (<div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">
            您没有访问知识库管理界面的权限
          </p>
          <button onClick={() => navigate('/knowledge-base')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            返回知识库
          </button>
        </div>
      </div>);
    }
    const filteredArticles = articles.filter(article => {
        const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    const handleCreateArticle = async (data) => {
        try {
            await createArticle(data);
            setCurrentView('list');
            await refetch();
        }
        catch (err) {
            console.error('Error creating article:', err);
        }
    };
    const handleUpdateArticle = async (data) => {
        if (!selectedArticle)
            return;
        try {
            await updateArticle(selectedArticle.id, data);
            setCurrentView('list');
            setSelectedArticle(null);
            await refetch();
        }
        catch (err) {
            console.error('Error updating article:', err);
        }
    };
    const handleDeleteArticle = async (articleId) => {
        if (!window.confirm('确定要删除这篇文章吗？此操作不可撤销。')) {
            return;
        }
        try {
            await deleteArticle(articleId);
            await refetch();
        }
        catch (err) {
            console.error('Error deleting article:', err);
        }
    };
    const handleEditArticle = (article) => {
        setSelectedArticle(article);
        setCurrentView('edit');
    };
    const renderContent = () => {
        if (loading) {
            return (<div className="flex justify-center items-center h-64">
          <LoadingSpinner_1.LoadingSpinner size="large"/>
        </div>);
        }
        if (error) {
            return (<div className="p-6">
          <ErrorMessage_1.ErrorMessage message={error} onRetry={refetch}/>
        </div>);
        }
        switch (currentView) {
            case 'create':
                return (<ArticleForm_1.ArticleForm onSubmit={handleCreateArticle} onCancel={() => setCurrentView('list')} categories={categories} availableTags={tags}/>);
            case 'edit':
                return selectedArticle ? (<ArticleForm_1.ArticleForm article={selectedArticle} onSubmit={handleUpdateArticle} onCancel={() => {
                        setCurrentView('list');
                        setSelectedArticle(null);
                    }} categories={categories} availableTags={tags}/>) : null;
            case 'categories':
                return (<CategoryManager_1.CategoryManager categories={categories} onCategoriesUpdated={refetch}/>);
            case 'analytics':
                return (<AnalyticsPanel_1.AnalyticsPanel />);
            default:
                return (<ArticleList_1.ArticleList articles={filteredArticles} onEdit={handleEditArticle} onDelete={handleDeleteArticle} onCreate={() => setCurrentView('create')} searchTerm={searchTerm} onSearchChange={setSearchTerm} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}/>);
        }
    };
    return (<div className="min-h-screen bg-gray-50">
      <AdminHeader_1.AdminHeader currentView={currentView} onViewChange={setCurrentView} onBackToPortal={() => navigate('/knowledge-base')} articleCount={articles.length}/>

      <div className="container mx-auto px-4 py-6">
        {renderContent()}
      </div>
    </div>);
};
exports.AdminInterface = AdminInterface;
//# sourceMappingURL=AdminInterface.js.map