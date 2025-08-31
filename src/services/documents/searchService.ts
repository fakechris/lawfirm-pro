import { PrismaClient } from '@prisma/client';
import { 
  DocumentSearchOptions,
  SearchResult,
  DocumentSearchFilters,
  SearchFacet,
  SearchSuggestion,
  SearchAnalytics,
  DocumentWithDetails
} from '../../models/documents';
import { DOCUMENT_ERROR_CODES } from '../../models/documents/models';

export interface DocumentSearchIndex {
  id: string;
  documentId: string;
  content: string;
  metadata: {
    title: string;
    category?: string;
    mimeType: string;
    tags: string[];
    uploadedAt: Date;
    uploadedBy: string;
    caseId?: string;
    clientId?: string;
    language?: string;
    wordCount?: number;
    charCount?: number;
    entities?: Array<{
      type: string;
      text: string;
      confidence: number;
    }>;
    keywords?: string[];
  };
  vector?: number[];
  relevanceScore?: number;
  searchTokens?: string[];
  lastIndexed: Date;
}

export class DocumentSearchService {
  private prisma: PrismaClient;
  private indexCache: Map<string, DocumentSearchIndex> = new Map();
  private searchHistory: Map<string, Array<{ query: string; timestamp: Date; results: number }>> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async indexDocument(documentId: string): Promise<void> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            select: {
              id: true,
              title: true
            }
          },
          client: {
            select: {
              id: true,
              name: true
            }
          },
          versions: {
            take: 1,
            orderBy: { versionNumber: 'desc' }
          }
        }
      });

      if (!document) return;

      // Prepare searchable content
      const searchableContent = this.prepareSearchableContent(document);

      // Extract search tokens for better search performance
      const searchTokens = this.extractSearchTokens(searchableContent);

      // Create enhanced search index
      const searchIndex: DocumentSearchIndex = {
        id: `doc_${documentId}`,
        documentId,
        content: searchableContent,
        metadata: {
          title: document.originalName,
          category: document.category || undefined,
          mimeType: document.mimeType,
          tags: document.tags,
          uploadedAt: document.uploadedAt,
          uploadedBy: document.uploadedBy,
          caseId: document.caseId || undefined,
          clientId: document.clientId || undefined,
          language: document.language || undefined,
          wordCount: document.wordCount || undefined,
          charCount: document.charCount || undefined,
          keywords: this.extractKeywords(searchableContent),
          entities: this.extractEntitiesFromContent(searchableContent)
        },
        searchTokens,
        lastIndexed: new Date()
      };

      // Generate enhanced vector embedding
      searchIndex.vector = await this.generateVectorEmbedding(searchableContent, searchIndex.metadata);

      // Store in database with enhanced metadata
      await this.prisma.searchIndex.upsert({
        where: { entityId: documentId },
        update: {
          content: searchableContent,
          metadata: searchIndex.metadata,
          vector: searchIndex.vector,
          updatedAt: new Date()
        },
        create: {
          entityId: documentId,
          entityType: 'document',
          content: searchableContent,
          metadata: searchIndex.metadata,
          vector: searchIndex.vector
        }
      });

      // Update cache
      this.indexCache.set(documentId, searchIndex);
    } catch (error) {
      console.error(`Failed to index document ${documentId}:`, error);
    }
  }

  async searchDocuments(query: string, options: DocumentSearchOptions = {}): Promise<SearchResult[]> {
    const {
      caseId,
      clientId,
      category,
      tags,
      mimeType,
      language,
      dateFrom,
      dateTo,
      fuzzySearch = true,
      searchInContent = true,
      searchInMetadata = true,
      limit = 20,
      offset = 0,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options;

    try {
      // Record search for analytics
      this.recordSearch(query, options);

      // Build search conditions
      const whereConditions: any[] = [
        {
          entityType: 'document'
        }
      ];

      // Build text search conditions
      if (query && query.trim()) {
        const searchQuery = query.trim().toLowerCase();
        const textSearchConditions: any[] = [];

        if (searchInContent) {
          if (fuzzySearch) {
            // Fuzzy search in content
            textSearchConditions.push({
              content: {
                contains: searchQuery,
                mode: 'insensitive'
              }
            });
          } else {
            // Exact search in content
            textSearchConditions.push({
              searchTokens: {
                hasSome: this.extractSearchTokens(searchQuery)
              }
            });
          }
        }

        if (searchInMetadata) {
          // Search in title
          textSearchConditions.push({
            metadata: {
              path: ['title'],
              string_contains: searchQuery
            }
          });

          // Search in keywords
          textSearchConditions.push({
            metadata: {
              path: ['keywords'],
              array_contains: [searchQuery]
            }
          });

          // Search in tags
          textSearchConditions.push({
            metadata: {
              path: ['tags'],
              array_contains: [searchQuery]
            }
          });
        }

        if (textSearchConditions.length > 0) {
          whereConditions.push({
            OR: textSearchConditions
          });
        }
      }

      // Add metadata filters
      if (caseId) {
        whereConditions.push({
          metadata: {
            path: ['caseId'],
            equals: caseId
          }
        });
      }

      if (clientId) {
        whereConditions.push({
          metadata: {
            path: ['clientId'],
            equals: clientId
          }
        });
      }

      if (category) {
        whereConditions.push({
          metadata: {
            path: ['category'],
            equals: category
          }
        });
      }

      if (mimeType) {
        whereConditions.push({
          metadata: {
            path: ['mimeType'],
            string_contains: mimeType
          }
        });
      }

      if (language) {
        whereConditions.push({
          metadata: {
            path: ['language'],
            equals: language
          }
        });
      }

      if (tags && tags.length > 0) {
        whereConditions.push({
          metadata: {
            path: ['tags'],
            array_contains: tags
          }
        });
      }

      if (dateFrom || dateTo) {
        const dateFilter: any = {};
        if (dateFrom) dateFilter.gte = dateFrom;
        if (dateTo) dateFilter.lte = dateTo;
        
        whereConditions.push({
          metadata: {
            path: ['uploadedAt'],
            ...dateFilter
          }
        });
      }

      const searchResults = await this.prisma.searchIndex.findMany({
        where: {
          AND: whereConditions
        },
        include: {
          document: {
            include: {
              case: true,
              client: true,
              uploadedByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              versions: {
                take: 1,
                orderBy: { versionNumber: 'desc' }
              }
            }
          }
        },
        orderBy: this.buildOrderBy(sortBy, sortOrder, query),
        take: limit,
        skip: offset
      });

      // Calculate relevance scores and enhance results
      const enhancedResults = searchResults.map(result => {
        const relevanceScore = this.calculateRelevanceScore(result.content, query, result.metadata);
        
        return {
          id: result.entityId,
          type: 'document',
          title: result.document?.originalName || 'Unknown',
          excerpt: this.generateExcerpt(result.content, query),
          score: relevanceScore,
          highlights: this.generateHighlights(result.content, query),
          metadata: {
            category: result.document?.category,
            mimeType: result.document?.mimeType,
            caseId: result.document?.caseId,
            clientId: result.document?.clientId,
            tags: result.document?.tags || [],
            language: result.document?.language,
            wordCount: result.document?.wordCount,
            uploadedAt: result.document?.uploadedAt || result.createdAt,
            uploadedBy: result.document?.uploadedBy,
            caseTitle: result.document?.case?.title,
            clientName: result.document?.client?.name
          }
        };
      });

      return enhancedResults;
    } catch (error) {
      console.error('Document search failed:', error);
      return [];
    }
  }

  async searchByVector(queryVector: number[], limit: number = 10): Promise<SearchResult[]> {
    try {
      // This would use pgvector for similarity search
      // For now, return empty array as simplified implementation
      return [];
    } catch (error) {
      console.error('Vector search failed:', error);
      return [];
    }
  }

  async bulkIndexDocuments(documentIds: string[]): Promise<void> {
    for (const documentId of documentIds) {
      await this.indexDocument(documentId);
    }
  }

  async reindexAllDocuments(): Promise<void> {
    const documents = await this.prisma.document.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    const documentIds = documents.map(doc => doc.id);
    await this.bulkIndexDocuments(documentIds);
  }

  async removeFromIndex(documentId: string): Promise<void> {
    try {
      await this.prisma.searchIndex.delete({
        where: { entityId: documentId }
      });
      this.indexCache.delete(documentId);
    } catch (error) {
      console.error(`Failed to remove document ${documentId} from index:`, error);
    }
  }

  async getSearchStats(): Promise<{
    totalIndexed: number;
    averageContentLength: number;
    lastIndexed: Date | null;
    byCategory: Record<string, number>;
  }> {
    try {
      const stats = await this.prisma.searchIndex.aggregate({
        where: { entityType: 'document' },
        _count: { id: true },
        _avg: {
          content: {
            length: true
          }
        },
        _max: {
          createdAt: true
        }
      });

      const categoryStats = await this.prisma.searchIndex.groupBy({
        by: ['metadata'],
        where: { entityType: 'document' },
        _count: { id: true }
      });

      const byCategory: Record<string, number> = {};
      categoryStats.forEach(stat => {
        const metadata = stat.metadata as any;
        if (metadata.category) {
          byCategory[metadata.category] = (byCategory[metadata.category] || 0) + stat._count.id;
        }
      });

      return {
        totalIndexed: stats._count.id,
        averageContentLength: stats._avg.content?.length || 0,
        lastIndexed: stats._max.createdAt,
        byCategory
      };
    } catch (error) {
      console.error('Failed to get search stats:', error);
      return {
        totalIndexed: 0,
        averageContentLength: 0,
        lastIndexed: null,
        byCategory: {}
      };
    }
  }

  private prepareSearchableContent(document: any): string {
    const contentParts: string[] = [];

    // Add document title
    contentParts.push(document.originalName);

    // Add extracted text from OCR
    if (document.extractedText) {
      contentParts.push(document.extractedText);
    }

    // Add description
    if (document.description) {
      contentParts.push(document.description);
    }

    // Add tags
    if (document.tags && document.tags.length > 0) {
      contentParts.push(document.tags.join(' '));
    }

    // Add case title if available
    if (document.case?.title) {
      contentParts.push(document.case.title);
    }

    // Add metadata fields
    if (document.metadata) {
      const metadata = document.metadata as any;
      Object.entries(metadata).forEach(([key, value]) => {
        if (typeof value === 'string') {
          contentParts.push(value);
        }
      });
    }

    return contentParts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private async generateVectorEmbedding(content: string): Promise<number[]> {
    // Simplified vector embedding generation
    // In a real implementation, this would use a proper embedding model
    const words = content.toLowerCase().split(/\s+/);
    const vocabulary = new Set(words);
    const vectorSize = Math.min(1536, vocabulary.size); // Standard embedding size
    const vector = new Array(vectorSize).fill(0);

    // Simple term frequency vector (simplified)
    words.forEach((word, index) => {
      const hash = this.simpleHash(word) % vectorSize;
      vector[hash] += 1;
    });

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vector.map(val => val / magnitude);
    }

    return vector;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private generateExcerpt(content: string, query: string): string {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const queryIndex = contentLower.indexOf(queryLower);

    if (queryIndex === -1) {
      // If query not found, return first 200 characters
      return content.length > 200 ? content.substring(0, 200) + '...' : content;
    }

    // Return excerpt around the query match
    const start = Math.max(0, queryIndex - 100);
    const end = Math.min(content.length, queryIndex + query.length + 100);
    const excerpt = content.substring(start, end);

    return (start > 0 ? '...' : '') + excerpt + (end < content.length ? '...' : '');
  }

  private calculateRelevanceScore(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    let score = 0;
    
    // Exact match bonus
    if (contentLower.includes(queryLower)) {
      score += 100;
    }
    
    // Word match bonus
    const queryWords = queryLower.split(/\s+/);
    queryWords.forEach(word => {
      const wordCount = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += wordCount * 10;
    });
    
    // Length penalty (prefer shorter, more focused content)
    const lengthPenalty = Math.min(content.length / 1000, 1);
    score = score * (1 - lengthPenalty * 0.3);
    
    return Math.min(score, 100);
  }

  // Enhanced helper methods for advanced search features

  private extractSearchTokens(content: string): string[] {
    // Extract meaningful search tokens from content
    const tokens = content
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // Keep Chinese characters
      .split(/\s+/)
      .filter(token => token.length > 2) // Filter out very short tokens
      .filter(token => !this.isStopWord(token)); // Remove stop words

    // Return unique tokens
    return [...new Set(tokens)];
  }

  private extractKeywords(content: string): string[] {
    const tokens = this.extractSearchTokens(content);
    
    // Simple keyword extraction based on frequency
    const frequency = new Map<string, number>();
    tokens.forEach(token => {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    });

    // Return top keywords
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([token]) => token);
  }

  private extractEntitiesFromContent(content: string): Array<{
    type: string;
    text: string;
    confidence: number;
  }> {
    const entities: Array<{ type: string; text: string; confidence: number }> = [];
    
    // Extract email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(content)) !== null) {
      entities.push({
        type: 'email',
        text: match[0],
        confidence: 0.95
      });
    }

    // Extract phone numbers (Chinese format)
    const phoneRegex = /(\+86\s?)?1[3-9]\d{9}/g;
    while ((match = phoneRegex.exec(content)) !== null) {
      entities.push({
        type: 'phone',
        text: match[0],
        confidence: 0.9
      });
    }

    // Extract dates
    const dateRegex = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/g;
    while ((match = dateRegex.exec(content)) !== null) {
      entities.push({
        type: 'date',
        text: match[0],
        confidence: 0.85
      });
    }

    // Extract Chinese ID numbers (simplified pattern)
    const idRegex = /\d{17}[\dXx]/g;
    while ((match = idRegex.exec(content)) !== null) {
      entities.push({
        type: 'id_number',
        text: match[0],
        confidence: 0.8
      });
    }

    return entities;
  }

  private isStopWord(word: string): boolean {
    // Common stop words in both English and Chinese
    const stopWords = new Set([
      // English stop words
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      // Chinese stop words
      '的', '了', '在', '是', '我', '你', '他', '她', '它', '们', '这', '那', '这', '和', '与', '或',
      '但是', '因为', '所以', '如果', '虽然', '然而', '因此', '于是', '而且', '并且', '或者'
    ]);
    
    return stopWords.has(word.toLowerCase());
  }

  private async generateVectorEmbedding(content: string, metadata?: any): Promise<number[]> {
    // Enhanced vector embedding generation
    const words = content.toLowerCase().split(/\s+/);
    const vocabulary = new Set(words);
    const vectorSize = Math.min(1536, vocabulary.size);
    const vector = new Array(vectorSize).fill(0);

    // Enhanced term frequency with metadata weighting
    words.forEach((word, index) => {
      const cleanWord = word.replace(/[^\w\u4e00-\u9fff]/g, '');
      if (cleanWord.length > 2) {
        const hash = this.simpleHash(cleanWord) % vectorSize;
        
        // Boost score based on position and metadata
        let boost = 1;
        
        // Title matches get higher weight
        if (metadata?.title && metadata.title.toLowerCase().includes(cleanWord)) {
          boost *= 3;
        }
        
        // Keyword matches get higher weight
        if (metadata?.keywords?.includes(cleanWord)) {
          boost *= 2;
        }
        
        // Earlier words get slightly higher weight
        const positionBoost = 1 + (words.length - index) / words.length * 0.1;
        
        vector[hash] += boost * positionBoost;
      }
    });

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vector.map(val => val / magnitude);
    }

    return vector;
  }

  private buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc', query: string): any[] {
    const order = sortOrder.toLowerCase() as 'asc' | 'desc';
    
    switch (sortBy.toLowerCase()) {
      case 'relevance':
        // For relevance, we need to sort by calculated score
        // Since we can't do this in SQL directly, we'll sort by created date as fallback
        return [{ createdAt: order }];
      case 'date':
        return [{ createdAt: order }];
      case 'title':
        return [
          {
            metadata: {
              path: ['title']
            }
          }
        ];
      case 'size':
        return [
          {
            metadata: {
              path: ['wordCount']
            }
          }
        ];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Find all occurrences of the query
    let index = contentLower.indexOf(queryLower);
    while (index !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + query.length + 50);
      const highlight = content.substring(start, end);
      
      highlights.push(highlight);
      index = contentLower.indexOf(queryLower, index + 1);
    }
    
    // Limit to first 5 highlights
    return highlights.slice(0, 5);
  }

  private recordSearch(query: string, options: any): void {
    const timestamp = new Date();
    const searchKey = 'global';
    
    if (!this.searchHistory.has(searchKey)) {
      this.searchHistory.set(searchKey, []);
    }
    
    const history = this.searchHistory.get(searchKey)!;
    history.push({
      query,
      timestamp,
      results: 0 // Will be updated after search
    });
    
    // Keep only last 100 searches
    if (history.length > 100) {
      history.shift();
    }
  }

  private calculateRelevanceScore(content: string, query: string, metadata?: any): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    let score = 0;
    
    // Exact match bonus
    if (contentLower.includes(queryLower)) {
      score += 100;
    }
    
    // Title match bonus (higher weight)
    if (metadata?.title && metadata.title.toLowerCase().includes(queryLower)) {
      score += 150;
    }
    
    // Keyword match bonus
    if (metadata?.keywords?.some((keyword: string) => keyword.toLowerCase().includes(queryLower))) {
      score += 80;
    }
    
    // Word match bonus
    const queryWords = queryLower.split(/\s+/);
    queryWords.forEach(word => {
      const wordCount = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += wordCount * 10;
    });
    
    // Metadata field matches
    if (metadata?.category?.toLowerCase().includes(queryLower)) {
      score += 30;
    }
    
    if (metadata?.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))) {
      score += 25;
    }
    
    // Length penalty (prefer shorter, more focused content)
    const lengthPenalty = Math.min(content.length / 1000, 1);
    score = score * (1 - lengthPenalty * 0.3);
    
    // Freshness bonus (newer documents get slight boost)
    if (metadata?.uploadedAt) {
      const daysSinceUpload = (Date.now() - metadata.uploadedAt.getTime()) / (1000 * 60 * 60 * 24);
      const freshnessBonus = Math.max(0, 1 - daysSinceUpload / 365) * 10; // Max 10 points for fresh content
      score += freshnessBonus;
    }
    
    return Math.min(score, 100);
  }

  // New advanced search methods

  async getSearchSuggestions(query: string, limit: number = 10): Promise<SearchSuggestion[]> {
    try {
      const suggestions: SearchSuggestion[] = [];
      
      // Get popular search terms from history
      const searchTerms = Array.from(this.searchHistory.values())
        .flat()
        .filter(search => search.query.toLowerCase().includes(query.toLowerCase()))
        .reduce((acc, search) => {
          const existing = acc.find(item => item.text === search.query);
          if (existing) {
            existing.frequency++;
          } else {
            acc.push({ text: search.query, frequency: 1 });
          }
          return acc;
        }, [] as Array<{ text: string; frequency: number }>)
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, limit);

      suggestions.push(...searchTerms.map(item => ({
        text: item.text,
        type: 'query' as const,
        frequency: item.frequency
      })));

      // Get matching tags from database
      const tagResults = await this.prisma.searchIndex.findMany({
        where: {
          entityType: 'document',
          metadata: {
            path: ['tags'],
            array_contains: [query]
          }
        },
        select: {
          metadata: true
        },
        take: limit
      });

      const tags = new Set<string>();
      tagResults.forEach(result => {
        const metadata = result.metadata as any;
        if (metadata.tags) {
          metadata.tags.forEach((tag: string) => {
            if (tag.toLowerCase().includes(query.toLowerCase())) {
              tags.add(tag);
            }
          });
        }
      });

      suggestions.push(...Array.from(tags).slice(0, limit).map(tag => ({
        text: tag,
        type: 'tag' as const,
        frequency: 0
      })));

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  async getSearchFacets(filters: DocumentSearchFilters = {}): Promise<SearchFacet[]> {
    try {
      const facets: SearchFacet[] = [];
      
      // Category facet
      const categoryStats = await this.prisma.searchIndex.groupBy({
        by: ['metadata'],
        where: {
          entityType: 'document'
        },
        _count: { id: true }
      });

      const categories = new Map<string, number>();
      categoryStats.forEach(stat => {
        const metadata = stat.metadata as any;
        if (metadata.category) {
          categories.set(metadata.category, (categories.get(metadata.category) || 0) + stat._count.id);
        }
      });

      facets.push({
        name: 'category',
        label: 'Category',
        type: 'select',
        options: Array.from(categories.entries()).map(([value, count]) => ({
          value,
          label: value,
          count
        }))
      });

      // MIME type facet
      const mimeTypeStats = await this.prisma.searchIndex.groupBy({
        by: ['metadata'],
        where: {
          entityType: 'document'
        },
        _count: { id: true }
      });

      const mimeTypes = new Map<string, number>();
      mimeTypeStats.forEach(stat => {
        const metadata = stat.metadata as any;
        if (metadata.mimeType) {
          const generalType = metadata.mimeType.split('/')[0];
          mimeTypes.set(generalType, (mimeTypes.get(generalType) || 0) + stat._count.id);
        }
      });

      facets.push({
        name: 'mimeType',
        label: 'Document Type',
        type: 'select',
        options: Array.from(mimeTypes.entries()).map(([value, count]) => ({
          value,
          label: value.toUpperCase(),
          count
        }))
      });

      // Language facet
      const languageStats = await this.prisma.searchIndex.groupBy({
        by: ['metadata'],
        where: {
          entityType: 'document'
        },
        _count: { id: true }
      });

      const languages = new Map<string, number>();
      languageStats.forEach(stat => {
        const metadata = stat.metadata as any;
        if (metadata.language) {
          languages.set(metadata.language, (languages.get(metadata.language) || 0) + stat._count.id);
        }
      });

      facets.push({
        name: 'language',
        label: 'Language',
        type: 'select',
        options: Array.from(languages.entries()).map(([value, count]) => ({
          value,
          label: value.toUpperCase(),
          count
        }))
      });

      return facets;
    } catch (error) {
      console.error('Failed to get search facets:', error);
      return [];
    }
  }

  async getSearchAnalytics(dateFrom?: Date, dateTo?: Date): Promise<SearchAnalytics> {
    try {
      const where: any = { entityType: 'document' };
      
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [
        totalSearches,
        uniqueQueries,
        averageResults,
        topQueries,
        searchTrend
      ] = await Promise.all([
        this.prisma.searchIndex.count({ where }),
        
        // Get unique queries from search history
        Promise.resolve(Array.from(this.searchHistory.values())
          .flat()
          .map(search => search.query)
          .filter((query, index, self) => self.indexOf(query) === index).length),
        
        // Calculate average results from search history
        Promise.resolve(
          Array.from(this.searchHistory.values())
            .flat()
            .reduce((sum, search) => sum + search.results, 0) / 
          Math.max(1, Array.from(this.searchHistory.values()).flat().length)
        ),
        
        // Get top queries
        Promise.resolve(
          Array.from(this.searchHistory.values())
            .flat()
            .reduce((acc, search) => {
              const existing = acc.find(item => item.query === search.query);
              if (existing) {
                existing.count++;
              } else {
                acc.push({ query: search.query, count: 1 });
              }
              return acc;
            }, [] as Array<{ query: string; count: number }>)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        ),
        
        // Get search trend by day
        Promise.resolve(
          Array.from(this.searchHistory.values())
            .flat()
            .reduce((acc, search) => {
              const day = search.timestamp.toISOString().split('T')[0];
              const existing = acc.find(item => item.date === day);
              if (existing) {
                existing.count++;
              } else {
                acc.push({ date: day, count: 1 });
              }
              return acc;
            }, [] as Array<{ date: string; count: number }>)
            .sort((a, b) => a.date.localeCompare(b.date))
        )
      ]);

      return {
        totalSearches,
        uniqueQueries,
        averageResults: averageResults || 0,
        topQueries: topQueries.map(item => ({
          query: item.query,
          count: item.count
        })),
        searchTrend: searchTrend.map(item => ({
          date: item.date,
          searches: item.count
        }))
      };
    } catch (error) {
      console.error('Failed to get search analytics:', error);
      return {
        totalSearches: 0,
        uniqueQueries: 0,
        averageResults: 0,
        topQueries: [],
        searchTrend: []
      };
    }
  }
}

export const documentSearchService = new DocumentSearchService(new PrismaClient());