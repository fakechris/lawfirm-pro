import { SearchIndex } from '@prisma/client';

// Core Search Types
export interface SearchIndexWithDetails extends SearchIndex {
  metadata?: Record<string, unknown>;
}

export interface SearchResult<T = unknown> {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  score: number;
  highlights: string[];
  data: T;
  metadata: {
    category?: string;
    type?: string;
    mimeType?: string;
    caseId?: string;
    clientId?: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
  };
}

export interface SearchResults<T = unknown> {
  results: SearchResult<T>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string;
  filters: SearchFilters;
  suggestions: string[];
  took: number; // milliseconds
  facets?: SearchFacets;
}

export interface SearchFilters {
  type?: string[];
  category?: string[];
  caseId?: string[];
  clientId?: string[];
  uploadedById?: string[];
  tags?: string[];
  mimeType?: string[];
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
}

export interface SearchFacets {
  type: Array<{
    value: string;
    count: number;
  }>;
  category: Array<{
    value: string;
    count: number;
  }>;
  mimeType: Array<{
    value: string;
    count: number;
  }>;
  status: Array<{
    value: string;
    count: number;
  }>;
  tags: Array<{
    value: string;
    count: number;
  }>;
  dateRange: Array<{
    label: string;
    count: number;
    start: Date;
    end: Date;
  }>;
}

// Search Query Types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  pagination?: SearchPagination;
  sorting?: SearchSorting;
  options?: SearchOptions;
}

export interface SearchPagination {
  page: number;
  limit: number;
  offset?: number;
}

export interface SearchSorting {
  sortBy: 'relevance' | 'date' | 'title' | 'size' | 'type';
  sortOrder: 'asc' | 'desc';
}

export interface SearchOptions {
  fuzzySearch?: boolean;
  includeDeleted?: boolean;
  searchInContent?: boolean;
  searchInMetadata?: boolean;
  highlightResults?: boolean;
  suggestCorrections?: boolean;
  returnFacets?: boolean;
  minScore?: number;
  maxResults?: number;
}

// Document Search Types
export interface DocumentSearchParams extends SearchQuery {
  filters?: SearchFilters & {
    documentType?: string[];
    isConfidential?: boolean;
    isTemplate?: boolean;
    extractedText?: boolean;
  };
}

export interface DocumentSearchResult extends SearchResult<{
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  extractedText?: string;
}> {
  documentType?: string;
  isConfidential?: boolean;
  isTemplate?: boolean;
}

// Evidence Search Types
export interface EvidenceSearchParams extends SearchQuery {
  filters?: SearchFilters & {
    evidenceType?: string[];
    collectedBy?: string[];
    location?: string[];
    chainOfCustody?: boolean;
  };
}

export interface EvidenceSearchResult extends SearchResult<{
  title: string;
  description?: string;
  filePath?: string;
  size?: number;
  mimeType?: string;
  collectedAt: Date;
}> {
  evidenceType?: string;
  location?: string;
  collectedBy?: string;
}

// User Search Types
export interface UserSearchParams extends SearchQuery {
  filters?: SearchFilters & {
    role?: string[];
    status?: string[];
    department?: string[];
  };
}

export interface UserSearchResult extends SearchResult<{
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}> {
  department?: string;
}

// Case Search Types
export interface CaseSearchParams extends SearchQuery {
  filters?: SearchFilters & {
    caseType?: string[];
    phase?: string[];
    status?: string[];
    leadLawyer?: string[];
  };
}

export interface CaseSearchResult extends SearchResult<{
  caseNumber: string;
  title: string;
  description?: string;
  startDate: Date;
}> {
  caseType?: string;
  phase?: string;
  status?: string;
  leadLawyer?: string;
}

// Indexing Types
export interface IndexDocumentOptions {
  content: string;
  metadata?: Record<string, unknown>;
  boost?: number;
  language?: string;
  analyzer?: string;
}

export interface IndexUpdateOptions {
  content?: string;
  metadata?: Record<string, unknown>;
  boost?: number;
}

export interface IndexResult {
  success: boolean;
  documentId: string;
  indexTime: number;
  error?: string;
}

// Search Analytics Types
export interface SearchAnalytics {
  totalQueries: number;
  averageResults: number;
  averageQueryTime: number;
  topQueries: Array<{
    query: string;
    count: number;
    averageResults: number;
  }>;
  noResultQueries: Array<{
    query: string;
    count: number;
  }>;
  topFilters: Array<{
    filter: string;
    value: string;
    count: number;
  }>;
  byType: Array<{
    type: string;
    queries: number;
    results: number;
  }>;
  performance: {
    averageTime: number;
    p95Time: number;
    p99Time: number;
  };
}

export interface SearchSession {
  id: string;
  userId?: string;
  sessionId: string;
  query: string;
  results: number;
  clickedResults: string[];
  filters: SearchFilters;
  timestamp: Date;
  duration: number;
}

// Search Suggestion Types
export interface SearchSuggestion {
  text: string;
  score: number;
  type: 'query' | 'document' | 'tag' | 'user';
  context?: string;
}

export interface SearchAutocompleteResult {
  query: string;
  suggestions: SearchSuggestion[];
  took: number;
}

// Search Configuration Types
export interface SearchConfig {
  engine: 'postgresql' | 'elasticsearch' | 'meilisearch' | 'typesense';
  indexName: string;
  settings: {
    maxResults: number;
    defaultLimit: number;
    fuzzySearch: boolean;
    minQueryLength: number;
    highlightFragmentSize: number;
    maxHighlightFragments: number;
  };
  analyzers: {
    default: string;
    languages: Record<string, string>;
  };
  boost: {
    title: number;
    content: number;
    metadata: number;
    tags: number;
  };
  features: {
    synonyms: boolean;
    stopWords: boolean;
    stemming: boolean;
    phonetic: boolean;
  };
}

// Synonym Management Types
export interface SynonymSet {
  id: string;
  terms: string[];
  type: 'equivalent' | 'expansion' | 'contraction';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SynonymSuggestion {
  term: string;
  suggestions: string[];
  confidence: number;
  frequency: number;
}

// Stop Word Management Types
export interface StopWordList {
  id: string;
  name: string;
  language: string;
  words: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Search Monitoring Types
export interface SearchMetrics {
  performance: {
    averageQueryTime: number;
    p95QueryTime: number;
    p99QueryTime: number;
    indexTime: number;
  };
  usage: {
    totalQueries: number;
    uniqueUsers: number;
    averageResultsPerQuery: number;
    clickThroughRate: number;
  };
  errors: Array<{
    code: string;
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
  index: {
    totalDocuments: number;
    size: number;
    health: 'green' | 'yellow' | 'red';
  };
}

export interface SearchAlert {
  id: string;
  type: 'performance' | 'usage' | 'error' | 'index';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// Search Event Types
export interface SearchEvent {
  type: 'query' | 'click' | 'filter' | 'sort' | 'page';
  userId?: string;
  sessionId: string;
  query?: string;
  results?: number;
  clickedDocument?: string;
  filters?: SearchFilters;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Export Types
export interface SearchExportOptions {
  format: 'csv' | 'json' | 'excel';
  includeHeaders?: boolean;
  fields?: string[];
  filters?: SearchFilters;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SearchExportResult {
  success: boolean;
  filePath?: string;
  filename?: string;
  size?: number;
  recordCount?: number;
  error?: string;
}

// Error Types
export interface SearchError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
  query?: string;
}

// Integration Types
export interface SearchWebhookPayload {
  event: string;
  query?: string;
  results?: number;
  user?: {
    id: string;
    name: string;
  };
  timestamp: Date;
  metadata?: Record<string, unknown>;
}