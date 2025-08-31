"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const knowledgeSearchEngine_1 = require("../../services/knowledge-base/search/knowledgeSearchEngine");
const knowledgeIndexingService_1 = require("../../services/knowledge-base/search/knowledgeIndexingService");
const searchTextUtils_1 = require("../../utils/knowledge-base/search/searchTextUtils");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.post('/search', auth_1.authenticate, async (req, res) => {
    try {
        const { query, filters, sortBy, pagination, } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Query is required and must be a string',
            });
        }
        const searchQuery = {
            query: query.trim(),
            filters: filters,
            sortBy: sortBy,
            pagination: pagination,
            userId: req.user?.id,
        };
        const result = await knowledgeSearchEngine_1.knowledgeSearchEngine.searchKnowledge(searchQuery);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Knowledge search error:', error);
        res.status(500).json({
            error: 'Failed to search knowledge base',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/suggestions', auth_1.authenticate, async (req, res) => {
    try {
        const { q: query, limit = 10 } = req.query;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Query parameter "q" is required',
            });
        }
        const suggestions = await knowledgeSearchEngine_1.knowledgeSearchEngine.getKnowledgeSuggestions(query, parseInt(limit));
        res.json({
            success: true,
            data: {
                query,
                suggestions,
            },
        });
    }
    catch (error) {
        console.error('Search suggestions error:', error);
        res.status(500).json({
            error: 'Failed to get search suggestions',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/analyze', auth_1.authenticate, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Query is required and must be a string',
            });
        }
        const analysis = searchTextUtils_1.searchTextUtils.analyzeSearchQuery(query);
        res.json({
            success: true,
            data: analysis,
        });
    }
    catch (error) {
        console.error('Query analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze query',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/recommendations', auth_1.authenticate, async (req, res) => {
    try {
        const { documentId, limit = 5 } = req.query;
        const userId = req.user.id;
        const recommendations = await knowledgeSearchEngine_1.knowledgeSearchEngine.getKnowledgeRecommendations(userId, documentId, parseInt(limit));
        res.json({
            success: true,
            data: {
                userId,
                documentId,
                recommendations,
            },
        });
    }
    catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({
            error: 'Failed to get recommendations',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/index/article/:articleId', auth_1.authenticate, async (req, res) => {
    try {
        const { articleId } = req.params;
        const { options } = req.body;
        await knowledgeIndexingService_1.knowledgeIndexingService.indexKnowledgeArticle(articleId, options);
        res.json({
            success: true,
            message: 'Knowledge article indexed successfully',
        });
    }
    catch (error) {
        console.error('Index article error:', error);
        res.status(500).json({
            error: 'Failed to index knowledge article',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/index/document/:documentId', auth_1.authenticate, async (req, res) => {
    try {
        const { documentId } = req.params;
        const { options } = req.body;
        await knowledgeIndexingService_1.knowledgeIndexingService.indexDocument(documentId, options);
        res.json({
            success: true,
            message: 'Document indexed successfully',
        });
    }
    catch (error) {
        console.error('Index document error:', error);
        res.status(500).json({
            error: 'Failed to index document',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/index/batch', auth_1.authenticate, async (req, res) => {
    try {
        const { documentIds, options } = req.body;
        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            return res.status(400).json({
                error: 'documentIds must be a non-empty array',
            });
        }
        const result = await knowledgeIndexingService_1.knowledgeIndexingService.processBatchIndexing(documentIds, options);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Batch indexing error:', error);
        res.status(500).json({
            error: 'Failed to process batch indexing',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/reindex/all', auth_1.authenticate, async (req, res) => {
    try {
        await knowledgeIndexingService_1.knowledgeIndexingService.reindexAllKnowledgeContent();
        res.json({
            success: true,
            message: 'Full reindexing initiated',
        });
    }
    catch (error) {
        console.error('Reindex all error:', error);
        res.status(500).json({
            error: 'Failed to initiate full reindexing',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.delete('/index/:entityId', auth_1.authenticate, async (req, res) => {
    try {
        const { entityId } = req.params;
        await knowledgeIndexingService_1.knowledgeIndexingService.removeFromIndex(entityId);
        res.json({
            success: true,
            message: 'Entity removed from index successfully',
        });
    }
    catch (error) {
        console.error('Remove from index error:', error);
        res.status(500).json({
            error: 'Failed to remove entity from index',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/stats/indexing', auth_1.authenticate, async (req, res) => {
    try {
        const stats = await knowledgeIndexingService_1.knowledgeIndexingService.getIndexingStats();
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        console.error('Get indexing stats error:', error);
        res.status(500).json({
            error: 'Failed to get indexing stats',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/queue', auth_1.authenticate, async (req, res) => {
    try {
        const queue = await knowledgeIndexingService_1.knowledgeIndexingService.getIndexingQueue();
        res.json({
            success: true,
            data: queue,
        });
    }
    catch (error) {
        console.error('Get indexing queue error:', error);
        res.status(500).json({
            error: 'Failed to get indexing queue',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.delete('/queue/:jobId', auth_1.authenticate, async (req, res) => {
    try {
        const { jobId } = req.params;
        const success = await knowledgeIndexingService_1.knowledgeIndexingService.cancelIndexingJob(jobId);
        if (!success) {
            return res.status(404).json({
                error: 'Job not found or cannot be cancelled',
            });
        }
        res.json({
            success: true,
            message: 'Indexing job cancelled successfully',
        });
    }
    catch (error) {
        console.error('Cancel indexing job error:', error);
        res.status(500).json({
            error: 'Failed to cancel indexing job',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/highlight', auth_1.authenticate, async (req, res) => {
    try {
        const { text, query, maxFragments = 3, fragmentLength = 150 } = req.body;
        if (!text || !query) {
            return res.status(400).json({
                error: 'text and query are required',
            });
        }
        const highlights = searchTextUtils_1.searchTextUtils.highlightSearchResults(text, query, maxFragments, fragmentLength);
        res.json({
            success: true,
            data: highlights,
        });
    }
    catch (error) {
        console.error('Highlight search results error:', error);
        res.status(500).json({
            error: 'Failed to highlight search results',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/analytics', auth_1.authenticate, async (req, res) => {
    try {
        const { startDate, endDate, limit = 100, userId } = req.query;
        const whereClause = {};
        if (startDate) {
            whereClause.createdAt = { gte: new Date(startDate) };
        }
        if (endDate) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                lte: new Date(endDate)
            };
        }
        if (userId) {
            whereClause.userId = userId;
        }
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        const analytics = await prisma.searchAnalytics.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
        });
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
    }
    catch (error) {
        console.error('Get search analytics error:', error);
        res.status(500).json({
            error: 'Failed to get search analytics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=searchRoutes.js.map