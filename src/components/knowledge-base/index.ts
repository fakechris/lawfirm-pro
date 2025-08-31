// Search Interface Components
export { SearchInterface } from './SearchInterface';
export { AdvancedSearch } from './AdvancedSearch';
export { SearchResults } from './SearchResults';

// Core Components
export { KnowledgePortal } from './KnowledgePortal';
export { KnowledgeCard } from './KnowledgeCard';
export { SearchBar } from './SearchBar';

// Navigation Components
export { ContentNavigation } from './ContentNavigation';
export { CategoryBrowser } from './CategoryBrowser';
export { TagCloud } from './TagCloud';

// Admin Components
export { AdminInterface } from './admin/AdminInterface';

// Dashboard Components
export { UserDashboard } from './dashboard/UserDashboard';
export { DashboardHeader } from './dashboard/DashboardHeader';
export { RecentArticles } from './dashboard/RecentArticles';
export { PopularArticles } from './dashboard/PopularArticles';
export { UserStats } from './dashboard/UserStats';
export { QuickActions } from './dashboard/QuickActions';
export { Recommendations } from './dashboard/Recommendations';

// Types
export type {
  KnowledgeBaseArticle,
  KnowledgeBaseCategory,
  KnowledgeBaseTag,
  SearchFilters,
  SearchSuggestion,
  SearchResult,
  KnowledgeAnalytics,
  CategoryStat,
  ContentTypeStat,
  UserActivity,
  ArticleForm,
  CategoryForm,
  TagForm,
} from '../../../types/knowledge-base';

// Hooks
export { useKnowledgeBase } from '../../hooks/knowledge-base/useKnowledgeBase';
export { useSearch } from '../../hooks/knowledge-base/useSearch';