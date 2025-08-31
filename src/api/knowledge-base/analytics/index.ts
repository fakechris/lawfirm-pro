import { Router, Request, Response } from 'express';
import { knowledgeBaseAnalyticsEngine } from '../../../services/knowledge-base/analytics/engine';
import { requireAuth, requireRole } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const timeRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

const articleViewSchema = z.object({
  articleId: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  readTime: z.number().optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

const userInteractionSchema = z.object({
  articleId: z.string(),
  userId: z.string(),
  interactionType: z.enum(['like', 'comment', 'share', 'bookmark', 'helpful_vote']),
  targetId: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const searchActivitySchema = z.object({
  query: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  resultsCount: z.number(),
  clickedResults: z.array(z.string()),
  filters: z.record(z.any()).optional(),
  responseTime: z.number(),
  success: z.boolean(),
});

// GET /api/knowledge-base/analytics/metrics
router.get('/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    
    const timeRange = start && end 
      ? {
          start: new Date(start as string),
          end: new Date(end as string),
        }
      : undefined;

    const metrics = await knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics(timeRange);
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching knowledge base metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge base metrics',
    });
  }
});

// GET /api/knowledge-base/analytics/users/:userId/activity
router.get('/users/:userId/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;
    
    // Users can only view their own activity unless they're admin
    if (req.user!.id !== userId && !req.user!.roles.includes('ADMIN')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const timeRange = start && end 
      ? {
          start: new Date(start as string),
          end: new Date(end as string),
        }
      : undefined;

    const activity = await knowledgeBaseAnalyticsEngine.getUserActivityMetrics(userId, timeRange);
    
    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error('Error fetching user activity metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activity metrics',
    });
  }
});

// GET /api/knowledge-base/analytics/articles/:articleId/performance
router.get('/articles/:articleId/performance', requireAuth, async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    const { start, end } = req.query;
    
    const timeRange = start && end 
      ? {
          start: new Date(start as string),
          end: new Date(end as string),
        }
      : undefined;

    const performance = await knowledgeBaseAnalyticsEngine.getContentPerformanceMetrics(articleId, timeRange);
    
    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error('Error fetching content performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch content performance metrics',
    });
  }
});

// GET /api/knowledge-base/analytics/health
router.get('/health', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const health = await knowledgeBaseAnalyticsEngine.getSystemHealthMetrics();
    
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Error fetching system health metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health metrics',
    });
  }
});

// GET /api/knowledge-base/analytics/alerts
router.get('/alerts', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { activeOnly } = req.query;
    const alerts = await knowledgeBaseAnalyticsEngine.getAlerts(activeOnly === 'true');
    
    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
    });
  }
});

// POST /api/knowledge-base/analytics/alerts/:alertId/resolve
router.post('/alerts/:alertId/resolve', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const success = await knowledgeBaseAnalyticsEngine.resolveAlert(alertId);
    
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
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
    });
  }
});

// POST /api/knowledge-base/analytics/views
router.post('/views', validateRequest(articleViewSchema), async (req: Request, res: Response) => {
  try {
    const viewData = req.body;
    
    await knowledgeBaseAnalyticsEngine.recordArticleView(viewData);
    
    res.json({
      success: true,
      message: 'Article view recorded successfully',
    });
  } catch (error) {
    console.error('Error recording article view:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record article view',
    });
  }
});

// POST /api/knowledge-base/analytics/interactions
router.post('/interactions', validateRequest(userInteractionSchema), async (req: Request, res: Response) => {
  try {
    const interactionData = req.body;
    
    await knowledgeBaseAnalyticsEngine.recordUserInteraction(interactionData);
    
    res.json({
      success: true,
      message: 'User interaction recorded successfully',
    });
  } catch (error) {
    console.error('Error recording user interaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record user interaction',
    });
  }
});

// POST /api/knowledge-base/analytics/search
router.post('/search', validateRequest(searchActivitySchema), async (req: Request, res: Response) => {
  try {
    const searchData = req.body;
    
    await knowledgeBaseAnalyticsEngine.recordSearchActivity(searchData);
    
    res.json({
      success: true,
      message: 'Search activity recorded successfully',
    });
  } catch (error) {
    console.error('Error recording search activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record search activity',
    });
  }
});

// GET /api/knowledge-base/analytics/export
router.get('/export', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { format = 'json', start, end } = req.query;
    
    const timeRange = start && end 
      ? {
          start: new Date(start as string),
          end: new Date(end as string),
        }
      : undefined;

    const metrics = await knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics(timeRange);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(metrics);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="knowledge-base-analytics-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvData);
    }
    
    // Default JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="knowledge-base-analytics-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(metrics);
  } catch (error) {
    console.error('Error exporting analytics data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data',
    });
  }
});

// GET /api/knowledge-base/analytics/dashboard
router.get('/dashboard', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;
    
    // Calculate time range based on period
    const now = new Date();
    let start: Date;
    
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
    
    // Fetch all dashboard data in parallel
    const [metrics, health, alerts] = await Promise.all([
      knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics(timeRange),
      knowledgeBaseAnalyticsEngine.getSystemHealthMetrics(),
      knowledgeBaseAnalyticsEngine.getAlerts(true),
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
        completionRate: metrics.averageReadTime > 0 ? Math.min(100, (metrics.averageReadTime / 300) * 100) : 0, // Simplified calculation
        bounceRate: 100 - (metrics.averageReadTime > 0 ? Math.min(100, (metrics.averageReadTime / 300) * 100) : 0),
        searchPerformance: health.checks.searchPerformance,
        systemResources: health.checks.systemResources,
      },
      alerts: alerts.slice(0, 10), // Top 10 alerts
      recommendations: health.recommendations,
    };
    
    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
});

// Helper function to convert metrics to CSV
function convertToCSV(metrics: any): string {
  const rows = [];
  
  // Header
  rows.push('Metric,Value');
  
  // Basic metrics
  rows.push(`Total Views,${metrics.totalViews}`);
  rows.push(`Total Articles,${metrics.totalArticles}`);
  rows.push(`Active Users,${metrics.activeUsers}`);
  rows.push(`Average Read Time,${metrics.averageReadTime}`);
  
  // Top categories
  rows.push('');
  rows.push('Top Categories');
  rows.push('Category,Views');
  metrics.topCategories.forEach((cat: any) => {
    rows.push(`"${cat.category}",${cat.views}`);
  });
  
  // Top articles
  rows.push('');
  rows.push('Top Articles');
  rows.push('Article ID,Title,Views');
  metrics.topArticles.forEach((article: any) => {
    rows.push(`${article.id},"${article.title}",${article.views}`);
  });
  
  // User engagement
  rows.push('');
  rows.push('User Engagement');
  rows.push('Comments per Article,' + metrics.userEngagement.commentsPerArticle);
  rows.push('Likes per Article,' + metrics.userEngagement.likesPerArticle);
  rows.push('Shares per Article,' + metrics.userEngagement.sharesPerArticle);
  
  return rows.join('\n');
}

export default router;