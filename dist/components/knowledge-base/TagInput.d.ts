import React from 'react';
interface TagInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
    suggestions?: string[];
    placeholder?: string;
    maxTags?: number;
    className?: string;
}
export declare const TagInput: React.FC<TagInputProps>;
export {};
//# sourceMappingURL=TagInput.d.ts.map