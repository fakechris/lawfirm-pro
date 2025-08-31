import { Router, Request, Response } from 'express';
import { knowledgeSearchEngine, KnowledgeSearchQuery, KnowledgeSearchFilters, KnowledgeSearchSort, KnowledgeSearchPagination } from '../../services/knowledge-base/search/knowledgeSearchEngine';
import { knowledgeIndexingService } from '../../services/knowledge-base/search/knowledgeIndexingService';
import { searchTextUtils } from '../../utils/knowledge-base/search/searchTextUtils';
import { authenticate } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';

const router = Router();

// Search knowledge base
router.post('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      query,
      filters,
      sortBy,
      pagination,
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string',
      });
    }

    const searchQuery: KnowledgeSearchQuery = {
      query: query.trim(),
      filters: filters as KnowledgeSearchFilters,
      sortBy: sortBy as KnowledgeSearchSort,
      pagination: pagination as KnowledgeSearchPagination,
      userId: req.user?.id,
    };

    const result = await knowledgeSearchEngine.searchKnowledge(searchQuery);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({
      error: 'Failed to search knowledge base',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get search suggestions
router.get('/suggestions', authenticate, async (req: Request, res: Response) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query parameter "q" is required',
      });
    }

    const suggestions = await knowledgeSearchEngine.getKnowledgeSuggestions(
      query,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        query,
        suggestions,
      },
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({
      error: 'Failed to get search suggestions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Analyze search query
router.post('/analyze', authenticate, async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string',
      });
    }

    const analysis = searchTextUtils.analyzeSearchQuery(query);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Query analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze query',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get personalized recommendations
router.get('/recommendations', authenticate, async (req: Request, res: Response) => {
  try {
    const { documentId, limit = 5 } = req.query;
    const userId = req.user!.id;

    const recommendations = await knowledgeSearchEngine.getKnowledgeRecommendations(
      userId,
      documentId as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        userId,
        documentId,
        recommendations,
      },
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Index knowledge article
router.post('/index/article/:articleId', authenticate, async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    const { options } = req.body;

    await knowledgeIndexingService.indexKnowledgeArticle(articleId, options);

    res.json({
      success: true,
      message: 'Knowledge article indexed successfully',
    });
  } catch (error) {
    console.error('Index article error:', error);
    res.status(500).json({
      error: 'Failed to index knowledge article',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Index document
router.post('/index/document/:documentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { options } = req.body;

    await knowledgeIndexingService.indexDocument(documentId, options);

    res.json({
      success: true,
      message: 'Document indexed successfully',
    });
  } catch (error) {
    console.error('Index document error:', error);
    res.status(500).json({
      error: 'Failed to index document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Batch indexing
router.post('/index/batch', authenticate, async (req: Request, res: Response) => {
  try {
    const { documentIds, options } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        error: 'documentIds must be a non-empty array',
      });
    }

    const result = await knowledgeIndexingService.processBatchIndexing(documentIds, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Batch indexing error:', error);
    res.status(500).json({
      error: 'Failed to process batch indexing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Reindex all knowledge content
router.post('/reindex/all', authenticate, async (req: Request, res: Response) => {
  try {
    await knowledgeIndexingService.reindexAllKnowledgeContent();

    res.json({
      success: true,
      message: 'Full reindexing initiated',
    });
  } catch (error) {
    console.error('Reindex all error:', error);
    res.status(500).json({
      error: 'Failed to initiate full reindexing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Remove from index
router.delete('/index/:entityId', authenticate, async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;

    await knowledgeIndexingService.removeFromIndex(entityId);

    res.json({
      success: true,
      message: 'Entity removed from index successfully',
    });
  } catch (error) {
    console.error('Remove from index error:', error);
    res.status(500).json({
      error: 'Failed to remove entity from index',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get indexing stats
router.get('/stats/indexing', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await knowledgeIndexingService.getIndexingStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get indexing stats error:', error);
    res.status(500).json({
      error: 'Failed to get indexing stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get indexing queue
router.get('/queue', authenticate, async (req: Request, res: Response) => {
  try {
    const queue = await knowledgeIndexingService.getIndexingQueue();

    res.json({
      success: true,
      data: queue,
    });
  } catch (error) {
    console.error('Get indexing queue error:', error);
    res.status(500).json({
      error: 'Failed to get indexing queue',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cancel indexing job
router.delete('/queue/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const success = await knowledgeIndexingService.cancelIndexingJob(jobId);

    if (!success) {
      return res.status(404).json({
        error: 'Job not found or cannot be cancelled',
      });
    }

    res.json({
      success: true,
      message: 'Indexing job cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel indexing job error:', error);
    res.status(500).json({
      error: 'Failed to cancel indexing job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Highlight search results
router.post('/highlight', authenticate, async (req: Request, res: Response) => {
  try {
    const { text, query, maxFragments = 3, fragmentLength = 150 } = req.body;

    if (!text || !query) {
      return res.status(400).json({
        error: 'text and query are required',
      });
    }

    const highlights = searchTextUtils.highlightSearchResults(
      text,
      query,
      maxFragments,
      fragmentLength
    );

    res.json({
      success: true,
      data: highlights,
    });
  } catch (error) {
    console.error('Highlight search results error:', error);
    res.status(500).json({
      error: 'Failed to highlight search results',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get search analytics
router.get('/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      limit = 100,
      userId 
    } = req.query;

    // Build query for analytics
    const whereClause: any = {};
    
    if (startDate) {
      whereClause.createdAt = { gte: new Date(startDate as string) };
    }
    
    if (endDate) {
      whereClause.createdAt = { 
        ...whereClause.createdAt,
        lte: new Date(endDate as string) 
      };
    }

    if (userId) {
      whereClause.userId = userId as string;
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const analytics = await prisma.searchAnalytics.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    // Calculate summary statistics
    const summary = await prisma.searchAnalytics.groupBy({
      by: ['query'],
      where: whereClause,
      _count: { query: true },
      _avg: { processingTime: true },
      orderBy: { _count: { query: 'desc' } },
      take: 10,
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      data: {
        analytics,
        summary: summary.map(item => ({
          query: item.query,
          searchCount: item._count.query,
          averageProcessingTime: item._avg.processingTime,
        })),
      },
    });
  } catch (error) {
    console.error('Get search analytics error:', error);
    res.status(500).json({
      error: 'Failed to get search analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;