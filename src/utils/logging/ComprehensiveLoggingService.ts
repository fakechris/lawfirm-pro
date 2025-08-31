import { Logger } from '../../utils/logger';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  service: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  traceId?: string;
  spanId?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  userId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  riskLevel: RiskLevel;
  complianceTags?: string[];
}

export interface LogQuery {
  level?: LogLevel;
  service?: string;
  operation?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
  tags?: string[];
  traceId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditQuery {
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
  result?: AuditLogEntry['result'];
  riskLevel?: RiskLevel;
  limit?: number;
  offset?: number;
}

export interface LogAggregation {
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  groupBy?: string[];
  timeRange?: {
    start: Date;
    end: Date;
    interval: number; // in seconds
  };
}

export interface LogExportOptions {
  format: 'json' | 'csv' | 'xml';
  compression?: 'gzip' | 'zip';
  includeMetadata?: boolean;
  filterSensitive?: boolean;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type AuditAction = 
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN'
  | 'PERMISSION_CHANGE' | 'CONFIG_CHANGE'
  | 'DATA_EXPORT' | 'DATA_IMPORT'
  | 'SECURITY_EVENT' | 'COMPLIANCE_CHECK';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export class ComprehensiveLoggingService {
  private logger: Logger;
  private logs: LogEntry[];
  private auditLogs: AuditLogEntry[];
  private logAggregations: Map<string, LogAggregation>;
  private retentionPolicies: Map<string, number>; // service -> retention days
  private sensitiveDataPatterns: RegExp[];

  constructor() {
    this.logger = new Logger('ComprehensiveLoggingService');
    this.logs = [];
    this.auditLogs = [];
    this.logAggregations = new Map();
    this.retentionPolicies = new Map();
    this.sensitiveDataPatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /api[_-]?key/i,
      /auth[_-]?token/i,
      /credit[_-]?card/i,
      /ssn/i,
      /social[_-]?security/i,
      /personal[_-]?id/i,
      /passport/i,
      /license/i
    ];
    
    this.initializeRetentionPolicies();
    this.startPeriodicTasks();
  }

  async log(
    level: LogLevel,
    message: string,
    context: {
      service: string;
      operation?: string;
      userId?: string;
      sessionId?: string;
      requestId?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
      tags?: string[];
      traceId?: string;
      spanId?: string;
    }
  ): Promise<void> {
    try {
      const logEntry: LogEntry = {
        id: this.generateLogId(),
        timestamp: new Date(),
        level,
        message,
        service: context.service,
        operation: context.operation,
        userId: context.userId,
        sessionId: context.sessionId,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: this.sanitizeMetadata(context.metadata),
        tags: context.tags,
        traceId: context.traceId,
        spanId: context.spanId
      };

      this.logs.push(logEntry);

      // Keep only last 100,000 logs to prevent memory issues
      if (this.logs.length > 100000) {
        this.logs = this.logs.slice(-100000);
      }

      // Log to winston as well
      this.logToWinston(level, message, logEntry);

      // Check for alert conditions
      await this.checkLogAlerts(logEntry);
    } catch (error) {
      this.logger.error('Error logging entry', { error, level, message, context });
    }
  }

  async debug(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void> {
    await this.log('DEBUG', message, context);
  }

  async info(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void> {
    await this.log('INFO', message, context);
  }

  async warn(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void> {
    await this.log('WARN', message, context);
  }

  async error(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void> {
    await this.log('ERROR', message, context);
  }

  async critical(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void> {
    await this.log('CRITICAL', message, context);
  }

  async auditLog(
    action: AuditAction,
    resource: string,
    userId: string,
    context: {
      resourceId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      details: Record<string, any>;
      result?: AuditLogEntry['result'];
      riskLevel?: RiskLevel;
      complianceTags?: string[];
    }
  ): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: this.generateAuditId(),
        timestamp: new Date(),
        action,
        resource,
        resourceId: context.resourceId,
        userId,
        sessionId: context.sessionId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: this.sanitizeMetadata(context.details),
        result: context.result || 'SUCCESS',
        riskLevel: context.riskLevel || this.calculateRiskLevel(action, resource, context.details),
        complianceTags: context.complianceTags
      };

      this.auditLogs.push(auditEntry);

      // Keep only last 50,000 audit logs
      if (this.auditLogs.length > 50000) {
        this.auditLogs = this.auditLogs.slice(-50000);
      }

      // Log regular entry as well
      await this.log('INFO', `Audit: ${action} ${resource}`, {
        service: 'audit',
        operation: action,
        userId,
        metadata: { auditEntryId: auditEntry.id, result: auditEntry.result }
      });

      // Check for security alerts
      await this.checkSecurityAlerts(auditEntry);
    } catch (error) {
      this.logger.error('Error logging audit entry', { error, action, resource, userId });
    }
  }

  async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    try {
      let filteredLogs = [...this.logs];

      // Apply filters
      if (query.level) {
        filteredLogs = filteredLogs.filter(log => log.level === query.level);
      }

      if (query.service) {
        filteredLogs = filteredLogs.filter(log => log.service === query.service);
      }

      if (query.operation) {
        filteredLogs = filteredLogs.filter(log => log.operation === query.operation);
      }

      if (query.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === query.userId);
      }

      if (query.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime!);
      }

      if (query.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime!);
      }

      if (query.tags && query.tags.length > 0) {
        filteredLogs = filteredLogs.filter(log => 
          log.tags && query.tags!.some(tag => log.tags!.includes(tag))
        );
      }

      if (query.traceId) {
        filteredLogs = filteredLogs.filter(log => log.traceId === query.traceId);
      }

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      
      return filteredLogs.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('Error querying logs', { error, query });
      return [];
    }
  }

  async queryAuditLogs(query: AuditQuery): Promise<AuditLogEntry[]> {
    try {
      let filteredLogs = [...this.auditLogs];

      // Apply filters
      if (query.action) {
        filteredLogs = filteredLogs.filter(log => log.action === query.action);
      }

      if (query.resource) {
        filteredLogs = filteredLogs.filter(log => log.resource === query.resource);
      }

      if (query.resourceId) {
        filteredLogs = filteredLogs.filter(log => log.resourceId === query.resourceId);
      }

      if (query.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === query.userId);
      }

      if (query.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime!);
      }

      if (query.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime!);
      }

      if (query.result) {
        filteredLogs = filteredLogs.filter(log => log.result === query.result);
      }

      if (query.riskLevel) {
        filteredLogs = filteredLogs.filter(log => log.riskLevel === query.riskLevel);
      }

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      
      return filteredLogs.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('Error querying audit logs', { error, query });
      return [];
    }
  }

  async aggregateLogs(aggregation: LogAggregation): Promise<Record<string, number>> {
    try {
      let filteredLogs = [...this.logs];

      // Apply time range filter if specified
      if (aggregation.timeRange) {
        filteredLogs = filteredLogs.filter(log => 
          log.timestamp >= aggregation.timeRange!.start &&
          log.timestamp <= aggregation.timeRange!.end
        );
      }

      const results: Record<string, number> = {};

      if (aggregation.groupBy && aggregation.groupBy.length > 0) {
        // Group by specified fields
        const groups = new Map<string, LogEntry[]>();
        
        filteredLogs.forEach(log => {
          const key = aggregation.groupBy!.map(field => {
            switch (field) {
              case 'level':
                return log.level;
              case 'service':
                return log.service;
              case 'operation':
                return log.operation || 'unknown';
              case 'hour':
                return log.timestamp.getHours().toString();
              case 'day':
                return log.timestamp.toISOString().split('T')[0];
              default:
                return 'unknown';
            }
          }).join('|');

          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(log);
        });

        // Apply aggregation operation to each group
        groups.forEach((groupLogs, key) => {
          results[key] = this.applyAggregation(groupLogs, aggregation.operation, aggregation.field);
        });
      } else {
        // Apply aggregation to all logs
        results['total'] = this.applyAggregation(filteredLogs, aggregation.operation, aggregation.field);
      }

      return results;
    } catch (error) {
      this.logger.error('Error aggregating logs', { error, aggregation });
      return {};
    }
  }

  async exportLogs(query: LogQuery, options: LogExportOptions): Promise<string> {
    try {
      const logs = await this.queryLogs(query);
      
      let exportData: string;
      
      switch (options.format) {
        case 'json':
          exportData = JSON.stringify(logs, null, 2);
          break;
        case 'csv':
          exportData = this.convertToCSV(logs);
          break;
        case 'xml':
          exportData = this.convertToXML(logs);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Apply compression if requested
      if (options.compression) {
        exportData = await this.compressData(exportData, options.compression);
      }

      return exportData;
    } catch (error) {
      this.logger.error('Error exporting logs', { error, query, options });
      throw error;
    }
  }

  async getLogStats(): Promise<{
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByService: Record<string, number>;
    recentErrors: LogEntry[];
    storageUsage: number;
  }> {
    try {
      const logsByLevel: Record<LogLevel, number> = {
        DEBUG: 0,
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        CRITICAL: 0
      };

      const logsByService: Record<string, number> = {};

      this.logs.forEach(log => {
        logsByLevel[log.level]++;
        logsByService[log.service] = (logsByService[log.service] || 0) + 1;
      });

      const recentErrors = this.logs
        .filter(log => log.level === 'ERROR' || log.level === 'CRITICAL')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      // Estimate storage usage (rough approximation)
      const storageUsage = JSON.stringify(this.logs).length + JSON.stringify(this.auditLogs).length;

      return {
        totalLogs: this.logs.length,
        logsByLevel,
        logsByService,
        recentErrors,
        storageUsage
      };
    } catch (error) {
      this.logger.error('Error getting log stats', { error });
      throw error;
    }
  }

  async getAuditStats(): Promise<{
    totalAudits: number;
    auditsByAction: Record<AuditAction, number>;
    auditsByRiskLevel: Record<RiskLevel, number>;
    recentSecurityEvents: AuditLogEntry[];
    complianceRate: number;
  }> {
    try {
      const auditsByAction: Record<AuditAction, number> = {
        CREATE: 0,
        READ: 0,
        UPDATE: 0,
        DELETE: 0,
        LOGIN: 0,
        LOGOUT: 0,
        FAILED_LOGIN: 0,
        PERMISSION_CHANGE: 0,
        CONFIG_CHANGE: 0,
        DATA_EXPORT: 0,
        DATA_IMPORT: 0,
        SECURITY_EVENT: 0,
        COMPLIANCE_CHECK: 0
      };

      const auditsByRiskLevel: Record<RiskLevel, number> = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0
      };

      this.auditLogs.forEach(audit => {
        auditsByAction[audit.action]++;
        auditsByRiskLevel[audit.riskLevel]++;
      });

      const recentSecurityEvents = this.auditLogs
        .filter(audit => audit.riskLevel === 'HIGH' || audit.riskLevel === 'CRITICAL')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      const successfulAudits = this.auditLogs.filter(audit => audit.result === 'SUCCESS').length;
      const complianceRate = this.auditLogs.length > 0 ? (successfulAudits / this.auditLogs.length) * 100 : 0;

      return {
        totalAudits: this.auditLogs.length,
        auditsByAction,
        auditsByRiskLevel,
        recentSecurityEvents,
        complianceRate
      };
    } catch (error) {
      this.logger.error('Error getting audit stats', { error });
      throw error;
    }
  }

  async setRetentionPolicy(service: string, retentionDays: number): Promise<void> {
    this.retentionPolicies.set(service, retentionDays);
    this.logger.info('Log retention policy set', { service, retentionDays });
  }

  async getRetentionPolicies(): Promise<Record<string, number>> {
    return Object.fromEntries(this.retentionPolicies);
  }

  private async checkLogAlerts(logEntry: LogEntry): Promise<void> {
    // Check for error rate alerts
    if (logEntry.level === 'ERROR' || logEntry.level === 'CRITICAL') {
      const recentErrors = this.logs.filter(log => 
        (log.level === 'ERROR' || log.level === 'CRITICAL') &&
        log.service === logEntry.service &&
        log.timestamp > new Date(Date.now() - 5 * 60 * 1000) // last 5 minutes
      );

      if (recentErrors.length > 10) {
        this.logger.warn('High error rate detected', { 
          service: logEntry.service, 
          errorCount: recentErrors.length,
          timeWindow: '5 minutes'
        });
      }
    }

    // Check for specific patterns
    if (logEntry.message.toLowerCase().includes('unauthorized')) {
      this.logger.warn('Unauthorized access attempt', { 
        service: logEntry.service,
        userId: logEntry.userId,
        ipAddress: logEntry.ipAddress
      });
    }
  }

  private async checkSecurityAlerts(auditEntry: AuditLogEntry): Promise<void> {
    // Check for failed login attempts
    if (auditEntry.action === 'FAILED_LOGIN') {
      const recentFailedLogins = this.auditLogs.filter(audit => 
        audit.action === 'FAILED_LOGIN' &&
        audit.userId === auditEntry.userId &&
        audit.timestamp > new Date(Date.now() - 15 * 60 * 1000) // last 15 minutes
      );

      if (recentFailedLogins.length > 5) {
        this.logger.warn('Multiple failed login attempts', { 
          userId: auditEntry.userId,
          attemptCount: recentFailedLogins.length,
          timeWindow: '15 minutes'
        });
      }
    }

    // Check for permission changes
    if (auditEntry.action === 'PERMISSION_CHANGE' && auditEntry.riskLevel === 'HIGH') {
      this.logger.warn('High-risk permission change', { 
        userId: auditEntry.userId,
        details: auditEntry.details
      });
    }
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        // Check for sensitive data patterns
        const isSensitive = this.sensitiveDataPatterns.some(pattern => pattern.test(key));
        if (isSensitive) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private calculateRiskLevel(action: AuditAction, resource: string, details: Record<string, any>): RiskLevel {
    // Simple risk calculation based on action and resource
    const highRiskActions = ['DELETE', 'PERMISSION_CHANGE', 'CONFIG_CHANGE', 'SECURITY_EVENT'];
    const mediumRiskActions = ['UPDATE', 'DATA_EXPORT', 'DATA_IMPORT'];
    
    if (highRiskActions.includes(action)) {
      return 'HIGH';
    } else if (mediumRiskActions.includes(action)) {
      return 'MEDIUM';
    } else if (action === 'FAILED_LOGIN') {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private applyAggregation(logs: LogEntry[], operation: LogAggregation['operation'], field: string): number {
    switch (operation) {
      case 'count':
        return logs.length;
      case 'sum':
        return logs.reduce((sum, log) => {
          const value = this.extractFieldValue(log, field);
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
      case 'avg':
        const values = logs.map(log => this.extractFieldValue(log, field)).filter(v => typeof v === 'number');
        return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      case 'min':
        const numValues = logs.map(log => this.extractFieldValue(log, field)).filter(v => typeof v === 'number');
        return numValues.length > 0 ? Math.min(...numValues) : 0;
      case 'max':
        const maxValues = logs.map(log => this.extractFieldValue(log, field)).filter(v => typeof v === 'number');
        return maxValues.length > 0 ? Math.max(...maxValues) : 0;
      default:
        return 0;
    }
  }

  private extractFieldValue(log: LogEntry, field: string): any {
    switch (field) {
      case 'level':
        return log.level;
      case 'timestamp':
        return log.timestamp.getTime();
      default:
        return log.metadata?.[field];
    }
  }

  private convertToCSV(logs: LogEntry[]): string {
    const headers = [
      'id', 'timestamp', 'level', 'message', 'service', 'operation',
      'userId', 'sessionId', 'requestId', 'ipAddress', 'tags'
    ];

    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.level,
      log.message.replace(/"/g, '""'), // Escape quotes
      log.service,
      log.operation || '',
      log.userId || '',
      log.sessionId || '',
      log.requestId || '',
      log.ipAddress || '',
      log.tags?.join(';') || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  private convertToXML(logs: LogEntry[]): string {
    const xmlLogs = logs.map(log => `
    <log>
      <id>${log.id}</id>
      <timestamp>${log.timestamp.toISOString()}</timestamp>
      <level>${log.level}</level>
      <message><![CDATA[${log.message}]]></message>
      <service>${log.service}</service>
      <operation>${log.operation || ''}</operation>
      <userId>${log.userId || ''}</userId>
      <sessionId>${log.sessionId || ''}</sessionId>
      <requestId>${log.requestId || ''}</requestId>
      <ipAddress>${log.ipAddress || ''}</ipAddress>
      <tags>${log.tags?.join(',') || ''}</tags>
    </log>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<logs>${xmlLogs}
</logs>`;
  }

  private async compressData(data: string, compression: 'gzip' | 'zip'): Promise<string> {
    // In a real implementation, this would use zlib or similar
    // For now, return the data as-is
    return data;
  }

  private logToWinston(level: LogLevel, message: string, logEntry: LogEntry): void {
    const context = {
      service: logEntry.service,
      operation: logEntry.operation,
      userId: logEntry.userId,
      metadata: logEntry.metadata
    };

    switch (level) {
      case 'DEBUG':
        this.logger.debug(message, context);
        break;
      case 'INFO':
        this.logger.info(message, context);
        break;
      case 'WARN':
        this.logger.warn(message, context);
        break;
      case 'ERROR':
        this.logger.error(message, undefined, context);
        break;
      case 'CRITICAL':
        this.logger.error(`CRITICAL: ${message}`, undefined, context);
        break;
    }
  }

  private initializeRetentionPolicies(): void {
    // Default retention policies
    this.retentionPolicies.set('default', 30); // 30 days
    this.retentionPolicies.set('audit', 365); // 1 year
    this.retentionPolicies.set('security', 730); // 2 years
    this.retentionPolicies.set('integration', 90); // 3 months
  }

  private startPeriodicTasks(): void {
    // Clean up old logs every hour
    setInterval(() => {
      this.cleanupOldLogs();
    }, 60 * 60 * 1000);

    // Clean up old audit logs every day
    setInterval(() => {
      this.cleanupOldAuditLogs();
    }, 24 * 60 * 60 * 1000);

    // Generate log statistics every 6 hours
    setInterval(() => {
      this.generateLogStatistics();
    }, 6 * 60 * 60 * 1000);
  }

  private cleanupOldLogs(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [service, retentionDays] of this.retentionPolicies.entries()) {
      if (service === 'audit') continue; // Skip audit logs here
      
      const cutoffTime = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
      const beforeCount = this.logs.length;
      
      this.logs = this.logs.filter(log => {
        if (log.service === service) {
          return log.timestamp > cutoffTime;
        }
        return true;
      });
      
      cleanedCount += beforeCount - this.logs.length;
    }

    if (cleanedCount > 0) {
      this.logger.info('Old logs cleaned up', { cleanedCount });
    }
  }

  private cleanupOldAuditLogs(): void {
    const auditRetention = this.retentionPolicies.get('audit') || 365;
    const cutoffTime = new Date(Date.now() - auditRetention * 24 * 60 * 60 * 1000);
    const beforeCount = this.auditLogs.length;
    
    this.auditLogs = this.auditLogs.filter(audit => audit.timestamp > cutoffTime);
    
    const cleanedCount = beforeCount - this.auditLogs.length;
    if (cleanedCount > 0) {
      this.logger.info('Old audit logs cleaned up', { cleanedCount });
    }
  }

  private generateLogStatistics(): void {
    try {
      const stats = {
        totalLogs: this.logs.length,
        totalAudits: this.auditLogs.length,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Log statistics generated', stats);
    } catch (error) {
      this.logger.error('Error generating log statistics', { error });
    }
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}