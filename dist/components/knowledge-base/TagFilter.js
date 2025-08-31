"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagFilter = void 0;
const react_1 = __importDefault(require("react"));
const TagFilter = ({ tags, selectedTags, onTagToggle, }) => {
    const handleTagClick = (tag) => {
        onTagToggle(tag);
    };
    const sortedTags = [...tags].sort();
    return (<div className="space-y-2">
      <div className="text-xs text-gray-500 mb-2">
        已选择 {selectedTags.length} 个标签
      </div>
      
      <div className="max-h-48 overflow-y-auto space-y-1">
        {sortedTags.map((tag) => (<button key={tag} onClick={() => handleTagClick(tag)} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${selectedTags.includes(tag)
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-700 hover:bg-gray-100'}`}>
            <div className="flex items-center">
              <svg className={`w-4 h-4 mr-2 ${selectedTags.includes(tag) ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {selectedTags.includes(tag) ? (<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>) : (<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>)}
              </svg>
              <span className="truncate">{tag}</span>
            </div>
          </button>))}
      </div>

      
      {selectedTags.length > 0 && (<button onClick={() => selectedTags.forEach(tag => onTagToggle(tag))} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mt-2">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
            清除所有标签
          </div>
        </button>)}

      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs font-medium text-gray-700 mb-2">热门标签</div>
        <div className="flex flex-wrap gap-1">
          {['合同', '诉讼', '证据', '调解', '仲裁', '判决', '执行', '上诉'].map((popularTag) => (<button key={popularTag} onClick={() => handleTagClick(popularTag)} className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${selectedTags.includes(popularTag)
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {popularTag}
            </button>))}
        </div>
      </div>
    </div>);
};
exports.TagFilter = TagFilter;
//# sourceMappingURL=TagFilter.js.map