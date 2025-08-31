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
exports.CategoryManager = void 0;
const react_1 = __importStar(require("react"));
const CategoryManager = ({ categories, onCategoriesUpdated, }) => {
    const [isCreating, setIsCreating] = (0, react_1.useState)(false);
    const [editingCategory, setEditingCategory] = (0, react_1.useState)(null);
    return (<div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">分类管理</h2>
          <button onClick={() => setIsCreating(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            创建分类
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {categories.length === 0 ? (<div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
              <p>暂无分类，点击上方按钮创建第一个分类</p>
            </div>) : (categories.map((category) => (<div key={category.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50">
                <div>
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                  {category.description && (<p className="text-sm text-gray-600 mt-1">{category.description}</p>)}
                  <div className="flex items-center mt-2 text-xs text-gray-500">
                    <span>Slug: {category.slug}</span>
                    {category.articleCount !== undefined && (<span className="ml-4">文章数: {category.articleCount}</span>)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => setEditingCategory(category)} className="text-blue-600 hover:text-blue-700 transition-colors">
                    编辑
                  </button>
                  <button className="text-red-600 hover:text-red-700 transition-colors">
                    删除
                  </button>
                </div>
              </div>)))}
        </div>
      </div>
    </div>);
};
exports.CategoryManager = CategoryManager;
//# sourceMappingURL=CategoryManager.js.map