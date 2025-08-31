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

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
}) => {
  const handleCategoryClick = (categorySlug: string) => {
    if (selectedCategory === categorySlug) {
      onCategoryChange('');
    } else {
      onCategoryChange(categorySlug);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => handleCategoryClick('')}
        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          selectedCategory === ''
            ? 'bg-blue-100 text-blue-800'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center justify-between">
          <span>全部分类</span>
          <span className="text-xs text-gray-500">
            {categories.reduce((total, cat) => total + (cat.articleCount || 0), 0)}
          </span>
        </div>
      </button>
      
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => handleCategoryClick(category.slug)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedCategory === category.slug
              ? 'bg-blue-100 text-blue-800'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{category.name}</span>
            {category.articleCount !== undefined && (
              <span className="text-xs text-gray-500">
                {category.articleCount}
              </span>
            )}
          </div>
          {category.description && (
            <p className="text-xs text-gray-500 mt-1">
              {category.description}
            </p>
          )}
        </button>
      ))}
    </div>
  );
};