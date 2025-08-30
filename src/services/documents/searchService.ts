import { PrismaClient } from '@prisma/client';
import { DocumentSearchOptions, SearchResult } from '../types';

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
  };
  vector?: number[];
  relevanceScore?: number;
}

export class DocumentSearchService {
  private prisma: PrismaClient;
  private indexCache: Map<string, DocumentSearchIndex> = new Map();

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
          versions: {
            take: 1,
            orderBy: { versionNumber: 'desc' }
          }
        }
      });

      if (!document) return;

      // Prepare searchable content
      const searchableContent = this.prepareSearchableContent(document);

      // Create search index
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
          caseId: document.caseId || undefined
        }
      };

      // Generate vector embedding (simplified implementation)
      searchIndex.vector = await this.generateVectorEmbedding(searchableContent);

      // Store in database
      await this.prisma.searchIndex.upsert({
        where: { entityId: documentId },
        update: {
          content: searchableContent,
          metadata: searchIndex.metadata,
          vector: searchIndex.vector
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
      category,
      tags,
      limit = 20,
      offset = 0,
      fromDate,
      toDate
    } = options;

    try {
      // Build search conditions
      const whereConditions: any[] = [
        {
          OR: [
            {
              content: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              metadata: {
                path: ['title'],
                string_contains: query
              }
            }
          ]
        }
      ];

      // Add filters
      if (caseId) {
        whereConditions.push({
          metadata: {
            path: ['caseId'],
            equals: caseId
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

      if (tags && tags.length > 0) {
        whereConditions.push({
          metadata: {
            path: ['tags'],
            array_contains: tags
          }
        });
      }

      if (fromDate || toDate) {
        const dateFilter: any = {};
        if (fromDate) dateFilter.gte = fromDate;
        if (toDate) dateFilter.lte = toDate;
        
        whereConditions.push({
          metadata: {
            path: ['uploadedAt'],
            ...dateFilter
          }
        });
      }

      const searchResults = await this.prisma.searchIndex.findMany({
        where: {
          AND: whereConditions,
          entityType: 'document'
        },
        include: {
          document: {
            include: {
              case: true,
              versions: {
                take: 1,
                orderBy: { versionNumber: 'desc' }
              }
            }
          }
        },
        orderBy: [
          {
            createdAt: 'desc'
          }
        ],
        take: limit,
        skip: offset
      });

      return searchResults.map(result => ({
        id: result.entityId,
        type: 'document',
        title: result.document?.originalName || 'Unknown',
        excerpt: this.generateExcerpt(result.content, query),
        score: this.calculateRelevanceScore(result.content, query),
        metadata: {
          category: result.document?.category,
          mimeType: result.document?.mimeType,
          caseId: result.document?.caseId,
          tags: result.document?.tags || [],
          createdAt: result.document?.uploadedAt || result.createdAt
        }
      }));
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
}

export const documentSearchService = new DocumentSearchService(new PrismaClient());