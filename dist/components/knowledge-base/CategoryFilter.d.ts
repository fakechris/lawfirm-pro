import React from 'react';
interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    articleCount?: number;
}
interface CategoryFilterProps {
    categories: Category[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
}
export declare const CategoryFilter: React.FC<CategoryFilterProps>;
export {};
//# sourceMappingURL=CategoryFilter.d.ts.map