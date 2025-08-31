"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComprehensiveLoggingService = void 0;
const logger_1 = require("../../utils/logger");
class ComprehensiveLoggingService {
    constructor() {
        this.logger = new logger_1.Logger('ComprehensiveLoggingService');
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
    async log(level, message, context) {
        try {
            const logEntry = {
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
            if (this.logs.length > 100000) {
                this.logs = this.logs.slice(-100000);
            }
            this.logToWinston(level, message, logEntry);
            await this.checkLogAlerts(logEntry);
        }
        catch (error) {
            this.logger.error('Error logging entry', { error, level, message, context });
        }
    }
    async debug(message, context) {
        await this.log('DEBUG', message, context);
    }
    async info(message, context) {
        await this.log('INFO', message, context);
    }
    async warn(message, context) {
        await this.log('WARN', message, context);
    }
    async error(message, context) {
        await this.log('ERROR', message, context);
    }
    async critical(message, context) {
        await this.log('CRITICAL', message, context);
    }
    async auditLog(action, resource, userId, context) {
        try {
            const auditEntry = {
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
            if (this.auditLogs.length > 50000) {
                this.auditLogs = this.auditLogs.slice(-50000);
            }
            await this.log('INFO', `Audit: ${action} ${resource}`, {
                service: 'audit',
                operation: action,
                userId,
                metadata: { auditEntryId: auditEntry.id, result: auditEntry.result }
            });
            await this.checkSecurityAlerts(auditEntry);
        }
        catch (error) {
            this.logger.error('Error logging audit entry', { error, action, resource, userId });
        }
    }
    async queryLogs(query) {
        try {
            let filteredLogs = [...this.logs];
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
                filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime);
            }
            if (query.endTime) {
                filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime);
            }
            if (query.tags && query.tags.length > 0) {
                filteredLogs = filteredLogs.filter(log => log.tags && query.tags.some(tag => log.tags.includes(tag)));
            }
            if (query.traceId) {
                filteredLogs = filteredLogs.filter(log => log.traceId === query.traceId);
            }
            filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            const offset = query.offset || 0;
            const limit = query.limit || 100;
            return filteredLogs.slice(offset, offset + limit);
        }
        catch (error) {
            this.logger.error('Error querying logs', { error, query });
            return [];
        }
    }
    async queryAuditLogs(query) {
        try {
            let filteredLogs = [...this.auditLogs];
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
                filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime);
            }
            if (query.endTime) {
                filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime);
            }
            if (query.result) {
                filteredLogs = filteredLogs.filter(log => log.result === query.result);
            }
            if (query.riskLevel) {
                filteredLogs = filteredLogs.filter(log => log.riskLevel === query.riskLevel);
            }
            filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            const offset = query.offset || 0;
            const limit = query.limit || 100;
            return filteredLogs.slice(offset, offset + limit);
        }
        catch (error) {
            this.logger.error('Error querying audit logs', { error, query });
            return [];
        }
    }
    async aggregateLogs(aggregation) {
        try {
            let filteredLogs = [...this.logs];
            if (aggregation.timeRange) {
                filteredLogs = filteredLogs.filter(log => log.timestamp >= aggregation.timeRange.start &&
                    log.timestamp <= aggregation.timeRange.end);
            }
            const results = {};
            if (aggregation.groupBy && aggregation.groupBy.length > 0) {
                const groups = new Map();
                filteredLogs.forEach(log => {
                    const key = aggregation.groupBy.map(field => {
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
                    groups.get(key).push(log);
                });
                groups.forEach((groupLogs, key) => {
                    results[key] = this.applyAggregation(groupLogs, aggregation.operation, aggregation.field);
                });
            }
            else {
                results['total'] = this.applyAggregation(filteredLogs, aggregation.operation, aggregation.field);
            }
            return results;
        }
        catch (error) {
            this.logger.error('Error aggregating logs', { error, aggregation });
            return {};
        }
    }
    async exportLogs(query, options) {
        try {
            const logs = await this.queryLogs(query);
            let exportData;
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
            if (options.compression) {
                exportData = await this.compressData(exportData, options.compression);
            }
            return exportData;
        }
        catch (error) {
            this.logger.error('Error exporting logs', { error, query, options });
            throw error;
        }
    }
    async getLogStats() {
        try {
            const logsByLevel = {
                DEBUG: 0,
                INFO: 0,
                WARN: 0,
                ERROR: 0,
                CRITICAL: 0
            };
            const logsByService = {};
            this.logs.forEach(log => {
                logsByLevel[log.level]++;
                logsByService[log.service] = (logsByService[log.service] || 0) + 1;
            });
            const recentErrors = this.logs
                .filter(log => log.level === 'ERROR' || log.level === 'CRITICAL')
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 10);
            const storageUsage = JSON.stringify(this.logs).length + JSON.stringify(this.auditLogs).length;
            return {
                totalLogs: this.logs.length,
                logsByLevel,
                logsByService,
                recentErrors,
                storageUsage
            };
        }
        catch (error) {
            this.logger.error('Error getting log stats', { error });
            throw error;
        }
    }
    async getAuditStats() {
        try {
            const auditsByAction = {
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
            const auditsByRiskLevel = {
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
        }
        catch (error) {
            this.logger.error('Error getting audit stats', { error });
            throw error;
        }
    }
    async setRetentionPolicy(service, retentionDays) {
        this.retentionPolicies.set(service, retentionDays);
        this.logger.info('Log retention policy set', { service, retentionDays });
    }
    async getRetentionPolicies() {
        return Object.fromEntries(this.retentionPolicies);
    }
    async checkLogAlerts(logEntry) {
        if (logEntry.level === 'ERROR' || logEntry.level === 'CRITICAL') {
            const recentErrors = this.logs.filter(log => (log.level === 'ERROR' || log.level === 'CRITICAL') &&
                log.service === logEntry.service &&
                log.timestamp > new Date(Date.now() - 5 * 60 * 1000));
            if (recentErrors.length > 10) {
                this.logger.warn('High error rate detected', {
                    service: logEntry.service,
                    errorCount: recentErrors.length,
                    timeWindow: '5 minutes'
                });
            }
        }
        if (logEntry.message.toLowerCase().includes('unauthorized')) {
            this.logger.warn('Unauthorized access attempt', {
                service: logEntry.service,
                userId: logEntry.userId,
                ipAddress: logEntry.ipAddress
            });
        }
    }
    async checkSecurityAlerts(auditEntry) {
        if (auditEntry.action === 'FAILED_LOGIN') {
            const recentFailedLogins = this.auditLogs.filter(audit => audit.action === 'FAILED_LOGIN' &&
                audit.userId === auditEntry.userId &&
                audit.timestamp > new Date(Date.now() - 15 * 60 * 1000));
            if (recentFailedLogins.length > 5) {
                this.logger.warn('Multiple failed login attempts', {
                    userId: auditEntry.userId,
                    attemptCount: recentFailedLogins.length,
                    timeWindow: '15 minutes'
                });
            }
        }
        if (auditEntry.action === 'PERMISSION_CHANGE' && auditEntry.riskLevel === 'HIGH') {
            this.logger.warn('High-risk permission change', {
                userId: auditEntry.userId,
                details: auditEntry.details
            });
        }
    }
    sanitizeMetadata(metadata) {
        if (!metadata)
            return undefined;
        const sanitized = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (typeof value === 'string') {
                const isSensitive = this.sensitiveDataPatterns.some(pattern => pattern.test(key));
                if (isSensitive) {
                    sanitized[key] = '[REDACTED]';
                }
                else {
                    sanitized[key] = value;
                }
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeMetadata(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    calculateRiskLevel(action, resource, details) {
        const highRiskActions = ['DELETE', 'PERMISSION_CHANGE', 'CONFIG_CHANGE', 'SECURITY_EVENT'];
        const mediumRiskActions = ['UPDATE', 'DATA_EXPORT', 'DATA_IMPORT'];
        if (highRiskActions.includes(action)) {
            return 'HIGH';
        }
        else if (mediumRiskActions.includes(action)) {
            return 'MEDIUM';
        }
        else if (action === 'FAILED_LOGIN') {
            return 'MEDIUM';
        }
        else {
            return 'LOW';
        }
    }
    applyAggregation(logs, operation, field) {
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
    extractFieldValue(log, field) {
        switch (field) {
            case 'level':
                return log.level;
            case 'timestamp':
                return log.timestamp.getTime();
            default:
                return log.metadata?.[field];
        }
    }
    convertToCSV(logs) {
        const headers = [
            'id', 'timestamp', 'level', 'message', 'service', 'operation',
            'userId', 'sessionId', 'requestId', 'ipAddress', 'tags'
        ];
        const rows = logs.map(log => [
            log.id,
            log.timestamp.toISOString(),
            log.level,
            log.message.replace(/"/g, '""'),
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
    convertToXML(logs) {
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
    async compressData(data, compression) {
        return data;
    }
    logToWinston(level, message, logEntry) {
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
    initializeRetentionPolicies() {
        this.retentionPolicies.set('default', 30);
        this.retentionPolicies.set('audit', 365);
        this.retentionPolicies.set('security', 730);
        this.retentionPolicies.set('integration', 90);
    }
    startPeriodicTasks() {
        setInterval(() => {
            this.cleanupOldLogs();
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.cleanupOldAuditLogs();
        }, 24 * 60 * 60 * 1000);
        setInterval(() => {
            this.generateLogStatistics();
        }, 6 * 60 * 60 * 1000);
    }
    cleanupOldLogs() {
        const now = new Date();
        let cleanedCount = 0;
        for (const [service, retentionDays] of this.retentionPolicies.entries()) {
            if (service === 'audit')
                continue;
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
    cleanupOldAuditLogs() {
        const auditRetention = this.retentionPolicies.get('audit') || 365;
        const cutoffTime = new Date(Date.now() - auditRetention * 24 * 60 * 60 * 1000);
        const beforeCount = this.auditLogs.length;
        this.auditLogs = this.auditLogs.filter(audit => audit.timestamp > cutoffTime);
        const cleanedCount = beforeCount - this.auditLogs.length;
        if (cleanedCount > 0) {
            this.logger.info('Old audit logs cleaned up', { cleanedCount });
        }
    }
    generateLogStatistics() {
        try {
            const stats = {
                totalLogs: this.logs.length,
                totalAudits: this.auditLogs.length,
                timestamp: new Date().toISOString()
            };
            this.logger.info('Log statistics generated', stats);
        }
        catch (error) {
            this.logger.error('Error generating log statistics', { error });
        }
    }
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateAuditId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ComprehensiveLoggingService = ComprehensiveLoggingService;
//# sourceMappingURL=ComprehensiveLoggingService.js.map