"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStats = void 0;
const react_1 = __importDefault(require("react"));
const UserStats = ({ analytics }) => {
    return (<div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">统计概览</h2>
      </div>
      
      <div className="p-6 space-y-6">
        
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">总文章数</p>
                <p className="text-2xl font-bold text-blue-900">
                  {analytics.totalArticles.toLocaleString()}
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
                  {analytics.totalViews.toLocaleString()}
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
                  {analytics.totalLikes.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">热门分类</h3>
          <div className="space-y-2">
            {analytics.categoryStats.slice(0, 3).map((stat, index) => (<div key={stat.category} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${index === 0 ? 'bg-blue-500' :
                index === 1 ? 'bg-green-500' : 'bg-purple-500'}`}></div>
                  <span className="text-sm text-gray-700">{stat.category}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {stat.count} 篇 · {stat.views.toLocaleString()} 浏览
                </div>
              </div>))}
          </div>
        </div>

        
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">内容类型</h3>
          <div className="space-y-2">
            {analytics.contentTypeStats.slice(0, 3).map((stat) => (<div key={stat.type} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{stat.type}</span>
                <span className="text-xs text-gray-500">{stat.count} 篇</span>
              </div>))}
          </div>
        </div>
      </div>
    </div>);
};
exports.UserStats = UserStats;
//# sourceMappingURL=UserStats.js.map