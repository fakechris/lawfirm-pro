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
exports.SearchBar = void 0;
const react_1 = __importStar(require("react"));
const useSearchSuggestions_1 = require("../../hooks/knowledge-base/useSearchSuggestions");
const SearchBar = ({ value, onChange, placeholder = '搜索...', className = '', onSearch, }) => {
    const [showSuggestions, setShowSuggestions] = (0, react_1.useState)(false);
    const [selectedIndex, setSelectedIndex] = (0, react_1.useState)(-1);
    const inputRef = (0, react_1.useRef)(null);
    const suggestionsRef = (0, react_1.useRef)(null);
    const { suggestions, loading: suggestionsLoading } = (0, useSearchSuggestions_1.useSearchSuggestions)(value);
    (0, react_1.useEffect)(() => {
        const handleClickOutside = (event) => {
            if (inputRef.current && !inputRef.current.contains(event.target) &&
                suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const handleInputChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue);
        setShowSuggestions(newValue.length > 0);
        setSelectedIndex(-1);
    };
    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0)
            return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                    handleSuggestionClick(suggestions[selectedIndex]);
                }
                else if (onSearch) {
                    onSearch(value);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    };
    const handleSuggestionClick = (suggestion) => {
        onChange(suggestion);
        setShowSuggestions(false);
        setSelectedIndex(-1);
        if (onSearch) {
            onSearch(suggestion);
        }
    };
    const handleSearchClick = () => {
        if (onSearch && value.trim()) {
            onSearch(value.trim());
        }
    };
    return (<div className={`relative ${className}`}>
      <div className="relative">
        <input ref={inputRef} type="text" value={value} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => setShowSuggestions(value.length > 0)} placeholder={placeholder} className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
        <button onClick={handleSearchClick} disabled={!value.trim()} className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </button>
      </div>

      
      {showSuggestions && (value.length > 0) && (<div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {suggestionsLoading ? (<div className="p-3 text-center">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">搜索建议...</span>
            </div>) : suggestions.length > 0 ? (<div className="py-1">
              {suggestions.map((suggestion, index) => (<button key={index} onClick={() => handleSuggestionClick(suggestion)} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    {suggestion}
                  </div>
                </button>))}
            </div>) : (<div className="p-3 text-center text-sm text-gray-500">
              无搜索建议
            </div>)}
        </div>)}

      
      {!showSuggestions && value.length === 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900">搜索历史</h4>
          </div>
          <div className="py-1">
            {['合同纠纷', '劳动争议', '医疗纠纷', '刑事辩护', '离婚家事'].map((term, index) => (<button key={index} onClick={() => handleSuggestionClick(term)} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {term}
                  </div>
                  <span className="text-xs text-gray-400">最近</span>
                </div>
              </button>))}
          </div>
        </div>)}
    </div>);
};
exports.SearchBar = SearchBar;
//# sourceMappingURL=SearchBar.js.map