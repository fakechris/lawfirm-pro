import { Request, Response, NextFunction } from 'express';
import { AuditTrailService, AuditFilter, ComplianceReport } from './audit-trail-service';
import { EnhancedAuditMiddleware } from './enhanced-audit-middleware';
import { UserRole } from '@prisma/client';

export class AuditController {
  static async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const filter: AuditFilter = {
        userId: req.query.userId as string,
        userEmail: req.query.userEmail as string,
        action: req.query.action as string,
        entityType: req.query.entityType as string,
        entityId: req.query.entityId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        severity: req.query.severity ? (req.query.severity as string).split(',') as AuditFilter['severity'] : undefined,
        category: req.query.category ? (req.query.category as string).split(',') as AuditFilter['category'] : undefined,
        ipAddress: req.query.ipAddress as string,
        sessionId: req.query.sessionId as string,
        correlationId: req.query.correlationId as string,
        complianceFlags: req.query.complianceFlags ? (req.query.complianceFlags as string).split(',') : undefined,
        result: req.query.result ? (req.query.result as string).split(',') as AuditFilter['result'] : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const events = await AuditTrailService.getEvents(filter);
      
      res.json({
        success: true,
        data: events,
        total: events.length,
        filter
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }

      const analytics = await AuditTrailService.getAnalytics(startDate, endDate);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  static async getComplianceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }

      const report = await AuditTrailService.generateComplianceReport(startDate, endDate);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as 'csv' | 'json' || 'csv';
      const filter: AuditFilter = {
        userId: req.query.userId as string,
        userEmail: req.query.userEmail as string,
        action: req.query.action as string,
        entityType: req.query.entityType as string,
        entityId: req.query.entityId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        severity: req.query.severity ? (req.query.severity as string).split(',') as AuditFilter['severity'] : undefined,
        category: req.query.category ? (req.query.category as string).split(',') as AuditFilter['category'] : undefined,
        ipAddress: req.query.ipAddress as string,
        sessionId: req.query.sessionId as string,
        correlationId: req.query.correlationId as string,
        complianceFlags: req.query.complianceFlags ? (req.query.complianceFlags as string).split(',') : undefined,
        result: req.query.result ? (req.query.result as string).split(',') as AuditFilter['result'] : undefined
      };

      let content: string;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        content = await AuditTrailService.exportToCSV(filter);
        contentType = 'text/csv';
        filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        content = await AuditTrailService.exportToJSON(filter);
        contentType = 'application/json';
        filename = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      next(error);
    }
  }

  static async getRealTimeMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000;
      const metrics = await EnhancedAuditMiddleware.getRealTimeMetrics(timeRange);
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  static async detectAnomalies(req: Request, res: Response, next: NextFunction) {
    try {
      const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000;
      const anomalies = await EnhancedAuditMiddleware.detectAnomalies(timeRange);
      
      res.json({
        success: true,
        data: anomalies,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  static async cleanupOldLogs(req: Request, res: Response, next: NextFunction) {
    try {
      if ((req.user as any)?.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const retentionDays = req.query.retentionDays ? parseInt(req.query.retentionDays as string) : 365;
      const deletedCount = await AuditTrailService.cleanupOldEvents(retentionDays);
      
      res.json({
        success: true,
        data: {
          deletedCount,
          retentionDays,
          message: `Cleaned up ${deletedCount} old audit logs`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [analytics24h, analytics7d, analytics30d, realTimeMetrics, anomalies] = await Promise.all([
        AuditTrailService.getAnalytics(last24Hours, now),
        AuditTrailService.getAnalytics(last7Days, now),
        AuditTrailService.getAnalytics(last30Days, now),
        EnhancedAuditMiddleware.getRealTimeMetrics(3600000),
        EnhancedAuditMiddleware.detectAnomalies(3600000)
      ]);

      const dashboard = {
        period: {
          last24Hours: analytics24h,
          last7Days: analytics7d,
          last30Days: analytics30d
        },
        realTime: realTimeMetrics,
        anomalies,
        timestamp: now.toISOString()
      };

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserActivityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId;
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }

      const filter: AuditFilter = {
        userId,
        startDate,
        endDate,
        limit: 1000
      };

      const events = await AuditTrailService.getEvents(filter);
      const analytics = await AuditTrailService.getAnalytics(startDate, endDate);

      const userActivity = {
        userId,
        totalEvents: events.length,
        eventsByAction: events.reduce((acc, event) => {
          acc[event.action] = (acc[event.action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsByEntityType: events.reduce((acc, event) => {
          acc[event.entityType] = (acc[event.entityType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        successRate: events.filter(e => e.result === 'SUCCESS').length / events.length,
        complianceEvents: events.filter(e => e.complianceFlags.length > 0).length,
        recentActivity: events.slice(0, 10),
        timeRange: { start: startDate, end: endDate }
      };

      res.json({
        success: true,
        data: userActivity
      });
    } catch (error) {
      next(error);
    }
  }

  static async getComplianceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const report = await AuditTrailService.generateComplianceReport(last30Days, now);

      const summary = {
        period: {
          start: last30Days,
          end: now
        },
        overallCompliance: {
          totalEvents: report.totalEvents,
          totalViolations: report.piplCompliance.violations + report.cslCompliance.violations + report.dslCompliance.violations,
          complianceScore: Math.max(0, 100 - ((report.piplCompliance.violations + report.cslCompliance.violations + report.dslCompliance.violations) / report.totalEvents) * 100)
        },
        pipl: report.piplCompliance,
        csl: report.cslCompliance,
        dsl: report.dslCompliance,
        recommendations: report.recommendations,
        criticalIssues: report.recommendations.filter(r => r.includes('critical') || r.includes('elevated') || r.includes('high'))
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
}