import { PrismaClient } from '@prisma/client';
import natural from 'natural';
import { storageService } from '../storage';
import { documentProcessor } from './documentProcessor';

const prisma = new PrismaClient();

export interface SearchDocument {
  id: string;
  entityId: string;
  entityType: 'document' | 'template' | 'evidence' | 'case' | 'user';
  title: string;
  content: string;
  metadata: Record<string, any>;
  tags: string[];
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sortBy?: SearchSort;
  pagination?: SearchPagination;
}

export interface SearchFilters {
  entityType?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  createdBy?: string[];
  mimeType?: string[];
  sizeRange?: {
    min: number;
    max: number;
  };
  customFilters?: Record<string, any>;
}

export interface SearchSort {
  field: 'relevance' | 'date' | 'title' | 'size';
  order: 'asc' | 'desc';
}

export interface SearchPagination {
  page: number;
  limit: number;
}

export interface SearchResult {
  documents: SearchDocument[];
  total: number;
  page: number;
  limit: number;
  facets: SearchFacets;
  query: string;
  processingTime: number;
}

export interface SearchFacets {
  entityType: Record<string, number>;
  tags: Record<string, number>;
  mimeType: Record<string, number>;
  dateRange: {
    min: Date;
    max: Date;
  };
}

export interface IndexingOptions {
  extractKeywords?: boolean;
  generateSummary?: boolean;
  analyzeSentiment?: boolean;
  extractEntities?: boolean;
  categorizeContent?: boolean;
}

export class SearchIndexingService {
  private tokenizer: natural.SentenceTokenizer;
  private stemmer: natural.PorterStemmer;
  private tfidf: natural.TfIdf;
  private stopWords: Set<string>;

  constructor() {
    this.tokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();
    this.stopWords = new Set([
      // English stop words
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      // Chinese stop words
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
    ]);
  }

  async indexDocument(
    document: SearchDocument,
    options: IndexingOptions = {}
  ): Promise<void> {
    const defaultOptions: IndexingOptions = {
      extractKeywords: true,
      generateSummary: true,
      analyzeSentiment: true,
      extractEntities: true,
      categorizeContent: true,
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Process document content
      const processedContent = await this.processContent(document.content, finalOptions);
      
      // Generate search index entry
      const searchIndex = {
        id: document.id,
        entityId: document.entityId,
        entityType: document.entityType,
        content: document.content,
        processedContent: processedContent.processedText,
        title: document.title,
        metadata: {
          ...document.metadata,
          keywords: processedContent.keywords,
          summary: processedContent.summary,
          sentiment: processedContent.sentiment,
          entities: processedContent.entities,
          category: processedContent.category,
          language: document.language,
        },
        tags: document.tags,
        vector: await this.generateVector(processedContent.processedText),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };

      // Store in database
      await prisma.searchIndex.upsert({
        where: { id: document.id },
        update: searchIndex,
        create: searchIndex,
      });

      // Update TF-IDF index
      this.tfidf.addDocument(processedContent.processedText, document.id);

    } catch (error) {
      console.error(`Failed to index document ${document.id}:`, error);
      throw new Error(`Document indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      // Process search query
      const processedQuery = this.processSearchQuery(query.query);
      
      // Build database query
      const whereClause = this.buildWhereClause(query.filters, processedQuery);
      
      // Get total count
      const total = await prisma.searchIndex.count({ where: whereClause });
      
      // Get paginated results
      const pagination = query.pagination || { page: 1, limit: 10 };
      const orderBy = this.buildOrderBy(query.sortBy);
      
      const documents = await prisma.searchIndex.findMany({
        where: whereClause,
        orderBy,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      });

      // Calculate relevance scores
      const scoredDocuments = await this.calculateRelevanceScores(documents, processedQuery);
      
      // Generate facets
      const facets = await this.generateFacets(whereClause);
      
      const processingTime = Date.now() - startTime;

      return {
        documents: scoredDocuments,
        total,
        page: pagination.page,
        limit: pagination.limit,
        facets,
        query: query.query,
        processingTime,
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async reindexAllDocuments(): Promise<void> {
    try {
      // Get all documents from database
      const documents = await prisma.document.findMany({
        include: {
          uploadedBy: true,
          case: true,
          client: true,
        },
      });

      console.log(`Reindexing ${documents.length} documents...`);

      for (const document of documents) {
        try {
          // Extract text content if not already present
          let content = document.content || document.extractedText || '';
          
          if (!content && document.path) {
            try {
              const processed = await documentProcessor.processFile(document.path);
              content = processed.content;
            } catch (error) {
              console.warn(`Failed to extract content from document ${document.id}:`, error);
            }
          }

          const searchDocument: SearchDocument = {
            id: document.id,
            entityId: document.id,
            entityType: 'document',
            title: document.originalName,
            content,
            metadata: {
              size: document.size,
              mimeType: document.mimeType,
              category: document.category,
              status: document.status,
              version: document.version,
              isConfidential: document.isConfidential,
              uploadedBy: document.uploadedBy?.username,
              caseTitle: document.case?.title,
              clientName: document.client ? `${document.client.firstName} ${document.client.lastName}` : undefined,
            },
            tags: document.tags,
            language: 'zh-CN', // Default to Chinese for law firm
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          };

          await this.indexDocument(searchDocument);
        } catch (error) {
          console.error(`Failed to reindex document ${document.id}:`, error);
        }
      }

      console.log('Reindexing completed');
    } catch (error) {
      console.error('Reindexing failed:', error);
      throw new Error(`Reindexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFromIndex(documentId: string): Promise<void> {
    try {
      await prisma.searchIndex.delete({
        where: { id: documentId },
      });
    } catch (error) {
      console.error(`Failed to delete document ${documentId} from index:`, error);
      throw new Error(`Failed to delete from index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSearchSuggestions(query: string, limit: number = 10): Promise<string[]> {
    try {
      const processedQuery = this.processSearchQuery(query);
      
      // Get documents that match the query
      const documents = await prisma.searchIndex.findMany({
        where: {
          OR: [
            {
              title: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              content: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              tags: {
                hasSome: [query],
              },
            },
          ],
        },
        take: limit * 2, // Get more to process
      });

      // Extract suggestions
      const suggestions = new Set<string>();
      
      for (const doc of documents) {
        // Add title words that match
        const titleWords = doc.title.split(/\s+/).filter(word => 
          word.toLowerCase().includes(query.toLowerCase())
        );
        titleWords.forEach(word => suggestions.add(word));
        
        // Add tags that match
        doc.tags.forEach(tag => {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(tag);
          }
        });
      }

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  private async processContent(
    content: string,
    options: IndexingOptions
  ): Promise<{
    processedText: string;
    keywords: string[];
    summary: string;
    sentiment: string;
    entities: any[];
    category: string;
  }> {
    // Tokenize and clean text
    const tokens = this.tokenizer.tokenize(content) || [];
    const processedTokens = tokens
      .map(token => token.toLowerCase().trim())
      .filter(token => token.length > 2 && !this.stopWords.has(token))
      .map(token => this.stemmer.stem(token));

    const processedText = processedTokens.join(' ');

    // Extract keywords
    const keywords = options.extractKeywords ? this.extractKeywords(processedText) : [];

    // Generate summary
    const summary = options.generateSummary ? this.generateSummary(content) : '';

    // Analyze sentiment
    const sentiment = options.analyzeSentiment ? this.analyzeSentiment(content) : 'neutral';

    // Extract entities
    const entities = options.extractEntities ? this.extractEntities(content) : [];

    // Categorize content
    const category = options.categorizeContent ? this.categorizeContent(content) : 'general';

    return {
      processedText,
      keywords,
      summary,
      sentiment,
      entities,
      category,
    };
  }

  private extractKeywords(text: string, count: number = 10): string[] {
    const tfidf = new natural.TfIdf();
    tfidf.addDocument(text);
    
    const terms = tfidf.listTerms(0);
    return terms.slice(0, count).map(term => term.term);
  }

  private generateSummary(content: string, maxLength: number = 200): string {
    const sentences = this.tokenizer.tokenize(content) || [];
    if (sentences.length === 0) return '';
    
    // Simple extractive summarization - take first few sentences
    let summary = sentences[0];
    for (let i = 1; i < Math.min(sentences.length, 3); i++) {
      if (summary.length + sentences[i].length <= maxLength) {
        summary += ' ' + sentences[i];
      } else {
        break;
      }
    }
    
    return summary;
  }

  private analyzeSentiment(content: string): string {
    const analyzer = new natural.SentimentAnalyzer('English', 
      natural.PorterStemmer, ['negation']);
    
    const tokens = natural.WordTokenizer.prototype.tokenize(content);
    const score = analyzer.getSentiment(tokens);
    
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }

  private extractEntities(content: string): any[] {
    // Simplified entity extraction
    const entities = [];
    
    // Extract dates
    const datePattern = /\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4}/g;
    const dates = content.match(datePattern);
    if (dates) {
      entities.push(...dates.map(date => ({ type: 'date', value: date })));
    }
    
    // Extract numbers that might be monetary amounts
    const moneyPattern = /[\d,]+\.?\d*\s*(元|万|千|百万|亿)/g;
    const amounts = content.match(moneyPattern);
    if (amounts) {
      entities.push(...amounts.map(amount => ({ type: 'amount', value: amount })));
    }
    
    return entities;
  }

  private categorizeContent(content: string): string {
    const legalKeywords = {
      'contract': ['合同', '协议', 'Agreement', 'Contract'],
      'lawsuit': ['诉讼', '起诉', 'Lawsuit', 'Litigation'],
      'evidence': ['证据', 'Evidence', 'Exhibit'],
      'judgment': ['判决', '裁定', 'Judgment', 'Order'],
      'legal_opinion': ['法律意见', 'Legal Opinion', 'Memorandum'],
    };

    const contentLower = content.toLowerCase();
    
    for (const [category, keywords] of Object.entries(legalKeywords)) {
      if (keywords.some(keyword => contentLower.includes(keyword.toLowerCase()))) {
        return category;
      }
    }
    
    return 'general';
  }

  private async generateVector(text: string): Promise<number[]> {
    // Simplified vector generation
    // In a real implementation, you would use proper word embeddings
    const tokens = text.split(/\s+/).slice(0, 100); // Limit vector size
    const vector = new Array(100).fill(0);
    
    tokens.forEach((token, index) => {
      vector[index % 100] = token.length / 10; // Simple hash-like function
    });
    
    return vector;
  }

  private processSearchQuery(query: string): string {
    // Clean and process search query
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // Keep Chinese characters
      .replace(/\s+/g, ' ');
  }

  private buildWhereClause(filters?: SearchFilters, processedQuery?: string): any {
    const where: any = {};

    if (filters?.entityType?.length) {
      where.entityType = { in: filters.entityType };
    }

    if (filters?.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters?.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end,
      };
    }

    if (filters?.mimeType?.length) {
      where.metadata = {
        path: ['mimeType'],
        in: filters.mimeType,
      };
    }

    if (filters?.sizeRange) {
      where.metadata = {
        path: ['size'],
        gte: filters.sizeRange.min,
        lte: filters.sizeRange.max,
      };
    }

    // Add text search
    if (processedQuery) {
      where.OR = [
        { title: { contains: processedQuery, mode: 'insensitive' } },
        { content: { contains: processedQuery, mode: 'insensitive' } },
        { processedContent: { contains: processedQuery, mode: 'insensitive' } },
        { tags: { hasSome: [processedQuery] } },
      ];
    }

    return where;
  }

  private buildOrderBy(sortBy?: SearchSort): any[] {
    if (!sortBy) {
      return [{ createdAt: 'desc' }];
    }

    switch (sortBy.field) {
      case 'relevance':
        return [{ relevance: sortBy.order }];
      case 'date':
        return [{ createdAt: sortBy.order }];
      case 'title':
        return [{ title: sortBy.order }];
      case 'size':
        return [{ metadata: { path: ['size'], sort: sortBy.order } }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private async calculateRelevanceScores(
    documents: any[],
    processedQuery: string
  ): Promise<SearchDocument[]> {
    if (!processedQuery) {
      return documents.map(doc => ({
        id: doc.id,
        entityId: doc.entityId,
        entityType: doc.entityType,
        title: doc.title,
        content: doc.content,
        metadata: doc.metadata,
        tags: doc.tags,
        language: doc.metadata.language,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
    }

    return documents.map(doc => {
      let score = 0;

      // Title matches get higher score
      if (doc.title.toLowerCase().includes(processedQuery.toLowerCase())) {
        score += 10;
      }

      // Content matches
      if (doc.content.toLowerCase().includes(processedQuery.toLowerCase())) {
        score += 5;
      }

      // Tag matches
      if (doc.tags.some((tag: string) => tag.toLowerCase().includes(processedQuery.toLowerCase()))) {
        score += 8;
      }

      // Keyword matches
      if (doc.metadata.keywords?.some((keyword: string) => 
        keyword.toLowerCase().includes(processedQuery.toLowerCase()))) {
        score += 7;
      }

      return {
        id: doc.id,
        entityId: doc.entityId,
        entityType: doc.entityType,
        title: doc.title,
        content: doc.content,
        metadata: { ...doc.metadata, relevanceScore: score },
        tags: doc.tags,
        language: doc.metadata.language,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    }).sort((a, b) => (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0));
  }

  private async generateFacets(whereClause: any): Promise<SearchFacets> {
    // Get entity type counts
    const entityTypes = await prisma.searchIndex.groupBy({
      by: ['entityType'],
      where: whereClause,
      _count: { entityType: true },
    });

    const entityTypeFacets: Record<string, number> = {};
    entityTypes.forEach(item => {
      entityTypeFacets[item.entityType] = item._count.entityType;
    });

    // Get date range
    const dateRange = await prisma.searchIndex.aggregate({
      where: whereClause,
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    return {
      entityType: entityTypeFacets,
      tags: {}, // Simplified for now
      mimeType: {}, // Simplified for now
      dateRange: {
        min: dateRange._min.createdAt || new Date(),
        max: dateRange._max.createdAt || new Date(),
      },
    };
  }
}

export const searchIndexingService = new SearchIndexingService();