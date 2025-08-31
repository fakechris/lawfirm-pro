import { PrismaClient } from '@prisma/client';
import { knowledgeSearchEngine, KnowledgeSearchDocument, KnowledgeIndexingOptions } from './knowledgeSearchEngine';
import { documentProcessor } from '../../documents/documentProcessor';

const prisma = new PrismaClient();

export interface IndexingJob {
  id: string;
  type: 'knowledge_article' | 'document' | 'template' | 'batch';
  entityId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  options?: KnowledgeIndexingOptions;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface IndexingStats {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  averageProcessingTime: number;
  lastIndexingTime: Date;
  indexingQueueSize: number;
}

export class KnowledgeIndexingService {
  private indexingQueue: IndexingJob[] = [];
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    this.startProcessing();
  }

  async indexKnowledgeArticle(articleId: string, options?: KnowledgeIndexingOptions): Promise<void> {
    try {
      const article = await prisma.knowledgeBaseArticle.findUnique({
        where: { id: articleId },
        include: {
          author: true,
          reviewer: true,
        },
      });

      if (!article) {
        throw new Error(`Knowledge article not found: ${articleId}`);
      }

      const searchDocument: KnowledgeSearchDocument = {
        id: article.id,
        entityId: article.id,
        entityType: 'knowledge_article',
        title: article.title,
        content: article.content,
        summary: article.summary,
        tags: article.tags,
        categories: article.categories,
        language: article.language,
        contentType: article.contentType,
        accessLevel: article.accessLevel,
        authorId: article.authorId,
        metadata: {
          slug: article.slug,
          status: article.status,
          publishedAt: article.publishedAt,
          viewCount: article.viewCount,
          likeCount: article.likeCount,
          isFeatured: article.isFeatured,
          authorName: `${article.author.firstName} ${article.author.lastName}`,
          reviewerName: article.reviewer ? `${article.reviewer.firstName} ${article.reviewer.lastName}` : undefined,
        },
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      };

      await knowledgeSearchEngine.indexKnowledgeDocument(searchDocument, options);

      // Update article's search index status
      await prisma.knowledgeBaseArticle.update({
        where: { id: articleId },
        data: { updatedAt: new Date() },
      });

    } catch (error) {
      console.error(`Failed to index knowledge article ${articleId}:`, error);
      throw error;
    }
  }

  async indexDocument(documentId: string, options?: KnowledgeIndexingOptions): Promise<void> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          uploadedBy: true,
          case: true,
          client: true,
        },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

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

      const searchDocument: KnowledgeSearchDocument = {
        id: document.id,
        entityId: document.id,
        entityType: 'document',
        title: document.originalName,
        content,
        tags: document.tags,
        categories: [document.category],
        language: 'zh-CN',
        accessLevel: document.isConfidential ? 'CONFIDENTIAL' : 'INTERNAL',
        authorId: document.uploadedById,
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
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };

      await knowledgeSearchEngine.indexKnowledgeDocument(searchDocument, options);

    } catch (error) {
      console.error(`Failed to index document ${documentId}:`, error);
      throw error;
    }
  }

  async addToIndexingQueue(
    type: IndexingJob['type'],
    entityId?: string,
    priority: IndexingJob['priority'] = 'medium',
    options?: KnowledgeIndexingOptions
  ): Promise<string> {
    const job: IndexingJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      entityId,
      status: 'pending',
      priority,
      options,
      createdAt: new Date(),
    };

    this.indexingQueue.push(job);
    
    // Sort queue by priority
    this.sortQueueByPriority();

    console.log(`Added indexing job ${job.id} to queue`);
    return job.id;
  }

  async processBatchIndexing(
    documentIds: string[],
    options?: KnowledgeIndexingOptions
  ): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
    const success: string[] = [];
    const failed: { id: string; error: string }[] = [];

    console.log(`Starting batch indexing of ${documentIds.length} documents...`);

    for (const documentId of documentIds) {
      try {
        await this.indexDocument(documentId, options);
        success.push(documentId);
        console.log(`Successfully indexed document ${documentId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ id: documentId, error: errorMessage });
        console.error(`Failed to index document ${documentId}:`, error);
      }
    }

    console.log(`Batch indexing completed: ${success.length} successful, ${failed.length} failed`);
    return { success, failed };
  }

  async reindexAllKnowledgeContent(): Promise<void> {
    try {
      console.log('Starting full knowledge base reindexing...');

      // Add batch job to queue
      await this.addToIndexingQueue('batch', undefined, 'high');

      console.log('Full reindexing job added to queue');
    } catch (error) {
      console.error('Failed to start full reindexing:', error);
      throw error;
    }
  }

  async removeFromIndex(entityId: string): Promise<void> {
    try {
      await prisma.searchIndex.delete({
        where: { entityId },
      });

      console.log(`Removed entity ${entityId} from search index`);
    } catch (error) {
      console.error(`Failed to remove entity ${entityId} from index:`, error);
      throw error;
    }
  }

  async getIndexingStats(): Promise<IndexingStats> {
    try {
      const totalDocuments = await prisma.searchIndex.count();
      const indexedDocuments = await prisma.searchIndex.count({
        where: { isPublished: true },
      });
      const failedDocuments = 0; // Track failed indexing attempts

      // Get average processing time (simplified)
      const recentAnalytics = await prisma.searchAnalytics.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const averageProcessingTime = recentAnalytics.length > 0
        ? recentAnalytics.reduce((sum, record) => sum + record.processingTime, 0) / recentAnalytics.length
        : 0;

      const lastIndexingTime = await prisma.searchIndex.aggregate({
        _max: { updatedAt: true },
      });

      return {
        totalDocuments,
        indexedDocuments,
        failedDocuments,
        averageProcessingTime,
        lastIndexingTime: lastIndexingTime._max.updatedAt || new Date(),
        indexingQueueSize: this.indexingQueue.length,
      };
    } catch (error) {
      console.error('Failed to get indexing stats:', error);
      throw error;
    }
  }

  async getIndexingQueue(): Promise<IndexingJob[]> {
    return [...this.indexingQueue];
  }

  async cancelIndexingJob(jobId: string): Promise<boolean> {
    const jobIndex = this.indexingQueue.findIndex(job => job.id === jobId);
    if (jobIndex !== -1) {
      const job = this.indexingQueue[jobIndex];
      if (job.status === 'pending') {
        this.indexingQueue.splice(jobIndex, 1);
        console.log(`Cancelled indexing job ${jobId}`);
        return true;
      }
    }
    return false;
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.indexingQueue.length > 0) {
        await this.processNextJob();
      }
    }, 5000); // Process every 5 seconds
  }

  private async processNextJob(): Promise<void> {
    if (this.indexingQueue.length === 0) return;

    const job = this.indexingQueue.shift();
    if (!job) return;

    this.isProcessing = true;
    job.status = 'processing';
    job.startedAt = new Date();

    try {
      console.log(`Processing indexing job ${job.id} (${job.type})`);

      switch (job.type) {
        case 'knowledge_article':
          if (job.entityId) {
            await this.indexKnowledgeArticle(job.entityId, job.options);
          }
          break;
        case 'document':
          if (job.entityId) {
            await this.indexDocument(job.entityId, job.options);
          }
          break;
        case 'batch':
          await this.processBatchJob(job);
          break;
      }

      job.status = 'completed';
      job.completedAt = new Date();
      console.log(`Completed indexing job ${job.id}`);

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed indexing job ${job.id}:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatchJob(job: IndexingJob): Promise<void> {
    try {
      // Reindex all knowledge base articles
      const articles = await prisma.knowledgeBaseArticle.findMany({
        where: { status: 'PUBLISHED' },
      });

      for (const article of articles) {
        try {
          await this.indexKnowledgeArticle(article.id, job.options);
        } catch (error) {
          console.error(`Failed to index article ${article.id} in batch job:`, error);
        }
      }

      // Reindex recent documents
      const recentDocuments = await prisma.document.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      });

      for (const document of recentDocuments) {
        try {
          await this.indexDocument(document.id, job.options);
        } catch (error) {
          console.error(`Failed to index document ${document.id} in batch job:`, error);
        }
      }

    } catch (error) {
      console.error('Batch processing failed:', error);
      throw error;
    }
  }

  private sortQueueByPriority(): void {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    this.indexingQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }
}

export const knowledgeIndexingService = new KnowledgeIndexingService();