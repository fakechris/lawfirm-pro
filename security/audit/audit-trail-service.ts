import { container } from 'tsyringe';
import { Database } from '../../src/utils/database';
import { AuditedRequest } from '../../src/middleware/audit';
import { UserRole } from '@prisma/client';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  correlationId: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: 'USER_ACTION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SYSTEM_EVENT' | 'SECURITY_EVENT';
  complianceFlags: string[];
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  error?: string;
  metadata?: any;
}

export interface AuditFilter {
  userId?: string;
  userEmail?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditEvent['severity'][];
  category?: AuditEvent['category'][];
  ipAddress?: string;
  sessionId?: string;
  correlationId?: string;
  complianceFlags?: string[];
  result?: AuditEvent['result'][];
  limit?: number;
  offset?: number;
}

export interface AuditAnalytics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByUser: Record<string, number>;
  eventsByEntityType: Record<string, number>;
  complianceViolations: number;
  securityEvents: number;
  uniqueUsers: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface ComplianceReport {
  period: {
    start: Date;
    end: Date;
  };
  totalEvents: number;
  piplCompliance: {
    dataAccessLogs: number;
    consentRecords: number;
    dataProcessingActivities: number;
    crossBorderTransfers: number;
    violations: number;
  };
  cslCompliance: {
    networkSecurityEvents: number;
    dataClassificationEvents: number;
    accessControlEvents: number;
    violations: number;
  };
  dslCompliance: {
    dataSubjectRequests: number;
    dataRetentionEvents: number;
    dataDeletionEvents: number;
    violations: number;
  };
  recommendations: string[];
}

export class AuditTrailService {
  private static db = container.resolve(Database);
  private static readonly COMPLIANCE_FLAGS = {
    PIPL_DATA_ACCESS: 'PIPL_DATA_ACCESS',
    PIPL_CONSENT: 'PIPL_CONSENT',
    PIPL_PROCESSING: 'PIPL_PROCESSING',
    PIPL_CROSS_BORDER: 'PIPL_CROSS_BORDER',
    CSL_NETWORK_SECURITY: 'CSL_NETWORK_SECURITY',
    CSL_DATA_CLASSIFICATION: 'CSL_DATA_CLASSIFICATION',
    CSL_ACCESS_CONTROL: 'CSL_ACCESS_CONTROL',
    DSL_DATA_SUBJECT: 'DSL_DATA_SUBJECT',
    DSL_RETENTION: 'DSL_RETENTION',
    DSL_DELETION: 'DSL_DELETION'
  };

  static async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent> {
    try {
      const auditLog = await this.db.client.auditLog.create({
        data: {
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          userId: event.userId,
          oldValues: event.oldValues,
          newValues: event.newValues,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: {
            sessionId: event.sessionId,
            correlationId: event.correlationId,
            severity: event.severity,
            category: event.category,
            complianceFlags: event.complianceFlags,
            result: event.result,
            error: event.error,
            userEmail: event.userEmail,
            userRole: event.userRole,
            ...event.metadata
          }
        }
      });

      return {
        id: auditLog.id,
        timestamp: auditLog.timestamp,
        userId: auditLog.userId,
        userEmail: event.userEmail,
        userRole: event.userRole,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        oldValues: auditLog.oldValues,
        newValues: auditLog.newValues,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        sessionId: event.sessionId,
        correlationId: event.correlationId,
        severity: event.severity,
        category: event.category,
        complianceFlags: event.complianceFlags,
        result: event.result,
        error: event.error,
        metadata: event.metadata
      };
    } catch (error) {
      console.error('Failed to create audit event:', error);
      throw new Error(`Audit logging failed: ${error}`);
    }
  }

  static async getEvents(filter: AuditFilter): Promise<AuditEvent[]> {
    const where: any = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = { contains: filter.action, mode: 'insensitive' };
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.startDate || filter.endDate) {
      where.timestamp = {};
      if (filter.startDate) where.timestamp.gte = filter.startDate;
      if (filter.endDate) where.timestamp.lte = filter.endDate;
    }
    if (filter.ipAddress) where.ipAddress = filter.ipAddress;

    if (filter.severity || filter.category || filter.complianceFlags || filter.result || filter.userEmail) {
      where.metadata = {};
      if (filter.severity) where.metadata.severity = { in: filter.severity };
      if (filter.category) where.metadata.category = { in: filter.category };
      if (filter.complianceFlags) where.metadata.complianceFlags = { hasAny: filter.complianceFlags };
      if (filter.result) where.metadata.result = { in: filter.result };
      if (filter.userEmail) where.metadata.userEmail = filter.userEmail;
    }

    const logs = await this.db.client.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filter.limit || 100,
      skip: filter.offset || 0
    });

    return logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      userId: log.userId,
      userEmail: log.metadata?.userEmail || '',
      userRole: log.metadata?.userRole || UserRole.USER,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValues: log.oldValues,
      newValues: log.newValues,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      sessionId: log.metadata?.sessionId || '',
      correlationId: log.metadata?.correlationId || '',
      severity: log.metadata?.severity || 'INFO',
      category: log.metadata?.category || 'USER_ACTION',
      complianceFlags: log.metadata?.complianceFlags || [],
      result: log.metadata?.result || 'SUCCESS',
      error: log.metadata?.error,
      metadata: log.metadata
    }));
  }

  static async getAnalytics(startDate: Date, endDate: Date): Promise<AuditAnalytics> {
    const logs = await this.db.client.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const events = logs.map(log => ({
      severity: log.metadata?.severity || 'INFO',
      category: log.metadata?.category || 'USER_ACTION',
      userId: log.userId,
      entityType: log.entityType,
      complianceFlags: log.metadata?.complianceFlags || []
    }));

    return {
      totalEvents: logs.length,
      eventsByCategory: this.groupBy(events, 'category'),
      eventsBySeverity: this.groupBy(events, 'severity'),
      eventsByUser: this.groupBy(events, 'userId'),
      eventsByEntityType: this.groupBy(events, 'entityType'),
      complianceViolations: events.filter(e => e.complianceFlags.length > 0).length,
      securityEvents: events.filter(e => e.category === 'SECURITY_EVENT').length,
      uniqueUsers: new Set(events.map(e => e.userId)).size,
      timeRange: { start: startDate, end: endDate }
    };
  }

  static async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const logs = await this.db.client.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const events = logs.map(log => ({
      category: log.metadata?.category || 'USER_ACTION',
      complianceFlags: log.metadata?.complianceFlags || [],
      action: log.action,
      result: log.metadata?.result || 'SUCCESS'
    }));

    const piplDataAccess = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.PIPL_DATA_ACCESS)
    ).length;
    const piplConsent = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.PIPL_CONSENT)
    ).length;
    const piplProcessing = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.PIPL_PROCESSING)
    ).length;
    const piplCrossBorder = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.PIPL_CROSS_BORDER)
    ).length;

    const cslNetworkSecurity = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.CSL_NETWORK_SECURITY)
    ).length;
    const cslDataClassification = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.CSL_DATA_CLASSIFICATION)
    ).length;
    const cslAccessControl = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.CSL_ACCESS_CONTROL)
    ).length;

    const dslDataSubject = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.DSL_DATA_SUBJECT)
    ).length;
    const dslRetention = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.DSL_RETENTION)
    ).length;
    const dslDeletion = events.filter(e => 
      e.complianceFlags.includes(this.COMPLIANCE_FLAGS.DSL_DELETION)
    ).length;

    const violations = events.filter(e => e.result === 'FAILURE' || e.result === 'BLOCKED').length;

    return {
      period: { start: startDate, end: endDate },
      totalEvents: logs.length,
      piplCompliance: {
        dataAccessLogs: piplDataAccess,
        consentRecords: piplConsent,
        dataProcessingActivities: piplProcessing,
        crossBorderTransfers: piplCrossBorder,
        violations: violations
      },
      cslCompliance: {
        networkSecurityEvents: cslNetworkSecurity,
        dataClassificationEvents: cslDataClassification,
        accessControlEvents: cslAccessControl,
        violations: violations
      },
      dslCompliance: {
        dataSubjectRequests: dslDataSubject,
        dataRetentionEvents: dslRetention,
        dataDeletionEvents: dslDeletion,
        violations: violations
      },
      recommendations: this.generateRecommendations(events)
    };
  }

  static async exportToCSV(filter: AuditFilter): Promise<string> {
    const events = await this.getEvents(filter);
    
    const headers = [
      'Timestamp', 'User ID', 'User Email', 'User Role', 'Action', 
      'Entity Type', 'Entity ID', 'IP Address', 'Severity', 'Category',
      'Result', 'Compliance Flags', 'Error'
    ];

    const rows = events.map(event => [
      event.timestamp.toISOString(),
      event.userId,
      event.userEmail,
      event.userRole,
      event.action,
      event.entityType,
      event.entityId,
      event.ipAddress,
      event.severity,
      event.category,
      event.result,
      event.complianceFlags.join(';'),
      event.error || ''
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  static async exportToJSON(filter: AuditFilter): Promise<string> {
    const events = await this.getEvents(filter);
    return JSON.stringify(events, null, 2);
  }

  static async cleanupOldEvents(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.client.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }

  private static groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private static generateRecommendations(events: any[]): string[] {
    const recommendations: string[] = [];
    
    const failureRate = events.filter(e => e.result === 'FAILURE' || e.result === 'BLOCKED').length / events.length;
    if (failureRate > 0.1) {
      recommendations.push('High failure rate detected. Review system logs and user access patterns.');
    }

    const securityEvents = events.filter(e => e.category === 'SECURITY_EVENT').length;
    if (securityEvents > events.length * 0.05) {
      recommendations.push('Elevated security events detected. Implement additional security measures.');
    }

    const complianceViolations = events.filter(e => e.complianceFlags.length > 0).length;
    if (complianceViolations > events.length * 0.1) {
      recommendations.push('Compliance violations detected. Review data handling procedures.');
    }

    return recommendations;
  }
}