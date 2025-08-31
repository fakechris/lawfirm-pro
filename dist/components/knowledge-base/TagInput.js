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
exports.TagInput = void 0;
const react_1 = __importStar(require("react"));
const TagInput = ({ value, onChange, suggestions = [], placeholder = '添加标签...', maxTags = 10, className = '', }) => {
    const [inputValue, setInputValue] = (0, react_1.useState)('');
    const [showSuggestions, setShowSuggestions] = (0, react_1.useState)(false);
    const [selectedIndex, setSelectedIndex] = (0, react_1.useState)(-1);
    const inputRef = (0, react_1.useRef)(null);
    const suggestionsRef = (0, react_1.useRef)(null);
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
        setInputValue(newValue);
        setShowSuggestions(newValue.length > 0);
        setSelectedIndex(-1);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        }
        else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
            removeTag(value.length - 1);
        }
        else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
        else if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
            }
            else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                addSuggestion(suggestions[selectedIndex]);
            }
        }
    };
    const addTag = () => {
        const tag = inputValue.trim();
        if (tag && !value.includes(tag) && value.length < maxTags) {
            onChange([...value, tag]);
            setInputValue('');
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
    };
    const removeTag = (index) => {
        onChange(value.filter((_, i) => i !== index));
    };
    const addSuggestion = (suggestion) => {
        if (!value.includes(suggestion) && value.length < maxTags) {
            onChange([...value, suggestion]);
            setInputValue('');
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
    };
    const filteredSuggestions = suggestions.filter(suggestion => suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
        !value.includes(suggestion));
    return (<div className={`relative ${className}`}>
      
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md bg-white min-h-[42px]">
        {value.map((tag, index) => (<div key={index} className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            <span>{tag}</span>
            <button type="button" onClick={() => removeTag(index)} className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>))}
        
        
        <input ref={inputRef} type="text" value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => setShowSuggestions(inputValue.length > 0)} placeholder={value.length === 0 ? placeholder : ''} disabled={value.length >= maxTags} className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm"/>
      </div>

      
      {showSuggestions && inputValue.length > 0 && (<div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
          {filteredSuggestions.length > 0 ? (<div className="py-1">
              {filteredSuggestions.slice(0, 8).map((suggestion, index) => (<button key={suggestion} type="button" onClick={() => addSuggestion(suggestion)} className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
                  {suggestion}
                </button>))}
            </div>) : (<div className="px-3 py-2 text-sm text-gray-500 text-center">
              {value.length >= maxTags ? '已达到最大标签数量' : '无匹配的标签'}
            </div>)}
        </div>)}

      
      <div className="absolute bottom-2 right-2 text-xs text-gray-400">
        {value.length}/{maxTags}
      </div>

      
      <div className="mt-1 text-xs text-gray-500">
        按 Enter 或逗号添加标签，最多 {maxTags} 个
      </div>
    </div>);
};
exports.TagInput = TagInput;
//# sourceMappingURL=TagInput.js.map