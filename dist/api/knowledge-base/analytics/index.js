"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const engine_1 = require("../../../services/knowledge-base/analytics/engine");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const timeRangeSchema = zod_1.z.object({
    start: zod_1.z.string().datetime(),
    end: zod_1.z.string().datetime(),
});
const articleViewSchema = zod_1.z.object({
    articleId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    readTime: zod_1.z.number().optional(),
    completionPercentage: zod_1.z.number().min(0).max(100).optional(),
    referrer: zod_1.z.string().optional(),
    utmSource: zod_1.z.string().optional(),
    utmMedium: zod_1.z.string().optional(),
    utmCampaign: zod_1.z.string().optional(),
});
const userInteractionSchema = zod_1.z.object({
    articleId: zod_1.z.string(),
    userId: zod_1.z.string(),
    interactionType: zod_1.z.enum(['like', 'comment', 'share', 'bookmark', 'helpful_vote']),
    targetId: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
const searchActivitySchema = zod_1.z.object({
    query: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    resultsCount: zod_1.z.number(),
    clickedResults: zod_1.z.array(zod_1.z.string()),
    filters: zod_1.z.record(zod_1.z.any()).optional(),
    responseTime: zod_1.z.number(),
    success: zod_1.z.boolean(),
});
router.get('/metrics', auth_1.requireAuth, async (req, res) => {
    try {
        const { start, end } = req.query;
        const timeRange = start && end
            ? {
                start: new Date(start),
                end: new Date(end),
            }
            : undefined;
        const metrics = await engine_1.knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics(timeRange);
        res.json({
            success: true,
            data: metrics,
        });
    }
    catch (error) {
        console.error('Error fetching knowledge base metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch knowledge base metrics',
        });
    }
});
router.get('/users/:userId/activity', auth_1.requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { start, end } = req.query;
        if (req.user.id !== userId && !req.user.roles.includes('ADMIN')) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
            });
        }
        const timeRange = start && end
            ? {
                start: new Date(start),
                end: new Date(end),
            }
            : undefined;
        const activity = await engine_1.knowledgeBaseAnalyticsEngine.getUserActivityMetrics(userId, timeRange);
        res.json({
            success: true,
            data: activity,
        });
    }
    catch (error) {
        console.error('Error fetching user activity metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user activity metrics',
        });
    }
});
router.get('/articles/:articleId/performance', auth_1.requireAuth, async (req, res) => {
    try {
        const { articleId } = req.params;
        const { start, end } = req.query;
        const timeRange = start && end
            ? {
                start: new Date(start),
                end: new Date(end),
            }
            : undefined;
        const performance = await engine_1.knowledgeBaseAnalyticsEngine.getContentPerformanceMetrics(articleId, timeRange);
        res.json({
            success: true,
            data: performance,
        });
    }
    catch (error) {
        console.error('Error fetching content performance metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch content performance metrics',
        });
    }
});
router.get('/health', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const health = await engine_1.knowledgeBaseAnalyticsEngine.getSystemHealthMetrics();
        res.json({
            success: true,
            data: health,
        });
    }
    catch (error) {
        console.error('Error fetching system health metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch system health metrics',
        });
    }
});
router.get('/alerts', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const { activeOnly } = req.query;
        const alerts = await engine_1.knowledgeBaseAnalyticsEngine.getAlerts(activeOnly === 'true');
        res.json({
            success: true,
            data: alerts,
        });
    }
    catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts',
        });
    }
});
router.post('/alerts/:alertId/resolve', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const { alertId } = req.params;
        const success = await engine_1.knowledgeBaseAnalyticsEngine.resolveAlert(alertId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found',
            });
        }
        res.json({
            success: true,
            message: 'Alert resolved successfully',
        });
    }
    catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve alert',
        });
    }
});
router.post('/views', (0, validation_1.validateRequest)(articleViewSchema), async (req, res) => {
    try {
        const viewData = req.body;
        await engine_1.knowledgeBaseAnalyticsEngine.recordArticleView(viewData);
        res.json({
            success: true,
            message: 'Article view recorded successfully',
        });
    }
    catch (error) {
        console.error('Error recording article view:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record article view',
        });
    }
});
router.post('/interactions', (0, validation_1.validateRequest)(userInteractionSchema), async (req, res) => {
    try {
        const interactionData = req.body;
        await engine_1.knowledgeBaseAnalyticsEngine.recordUserInteraction(interactionData);
        res.json({
            success: true,
            message: 'User interaction recorded successfully',
        });
    }
    catch (error) {
        console.error('Error recording user interaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record user interaction',
        });
    }
});
router.post('/search', (0, validation_1.validateRequest)(searchActivitySchema), async (req, res) => {
    try {
        const searchData = req.body;
        await engine_1.knowledgeBaseAnalyticsEngine.recordSearchActivity(searchData);
        res.json({
            success: true,
            message: 'Search activity recorded successfully',
        });
    }
    catch (error) {
        console.error('Error recording search activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record search activity',
        });
    }
});
router.get('/export', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const { format = 'json', start, end } = req.query;
        const timeRange = start && end
            ? {
                start: new Date(start),
                end: new Date(end),
            }
            : undefined;
        const metrics = await engine_1.knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics(timeRange);
        if (format === 'csv') {
            const csvData = convertToCSV(metrics);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="knowledge-base-analytics-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.send(csvData);
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="knowledge-base-analytics-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(metrics);
    }
    catch (error) {
        console.error('Error exporting analytics data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export analytics data',
        });
    }
});
router.get('/dashboard', auth_1.requireAuth, (0, auth_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const now = new Date();
        let start;
        switch (period) {
            case '1d':
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        const timeRange = { start, end: now };
        const [metrics, health, alerts] = await Promise.all([
            engine_1.knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics(timeRange),
            engine_1.knowledgeBaseAnalyticsEngine.getSystemHealthMetrics(),
            engine_1.knowledgeBaseAnalyticsEngine.getAlerts(true),
        ]);
        const dashboard = {
            overview: {
                totalViews: metrics.totalViews,
                totalArticles: metrics.totalArticles,
                activeUsers: metrics.activeUsers,
                averageReadTime: metrics.averageReadTime,
                systemHealth: health.overallStatus,
                healthScore: health.score,
                activeAlerts: alerts.length,
            },
            content: {
                topArticles: metrics.topArticles,
                topCategories: metrics.topCategories,
                userEngagement: metrics.userEngagement,
                contentGaps: metrics.contentGaps,
            },
            performance: {
                completionRate: metrics.averageReadTime > 0 ? Math.min(100, (metrics.averageReadTime / 300) * 100) : 0,
                bounceRate: 100 - (metrics.averageReadTime > 0 ? Math.min(100, (metrics.averageReadTime / 300) * 100) : 0),
                searchPerformance: health.checks.searchPerformance,
                systemResources: health.checks.systemResources,
            },
            alerts: alerts.slice(0, 10),
            recommendations: health.recommendations,
        };
        res.json({
            success: true,
            data: dashboard,
        });
    }
    catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
        });
    }
});
function convertToCSV(metrics) {
    const rows = [];
    rows.push('Metric,Value');
    rows.push(`Total Views,${metrics.totalViews}`);
    rows.push(`Total Articles,${metrics.totalArticles}`);
    rows.push(`Active Users,${metrics.activeUsers}`);
    rows.push(`Average Read Time,${metrics.averageReadTime}`);
    rows.push('');
    rows.push('Top Categories');
    rows.push('Category,Views');
    metrics.topCategories.forEach((cat) => {
        rows.push(`"${cat.category}",${cat.views}`);
    });
    rows.push('');
    rows.push('Top Articles');
    rows.push('Article ID,Title,Views');
    metrics.topArticles.forEach((article) => {
        rows.push(`${article.id},"${article.title}",${article.views}`);
    });
    rows.push('');
    rows.push('User Engagement');
    rows.push('Comments per Article,' + metrics.userEngagement.commentsPerArticle);
    rows.push('Likes per Article,' + metrics.userEngagement.likesPerArticle);
    rows.push('Shares per Article,' + metrics.userEngagement.sharesPerArticle);
    return rows.join('\n');
}
exports.default = router;
//# sourceMappingURL=index.js.map