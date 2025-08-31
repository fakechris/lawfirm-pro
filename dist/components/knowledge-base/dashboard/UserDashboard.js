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
exports.UserDashboard = void 0;
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const useAuth_1 = require("../../hooks/useAuth");
const useKnowledgeBase_1 = require("../../hooks/knowledge-base/useKnowledgeBase");
const DashboardHeader_1 = require("./DashboardHeader");
const RecentArticles_1 = require("./RecentArticles");
const PopularArticles_1 = require("./PopularArticles");
const UserStats_1 = require("./UserStats");
const QuickActions_1 = require("./QuickActions");
const Recommendations_1 = require("./Recommendations");
const LoadingSpinner_1 = require("../common/LoadingSpinner");
const ErrorMessage_1 = require("../common/ErrorMessage");
const UserDashboard = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const { user } = (0, useAuth_1.useAuth)();
    const { articles, loading, error, refetch } = (0, useKnowledgeBase_1.useKnowledgeBase)();
    const [analytics, setAnalytics] = (0, react_1.useState)(null);
    const [analyticsLoading, setAnalyticsLoading] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const fetchAnalytics = async () => {
            try {
                setAnalyticsLoading(true);
                const mockAnalytics = {
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
            }
            catch (err) {
                console.error('Error fetching analytics:', err);
            }
            finally {
                setAnalyticsLoading(false);
            }
        };
        fetchAnalytics();
    }, [articles]);
    if (loading || analyticsLoading) {
        return (<div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner_1.LoadingSpinner size="large"/>
      </div>);
    }
    if (error) {
        return (<div className="container mx-auto px-4 py-8">
        <ErrorMessage_1.ErrorMessage message={error} onRetry={refetch}/>
      </div>);
    }
    if (!user) {
        return (<div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">
            您需要登录才能访问个人仪表板
          </p>
          <button onClick={() => navigate('/login')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            前往登录
          </button>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-gray-50">
      <DashboardHeader_1.DashboardHeader user={user} onNavigateToPortal={() => navigate('/knowledge-base')} onNavigateToAdmin={() => navigate('/knowledge-base/admin')}/>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                欢迎回来，{user.firstName} {user.lastName}
              </h1>
              <p className="text-gray-600">
                这是您的知识库个人仪表板，您可以查看最新文章、热门内容和个性化推荐。
              </p>
            </div>

            
            <QuickActions_1.QuickActions onCreateArticle={() => navigate('/knowledge-base/admin?view=create')} onBrowseArticles={() => navigate('/knowledge-base')} onSearchArticles={() => {
            navigate('/knowledge-base');
            setTimeout(() => {
                const searchInput = document.querySelector('input[placeholder*="搜索"]');
                if (searchInput instanceof HTMLInputElement) {
                    searchInput.focus();
                }
            }, 100);
        }}/>

            
            {analytics?.recentArticles && (<RecentArticles_1.RecentArticles articles={analytics.recentArticles}/>)}

            
            {analytics?.popularArticles && (<PopularArticles_1.PopularArticles articles={analytics.popularArticles}/>)}
          </div>

          
          <div className="space-y-6">
            
            {analytics && (<UserStats_1.UserStats analytics={analytics}/>)}

            
            <Recommendations_1.Recommendations />
          </div>
        </div>
      </div>
    </div>);
};
exports.UserDashboard = UserDashboard;
//# sourceMappingURL=UserDashboard.js.map