"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminHeader = void 0;
const react_1 = __importDefault(require("react"));
const AdminHeader = ({ currentView, onViewChange, onBackToPortal, articleCount, }) => {
    const navigationItems = [
        { key: 'list', label: '文章管理', icon: '📝' },
        { key: 'create', label: '创建文章', icon: '➕' },
        { key: 'categories', label: '分类管理', icon: '📁' },
        { key: 'analytics', label: '数据分析', icon: '📊' },
    ];
    const getViewTitle = () => {
        switch (currentView) {
            case 'list':
                return '文章管理';
            case 'create':
                return '创建文章';
            case 'edit':
                return '编辑文章';
            case 'categories':
                return '分类管理';
            case 'analytics':
                return '数据分析';
            default:
                return '知识库管理';
        }
    };
    return (<div className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          
          <div className="flex items-center space-x-4 mb-4 lg:mb-0">
            <button onClick={onBackToPortal} className="flex items-center text-blue-600 hover:text-blue-700 transition-colors">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              返回知识库
            </button>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <h1 className="text-2xl font-bold text-gray-900">
              {getViewTitle()}
            </h1>
            
            {currentView === 'list' && (<div className="flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                <span className="font-medium">{articleCount}</span>
                <span className="ml-1">篇文章</span>
              </div>)}
          </div>

          
          <div className="flex items-center space-x-2">
            <nav className="flex space-x-1">
              {navigationItems.map((item) => (<button key={item.key} onClick={() => onViewChange(item.key)} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === item.key
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>))}
            </nav>
          </div>
        </div>

        
        <div className="mt-4 flex items-center text-sm text-gray-500">
          <span>知识库</span>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
          <span>管理后台</span>
          {currentView !== 'list' && (<>
              <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
              <span className="text-gray-900">{getViewTitle()}</span>
            </>)}
        </div>
      </div>
    </div>);
};
exports.AdminHeader = AdminHeader;
//# sourceMappingURL=AdminHeader.js.map