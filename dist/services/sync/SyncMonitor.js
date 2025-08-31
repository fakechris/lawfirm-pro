"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncMonitorImplementation = void 0;
const logger_1 = require("../integration/logger");
class SyncMonitorImplementation {
    constructor() {
        this.metrics = this.initializeMetrics();
        this.alerts = new Map();
        this.activeAlerts = new Map();
        this.syncHistory = [];
        this.conflictHistory = [];
        this.healthChecks = [];
        this.logger = new logger_1.IntegrationLoggerImplementation();
        this.startMonitoring();
    }
    async logSyncStart(jobId) {
        try {
            this.logger.info(`Sync job started`, { jobId });
            this.metrics.activeJobs++;
            await this.checkAlerts('sync_start', { jobId });
        }
        catch (error) {
            this.logger.error(`Failed to log sync start`, {
                jobId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async logSyncComplete(jobId, result) {
        try {
            this.logger.info(`Sync job completed`, {
                jobId,
                success: result.success,
                duration: result.duration,
                recordsProcessed: result.recordsProcessed
            });
            this.metrics.activeJobs--;
            if (result.success) {
                this.metrics.completedJobs++;
            }
            else {
                this.metrics.failedJobs++;
            }
            this.metrics.lastSyncTime = result.endTime;
            this.metrics.averageDuration = this.calculateAverageDuration(result.duration);
            if (result.recordsProcessed > 0) {
                const recordsPerSecond = (result.recordsProcessed / result.duration) * 1000;
                this.metrics.performance.recordsPerSecond =
                    (this.metrics.performance.recordsPerSecond + recordsPerSecond) / 2;
            }
            this.metrics.conflicts.total += result.conflicts.length;
            this.metrics.conflicts.pending += result.conflicts.filter(c => !c.resolution).length;
            this.syncHistory.push(result);
            if (this.syncHistory.length > 1000) {
                this.syncHistory = this.syncHistory.slice(-1000);
            }
            await this.checkAlerts('sync_complete', { jobId, result });
            await this.generateHealthCheck('sync_complete', result.success);
        }
        catch (error) {
            this.logger.error(`Failed to log sync complete`, {
                jobId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async logSyncError(jobId, error) {
        try {
            this.logger.error(`Sync job failed`, {
                jobId,
                error: error.message
            });
            this.metrics.activeJobs--;
            this.metrics.failedJobs++;
            const totalJobs = this.metrics.completedJobs + this.metrics.failedJobs;
            this.metrics.performance.errorRate = (this.metrics.failedJobs / totalJobs) * 100;
            await this.checkAlerts('sync_error', { jobId, error: error.message });
            await this.generateHealthCheck('sync_error', false);
        }
        catch (error) {
            this.logger.error(`Failed to log sync error`, {
                jobId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async logConflictDetected(conflict) {
        try {
            this.logger.warn(`Conflict detected`, {
                conflictId: conflict.id,
                field: conflict.field,
                severity: conflict.severity,
                type: conflict.type
            });
            this.conflictHistory.push(conflict);
            if (this.conflictHistory.length > 1000) {
                this.conflictHistory = this.conflictHistory.slice(-1000);
            }
            this.metrics.conflicts.total++;
            this.metrics.conflicts.pending++;
            await this.checkAlerts('conflict_detected', { conflict });
        }
        catch (error) {
            this.logger.error(`Failed to log conflict detected`, {
                conflictId: conflict.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async logConflictResolved(conflict, resolution) {
        try {
            this.logger.info(`Conflict resolved`, {
                conflictId: conflict.id,
                strategy: resolution.strategy,
                resolvedBy: resolution.resolvedBy
            });
            this.metrics.conflicts.pending--;
            this.metrics.conflicts.resolved++;
            const conflictIndex = this.conflictHistory.findIndex(c => c.id === conflict.id);
            if (conflictIndex !== -1) {
                this.conflictHistory[conflictIndex].resolution = resolution;
            }
            await this.checkAlerts('conflict_resolved', { conflict, resolution });
        }
        catch (error) {
            this.logger.error(`Failed to log conflict resolved`, {
                conflictId: conflict.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getMetrics() {
        return { ...this.metrics };
    }
    async getHealthStatus() {
        try {
            const checks = [...this.healthChecks];
            const oneHourAgo = new Date(Date.now() - 3600000);
            const recentChecks = checks.filter(check => check.timestamp > oneHourAgo);
            const allPassed = recentChecks.every(check => check.status === 'pass');
            const hasWarnings = recentChecks.some(check => check.status === 'warn');
            const hasFailures = recentChecks.some(check => check.status === 'fail');
            let status;
            if (allPassed) {
                status = 'healthy';
            }
            else if (hasFailures) {
                status = 'unhealthy';
            }
            else {
                status = 'degraded';
            }
            return {
                status,
                timestamp: new Date(),
                checks: recentChecks,
                metrics: await this.getMetrics()
            };
        }
        catch (error) {
            this.logger.error(`Failed to get health status`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async createAlert(config) {
        try {
            const alertId = this.generateAlertId();
            const alert = {
                id: alertId,
                name: config.name,
                type: config.type,
                severity: config.severity,
                triggeredAt: new Date(),
                status: 'active',
                message: `Alert created: ${config.name}`,
                data: { config }
            };
            this.alerts.set(alertId, config);
            this.activeAlerts.set(alertId, alert);
            this.logger.info(`Alert created`, {
                alertId,
                name: config.name,
                type: config.type,
                severity: config.severity
            });
            return alert;
        }
        catch (error) {
            this.logger.error(`Failed to create alert`, {
                name: config.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async checkAlerts() {
        try {
            const triggeredAlerts = [];
            for (const [alertId, config] of this.alerts.entries()) {
                if (!config.isActive)
                    continue;
                const shouldTrigger = await this.evaluateAlertCondition(config);
                if (shouldTrigger) {
                    let alert = this.activeAlerts.get(alertId);
                    if (!alert) {
                        alert = {
                            id: alertId,
                            name: config.name,
                            type: config.type,
                            severity: config.severity,
                            triggeredAt: new Date(),
                            status: 'active',
                            message: `Alert triggered: ${config.name}`,
                            data: {
                                triggeredBy: 'condition_check',
                                metrics: await this.getMetrics()
                            }
                        };
                        this.activeAlerts.set(alertId, alert);
                        triggeredAlerts.push(alert);
                        await this.executeAlertActions(alert, config);
                    }
                }
                else {
                    const existingAlert = this.activeAlerts.get(alertId);
                    if (existingAlert && existingAlert.status === 'active') {
                        await this.resolveAlert(alertId);
                    }
                }
            }
            return triggeredAlerts;
        }
        catch (error) {
            this.logger.error(`Failed to check alerts`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getSyncHistory(limit = 50) {
        return this.syncHistory.slice(-limit);
    }
    async getConflictHistory(limit = 50) {
        return this.conflictHistory.slice(-limit);
    }
    async getAlertHistory(limit = 50) {
        return Array.from(this.activeAlerts.values()).slice(-limit);
    }
    async getPerformanceReport(timeRange = '24h') {
        try {
            const now = new Date();
            const timeRangeMs = this.getTimeRangeMs(timeRange);
            const startTime = new Date(now.getTime() - timeRangeMs);
            const recentSyncs = this.syncHistory.filter(sync => sync.startTime > startTime);
            const recentConflicts = this.conflictHistory.filter(conflict => conflict.detectedAt > startTime);
            const report = {
                timeRange,
                startTime,
                endTime: now,
                totalSyncs: recentSyncs.length,
                successfulSyncs: recentSyncs.filter(s => s.success).length,
                failedSyncs: recentSyncs.filter(s => !s.success).length,
                averageSyncDuration: this.calculateAverageSyncDuration(recentSyncs),
                totalRecordsProcessed: recentSyncs.reduce((sum, sync) => sum + sync.recordsProcessed, 0),
                averageRecordsPerSecond: this.calculateAverageRecordsPerSecond(recentSyncs),
                totalConflicts: recentConflicts.length,
                resolvedConflicts: recentConflicts.filter(c => c.resolution).length,
                conflictResolutionRate: this.calculateConflictResolutionRate(recentConflicts),
                errorRate: this.calculateErrorRate(recentSyncs),
                topErrorTypes: this.getTopErrorTypes(recentSyncs),
                recommendations: await this.generatePerformanceRecommendations(recentSyncs, recentConflicts)
            };
            return report;
        }
        catch (error) {
            this.logger.error(`Failed to generate performance report`, {
                timeRange,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getSystemStatus() {
        try {
            const health = await this.getHealthStatus();
            const metrics = await this.getMetrics();
            const activeAlerts = Array.from(this.activeAlerts.values()).filter(a => a.status === 'active');
            return {
                overallStatus: this.calculateOverallStatus(health, activeAlerts),
                health,
                metrics,
                activeAlerts,
                lastUpdateTime: new Date(),
                uptime: this.calculateUptime(),
                version: '1.0.0'
            };
        }
        catch (error) {
            this.logger.error(`Failed to get system status`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkAlerts();
                await this.cleanupOldData();
            }
            catch (error) {
                this.logger.error(`Monitoring interval failed`, {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }, 60000);
    }
    async checkAlerts(eventType, data) {
        try {
            for (const [alertId, config] of this.alerts.entries()) {
                if (!config.isActive)
                    continue;
                const shouldTrigger = await this.evaluateAlertCondition(config, eventType, data);
                if (shouldTrigger) {
                    let alert = this.activeAlerts.get(alertId);
                    if (!alert) {
                        alert = {
                            id: alertId,
                            name: config.name,
                            type: config.type,
                            severity: config.severity,
                            triggeredAt: new Date(),
                            status: 'active',
                            message: `Alert triggered by ${eventType}: ${config.name}`,
                            data: { eventType, ...data }
                        };
                        this.activeAlerts.set(alertId, alert);
                        await this.executeAlertActions(alert, config);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to check alerts for event`, {
                eventType,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async evaluateAlertCondition(config, eventType, data) {
        try {
            const metrics = await this.getMetrics();
            switch (config.type) {
                case 'sync_failure':
                    const failureRate = metrics.failedJobs / Math.max(1, metrics.completedJobs + metrics.failedJobs);
                    return failureRate > (config.condition.value / 100);
                case 'conflict_threshold':
                    return metrics.conflicts.pending > config.condition.value;
                case 'performance_degradation':
                    return metrics.performance.recordsPerSecond < config.condition.value;
                case 'data_integrity':
                    const recentIssues = this.conflictHistory.filter(c => c.detectedAt > new Date(Date.now() - 3600000));
                    return recentIssues.length > config.condition.value;
                default:
                    return false;
            }
        }
        catch (error) {
            this.logger.error(`Failed to evaluate alert condition`, {
                alertType: config.type,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async executeAlertActions(alert, config) {
        try {
            this.logger.info(`Executing alert actions`, {
                alertId: alert.id,
                actionsCount: config.actions.length
            });
            for (const action of config.actions) {
                try {
                    switch (action.type) {
                        case 'email':
                            await this.sendEmailAlert(alert, action.config);
                            break;
                        case 'webhook':
                            await this.sendWebhookAlert(alert, action.config);
                            break;
                        case 'log':
                            this.logger.warn(`Alert: ${alert.message}`, alert.data);
                            break;
                        case 'notification':
                            await this.sendNotification(alert, action.config);
                            break;
                        default:
                            this.logger.warn(`Unknown alert action type: ${action.type}`);
                    }
                }
                catch (error) {
                    this.logger.error(`Failed to execute alert action`, {
                        alertId: alert.id,
                        actionType: action.type,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to execute alert actions`, {
                alertId: alert.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async sendEmailAlert(alert, config) {
        this.logger.info(`Email alert would be sent`, {
            to: config.to,
            subject: `Alert: ${alert.name}`,
            message: alert.message
        });
    }
    async sendWebhookAlert(alert, config) {
        this.logger.info(`Webhook alert would be sent`, {
            url: config.url,
            payload: {
                alert,
                timestamp: new Date()
            }
        });
    }
    async sendNotification(alert, config) {
        this.logger.info(`Notification would be sent`, {
            channel: config.channel,
            message: alert.message
        });
    }
    async resolveAlert(alertId) {
        try {
            const alert = this.activeAlerts.get(alertId);
            if (alert) {
                alert.status = 'resolved';
                alert.resolvedAt = new Date();
                this.logger.info(`Alert resolved`, {
                    alertId,
                    name: alert.name
                });
            }
        }
        catch (error) {
            this.logger.error(`Failed to resolve alert`, {
                alertId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async generateHealthCheck(type, success) {
        try {
            const check = {
                name: type,
                status: success ? 'pass' : 'fail',
                timestamp: new Date(),
                duration: 0
            };
            this.healthChecks.push(check);
            if (this.healthChecks.length > 100) {
                this.healthChecks = this.healthChecks.slice(-100);
            }
        }
        catch (error) {
            this.logger.error(`Failed to generate health check`, {
                type,
                success,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async cleanupOldData() {
        try {
            const oneDayAgo = new Date(Date.now() - 86400000);
            this.syncHistory = this.syncHistory.filter(sync => sync.startTime > oneDayAgo);
            this.conflictHistory = this.conflictHistory.filter(conflict => conflict.detectedAt > oneDayAgo);
            this.healthChecks = this.healthChecks.filter(check => check.timestamp > oneDayAgo);
            const sevenDaysAgo = new Date(Date.now() - 604800000);
            for (const [alertId, alert] of this.activeAlerts.entries()) {
                if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < sevenDaysAgo) {
                    this.activeAlerts.delete(alertId);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to cleanup old data`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    calculateAverageDuration(newDuration) {
        if (this.metrics.averageDuration === 0) {
            return newDuration;
        }
        return (this.metrics.averageDuration + newDuration) / 2;
    }
    calculateAverageSyncDuration(syncs) {
        if (syncs.length === 0)
            return 0;
        const total = syncs.reduce((sum, sync) => sum + sync.duration, 0);
        return total / syncs.length;
    }
    calculateAverageRecordsPerSecond(syncs) {
        if (syncs.length === 0)
            return 0;
        const totalRecords = syncs.reduce((sum, sync) => sum + sync.recordsProcessed, 0);
        const totalTime = syncs.reduce((sum, sync) => sum + sync.duration, 0);
        return totalTime > 0 ? (totalRecords / totalTime) * 1000 : 0;
    }
    calculateConflictResolutionRate(conflicts) {
        if (conflicts.length === 0)
            return 100;
        const resolved = conflicts.filter(c => c.resolution).length;
        return (resolved / conflicts.length) * 100;
    }
    calculateErrorRate(syncs) {
        if (syncs.length === 0)
            return 0;
        const failed = syncs.filter(s => !s.success).length;
        return (failed / syncs.length) * 100;
    }
    getTopErrorTypes(syncs) {
        const errorTypes = new Map();
        for (const sync of syncs) {
            if (!sync.success && sync.error) {
                const errorType = sync.error.split(':')[0];
                errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
            }
        }
        return Array.from(errorTypes.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }
    async generatePerformanceRecommendations(syncs, conflicts) {
        const recommendations = [];
        if (syncs.length > 0) {
            const avgDuration = this.calculateAverageSyncDuration(syncs);
            const errorRate = this.calculateErrorRate(syncs);
            if (avgDuration > 10000) {
                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    title: 'High sync duration detected',
                    description: `Average sync duration is ${avgDuration}ms, consider optimizing sync operations`,
                    action: 'Review sync batch sizes and consider parallel processing'
                });
            }
            if (errorRate > 10) {
                recommendations.push({
                    type: 'reliability',
                    priority: 'high',
                    title: 'High error rate detected',
                    description: `Sync error rate is ${errorRate.toFixed(1)}%, investigate and fix common errors`,
                    action: 'Review error logs and implement better error handling'
                });
            }
        }
        if (conflicts.length > 0) {
            const resolutionRate = this.calculateConflictResolutionRate(conflicts);
            if (resolutionRate < 80) {
                recommendations.push({
                    type: 'data_quality',
                    priority: 'medium',
                    title: 'Low conflict resolution rate',
                    description: `Only ${resolutionRate.toFixed(1)}% of conflicts are being resolved automatically`,
                    action: 'Review conflict resolution strategies and improve automation'
                });
            }
        }
        return recommendations;
    }
    getTimeRangeMs(timeRange) {
        switch (timeRange) {
            case '1h': return 3600000;
            case '24h': return 86400000;
            case '7d': return 604800000;
            case '30d': return 2592000000;
            default: return 86400000;
        }
    }
    calculateOverallStatus(health, activeAlerts) {
        if (health.status === 'unhealthy' || activeAlerts.some(a => a.severity === 'critical')) {
            return 'unhealthy';
        }
        else if (health.status === 'degraded' || activeAlerts.some(a => a.severity === 'high')) {
            return 'degraded';
        }
        else {
            return 'healthy';
        }
    }
    calculateUptime() {
        return Date.now() - (this.healthChecks[0]?.timestamp?.getTime() || Date.now());
    }
    initializeMetrics() {
        return {
            totalJobs: 0,
            activeJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            averageDuration: 0,
            lastSyncTime: undefined,
            dataSources: 0,
            dataTargets: 0,
            conflicts: {
                total: 0,
                resolved: 0,
                pending: 0
            },
            performance: {
                recordsPerSecond: 0,
                averageResponseTime: 0,
                errorRate: 0
            }
        };
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async destroy() {
        try {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = undefined;
            }
            this.logger.info(`Sync monitor destroyed`);
        }
        catch (error) {
            this.logger.error(`Failed to destroy sync monitor`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
}
exports.SyncMonitorImplementation = SyncMonitorImplementation;
//# sourceMappingURL=SyncMonitor.js.map