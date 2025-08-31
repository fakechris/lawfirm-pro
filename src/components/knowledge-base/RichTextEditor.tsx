import React, { useState, useRef, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '请输入内容...',
  className = '',
}) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Simple toolbar actions
  const insertText = (before: string, after: string = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = before + selectedText + after;
    
    const newValue = value.substring(0, start) + newText + value.substring(end);
    onChange(newValue);

    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selectedText.length;
      textarea.focus();
    }, 0);
  };

  const handleShortcut = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertText('**', '**');
          break;
        case 'i':
          e.preventDefault();
          insertText('*', '*');
          break;
        case 'u':
          e.preventDefault();
          insertText('__', '__');
          break;
      }
    }
  };

  const formatOptions = [
    { key: 'bold', label: '粗体', icon: 'B', shortcut: 'Ctrl+B', action: () => insertText('**', '**') },
    { key: 'italic', label: '斜体', icon: 'I', shortcut: 'Ctrl+I', action: () => insertText('*', '*') },
    { key: 'underline', label: '下划线', icon: 'U', shortcut: 'Ctrl+U', action: () => insertText('__', '__') },
    { key: 'heading', label: '标题', icon: 'H', action: () => insertText('## ', '') },
    { key: 'list', label: '列表', icon: '•', action: () => insertText('- ', '') },
    { key: 'numbered-list', label: '编号列表', icon: '1.', action: () => insertText('1. ', '') },
    { key: 'quote', label: '引用', icon: '"', action: () => insertText('> ', '') },
    { key: 'code', label: '代码', icon: '</>', action: () => insertText('`', '`') },
    { key: 'link', label: '链接', icon: '🔗', action: () => insertText('[', '](url)') },
  ];

  return (
    <div className={`border border-gray-300 rounded-md ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 bg-gray-50">
        <div className="flex flex-wrap gap-1">
          {formatOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={option.action}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
              title={`${option.label} (${option.shortcut})`}
            >
              <span className="text-sm font-medium">{option.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          ref={editorRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleShortcut}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={12}
          className="w-full px-4 py-3 border-0 rounded-b-md focus:outline-none resize-none"
        />
        
        {/* Character count */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {value.length} 字符
        </div>
      </div>

      {/* Markdown Help */}
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        <div className="text-xs text-gray-600">
          <p className="font-medium mb-1">Markdown 格式支持：</p>
          <div className="grid grid-cols-2 gap-2">
            <span>**粗体** → 粗体</span>
            <span>*斜体* → 斜体</span>
            <span>## 标题 → 标题</span>
            <span>- 列表 → 列表</span>
            <span>> 引用 → 引用</span>
            <span>`代码` → 代码</span>
          </div>
        </div>
      </div>
    </div>
  );
};