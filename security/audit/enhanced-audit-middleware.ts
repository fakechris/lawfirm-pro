import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { container } from 'tsyringe';
import { Database } from '../../src/utils/database';
import { UserRole } from '@prisma/client';
import { AuditTrailService, AuditEvent } from './audit-trail-service';

export interface EnhancedAuditedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
  sessionId?: string;
  correlationId?: string;
}

export class EnhancedAuditMiddleware {
  private static db = container.resolve(Database);

  static logAction(
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any,
    severity: AuditEvent['severity'] = 'INFO',
    category: AuditEvent['category'] = 'USER_ACTION',
    complianceFlags: string[] = []
  ) {
    return async (req: EnhancedAuditedRequest, res: Response, next: NextFunction) => {
      const sessionId = req.sessionId || req.headers['x-session-id'] as string || uuidv4();
      const correlationId = req.correlationId || req.headers['x-correlation-id'] as string || uuidv4();
      
      req.sessionId = sessionId;
      req.correlationId = correlationId;

      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = function(data) {
        EnhancedAuditMiddleware.createEnhancedAuditLog(
          req, action, entityType, entityId, oldValues, newValues,
          severity, category, complianceFlags, res.statusCode
        );
        return originalSend.call(this, data);
      };
      
      res.json = function(data) {
        EnhancedAuditMiddleware.createEnhancedAuditLog(
          req, action, entityType, entityId, oldValues, newValues,
          severity, category, complianceFlags, res.statusCode
        );
        return originalJson.call(this, data);
      };

      next();
    };
  }

  static logDataAccess(
    action: string,
    entityType: string,
    entityId?: string,
    complianceFlags: string[] = []
  ) {
    return EnhancedAuditMiddleware.logAction(
      action, entityType, entityId, undefined, undefined,
      'INFO', 'DATA_ACCESS', complianceFlags
    );
  }

  static logDataModification(
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any,
    complianceFlags: string[] = []
  ) {
    return EnhancedAuditMiddleware.logAction(
      action, entityType, entityId, oldValues, newValues,
      'WARNING', 'DATA_MODIFICATION', complianceFlags
    );
  }

  static logSecurityEvent(
    action: string,
    entityType: string,
    entityId?: string,
    severity: AuditEvent['severity'] = 'WARNING',
    complianceFlags: string[] = []
  ) {
    return EnhancedAuditMiddleware.logAction(
      action, entityType, entityId, undefined, undefined,
      severity, 'SECURITY_EVENT', complianceFlags
    );
  }

  static logSystemEvent(
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: any
  ) {
    return EnhancedAuditMiddleware.logAction(
      action, entityType, entityId, undefined, undefined,
      'INFO', 'SYSTEM_EVENT', [], metadata
    );
  }

  static logPIPLCompliance(
    action: string,
    entityType: string,
    entityId?: string,
    complianceType: 'DATA_ACCESS' | 'CONSENT' | 'PROCESSING' | 'CROSS_BORDER' = 'DATA_ACCESS'
  ) {
    const complianceFlags = [`PIPL_${complianceType}`];
    return EnhancedAuditMiddleware.logAction(
      action, entityType, entityId, undefined, undefined,
      'WARNING', 'DATA_ACCESS', complianceFlags
    );
  }

  static logCSLCompliance(
    action: string,
    entityType: string,
    entityId?: string,
    complianceType: 'NETWORK_SECURITY' | 'DATA_CLASSIFICATION' | 'ACCESS_CONTROL' = 'NETWORK_SECURITY'
  ) {
    const complianceFlags = [`CSL_${complianceType}`];
    return EnhancedAuditMiddleware.logAction(
      action, entityType, entityId, undefined, undefined,
      'WARNING', 'SECURITY_EVENT', complianceFlags
    );
  }

  static logDSLCompliance(
    action: string,
    entityType: string,
    entityId?: string,
    complianceType: 'DATA_SUBJECT' | 'RETENTION' | 'DELETION' = 'DATA_SUBJECT'
  ) {
    const complianceFlags = [`DSL_${complianceType}`];
    return EnhancedAuditMiddleware.logAction(
      action, entityType, entityId, undefined, undefined,
      'INFO', 'USER_ACTION', complianceFlags
    );
  }

  private static async createEnhancedAuditLog(
    req: EnhancedAuditedRequest,
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any,
    severity: AuditEvent['severity'] = 'INFO',
    category: AuditEvent['category'] = 'USER_ACTION',
    complianceFlags: string[] = [],
    statusCode: number = 200,
    metadata?: any
  ) {
    try {
      const result: AuditEvent['result'] = statusCode >= 400 ? 'FAILURE' : 'SUCCESS';
      const error = statusCode >= 400 ? `HTTP ${statusCode}` : undefined;

      await AuditTrailService.logEvent({
        userId: req.user?.id || 'anonymous',
        userEmail: req.user?.email || '',
        userRole: req.user?.role || UserRole.USER,
        action,
        entityType,
        entityId: entityId || 'unknown',
        oldValues,
        newValues,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.sessionId || uuidv4(),
        correlationId: req.correlationId || uuidv4(),
        severity,
        category,
        complianceFlags,
        result,
        error,
        metadata
      });
    } catch (error) {
      console.error('Failed to create enhanced audit log:', error);
    }
  }

  static async getRealTimeMetrics(timeRange: number = 3600000) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeRange);

    try {
      const logs = await EnhancedAuditMiddleware.db.client.auditLog.findMany({
        where: {
          timestamp: {
            gte: startTime,
            lte: endTime
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      const metrics = {
        totalEvents: logs.length,
        eventsBySecond: this.calculateEventsBySecond(logs, startTime, endTime),
        eventsBySeverity: this.groupByField(logs, 'metadata.severity'),
        eventsByCategory: this.groupByField(logs, 'metadata.category'),
        uniqueUsers: new Set(logs.map(log => log.userId)).size,
        failureRate: logs.filter(log => log.metadata?.result === 'FAILURE').length / logs.length,
        securityEvents: logs.filter(log => log.metadata?.category === 'SECURITY_EVENT').length,
        complianceViolations: logs.filter(log => 
          log.metadata?.complianceFlags && log.metadata.complianceFlags.length > 0
        ).length,
        topIPs: this.getTopIPs(logs),
        topActions: this.getTopActions(logs),
        recentEvents: logs.slice(0, 10).map(log => ({
          timestamp: log.timestamp,
          action: log.action,
          user: log.metadata?.userEmail || log.userId,
          severity: log.metadata?.severity || 'INFO',
          result: log.metadata?.result || 'SUCCESS'
        }))
      };

      return metrics;
    } catch (error) {
      console.error('Failed to get real-time metrics:', error);
      return null;
    }
  }

  static async detectAnomalies(timeRange: number = 3600000) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeRange);

    try {
      const logs = await EnhancedAuditMiddleware.db.client.auditLog.findMany({
        where: {
          timestamp: {
            gte: startTime,
            lte: endTime
          }
        }
      });

      const anomalies: any[] = [];

      const userActionCounts = this.groupByField(logs, 'userId');
      const suspiciousUsers = Object.entries(userActionCounts)
        .filter(([_, count]) => count > 100)
        .map(([userId, count]) => ({
          type: 'HIGH_FREQUENCY_USER',
          userId,
          actionCount: count,
          severity: 'WARNING'
        }));

      anomalies.push(...suspiciousUsers);

      const failureRate = logs.filter(log => log.metadata?.result === 'FAILURE').length / logs.length;
      if (failureRate > 0.2) {
        anomalies.push({
          type: 'HIGH_FAILURE_RATE',
          failureRate,
          severity: 'ERROR'
        });
      }

      const uniqueIPs = new Set(logs.map(log => log.ipAddress)).size;
      const uniqueUsers = new Set(logs.map(log => log.userId)).size;
      if (uniqueIPs / uniqueUsers > 5) {
        anomalies.push({
          type: 'MULTIPLE_IPS_PER_USER',
          ratio: uniqueIPs / uniqueUsers,
          severity: 'WARNING'
        });
      }

      const securityEvents = logs.filter(log => log.metadata?.category === 'SECURITY_EVENT').length;
      if (securityEvents > logs.length * 0.1) {
        anomalies.push({
          type: 'ELEVATED_SECURITY_EVENTS',
          securityEventRate: securityEvents / logs.length,
          severity: 'ERROR'
        });
      }

      return anomalies;
    } catch (error) {
      console.error('Failed to detect anomalies:', error);
      return [];
    }
  }

  private static calculateEventsBySecond(logs: any[], startTime: Date, endTime: Date): number[] {
    const seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const eventsBySecond = new Array(seconds).fill(0);

    logs.forEach(log => {
      const second = Math.floor((log.timestamp.getTime() - startTime.getTime()) / 1000);
      if (second >= 0 && second < seconds) {
        eventsBySecond[second]++;
      }
    });

    return eventsBySecond;
  }

  private static groupByField(logs: any[], fieldPath: string): Record<string, number> {
    return logs.reduce((groups, log) => {
      const value = this.getNestedValue(log, fieldPath);
      const key = value || 'unknown';
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static getTopIPs(logs: any[], limit: number = 5): Array<{ ip: string; count: number }> {
    const ipCounts = logs.reduce((counts, log) => {
      counts[log.ipAddress] = (counts[log.ipAddress] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private static getTopActions(logs: any[], limit: number = 5): Array<{ action: string; count: number }> {
    const actionCounts = logs.reduce((counts, log) => {
      counts[log.action] = (counts[log.action] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}