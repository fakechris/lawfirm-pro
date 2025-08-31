"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickActions = void 0;
const react_1 = __importDefault(require("react"));
const QuickActions = ({ onCreateArticle, onBrowseArticles, onSearchArticles, }) => {
    const actions = [
        {
            title: '创建文章',
            description: '编写新的知识库文章',
            icon: '✍️',
            color: 'bg-blue-500 hover:bg-blue-600',
            onClick: onCreateArticle,
        },
        {
            title: '浏览文章',
            description: '查看所有知识库内容',
            icon: '📚',
            color: 'bg-green-500 hover:bg-green-600',
            onClick: onBrowseArticles,
        },
        {
            title: '搜索文章',
            description: '快速查找需要的内容',
            icon: '🔍',
            color: 'bg-purple-500 hover:bg-purple-600',
            onClick: onSearchArticles,
        },
    ];
    return (<div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">快速操作</h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((action, index) => (<button key={index} onClick={action.onClick} className={`${action.color} text-white rounded-lg p-6 text-left transition-colors transform hover:scale-105`}>
              <div className="text-2xl mb-3">{action.icon}</div>
              <h3 className="text-lg font-medium mb-2">{action.title}</h3>
              <p className="text-sm opacity-90">{action.description}</p>
            </button>))}
        </div>
      </div>
    </div>);
};
exports.QuickActions = QuickActions;
//# sourceMappingURL=QuickActions.js.map