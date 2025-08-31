import React from 'react';

export const Recommendations: React.FC = () => {
  const recommendations = [
    {
      title: '合同纠纷处理指南',
      description: '了解合同纠纷的处理流程和最佳实践',
      category: '法律指南',
      views: 1234,
    },
    {
      title: '劳动争议案例分析',
      description: '最新劳动争议案例的深度分析',
      category: '案例分析',
      views: 987,
    },
    {
      title: '诉讼文书模板',
      description: '标准诉讼文书格式和模板',
      category: '模板',
      views: 756,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">为您推荐</h2>
        <p className="text-sm text-gray-600 mt-1">基于您的阅读历史和兴趣</p>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {recommendations.map((item, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                {index + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {item.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {item.views.toLocaleString()} 浏览
                  </span>
                </div>
                
                <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                  {item.title}
                </h3>
                
                <p className="text-xs text-gray-600 line-clamp-2">
                  {item.description}
                </p>
              </div>
              
              <button className="flex-shrink-0 text-blue-600 hover:text-blue-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button className="w-full text-center text-blue-600 hover:text-blue-700 text-sm font-medium">
            查看更多推荐
          </button>
        </div>
      </div>
    </div>
  );
};