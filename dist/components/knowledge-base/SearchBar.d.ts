import React from 'react';
interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    onSearch?: (query: string) => void;
}
export declare const SearchBar: React.FC<SearchBarProps>;
export {};
//# sourceMappingURL=SearchBar.d.ts.map