"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationMonitor = void 0;
const logger_1 = require("../../utils/logger");
class IntegrationMonitor {
    constructor() {
        this.logger = new logger_1.Logger('IntegrationMonitor');
        this.metrics = [];
        this.events = [];
        this.healthChecks = new Map();
        this.alerts = [];
        this.serviceMetrics = new Map();
        this.startTime = new Date();
        this.initializeMetrics();
        this.startPeriodicTasks();
    }
    recordMetric(metric) {
        try {
            this.metrics.push(metric);
            this.updateServiceMetrics(metric);
            if (this.metrics.length > 10000) {
                this.metrics = this.metrics.slice(-10000);
            }
            this.logger.debug('Metric recorded', { metric });
        }
        catch (error) {
            this.logger.error('Error recording metric', { error, metric });
        }
    }
    async performHealthCheck(service) {
        try {
            this.logger.info('Performing health check', { service });
            const startTime = Date.now();
            let healthy = false;
            let error;
            let details = {};
            try {
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
                if (Math.random() < 0.05) {
                    throw new Error('Service unavailable');
                }
                healthy = true;
                details = {
                    version: '1.0.0',
                    environment: 'production',
                    lastRequest: new Date().toISOString()
                };
            }
            catch (checkError) {
                healthy = false;
                error = checkError instanceof Error ? checkError.message : 'Unknown error';
            }
            const result = {
                service,
                healthy,
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
                error,
                details
            };
            this.healthChecks.set(service, result);
            this.logEvent({
                id: this.generateEventId(),
                type: 'HEALTH_CHECK',
                service,
                operation: 'health',
                timestamp: new Date(),
                data: { healthy, responseTime: result.responseTime },
                severity: healthy ? 'INFO' : 'ERROR'
            });
            await this.checkHealthAlerts(result);
            return result;
        }
        catch (error) {
            this.logger.error('Error performing health check', { error, service });
            throw error;
        }
    }
    logEvent(event) {
        try {
            this.events.push(event);
            if (this.events.length > 5000) {
                this.events = this.events.slice(-5000);
            }
            switch (event.severity) {
                case 'CRITICAL':
                case 'ERROR':
                    this.logger.error(event.type, { event });
                    break;
                case 'WARNING':
                    this.logger.warn(event.type, { event });
                    break;
                case 'INFO':
                    this.logger.info(event.type, { event });
                    break;
            }
            this.checkEventAlerts(event);
        }
        catch (error) {
            this.logger.error('Error logging event', { error, event });
        }
    }
    async checkAlerts() {
        try {
            const activeAlerts = this.alerts.filter(alert => !alert.resolved);
            const newAlerts = [];
            await this.checkErrorRateAlerts(newAlerts);
            await this.checkPerformanceAlerts(newAlerts);
            await this.checkAvailabilityAlerts(newAlerts);
            newAlerts.forEach(alert => {
                if (!this.alerts.find(existing => existing.id === alert.id)) {
                    this.alerts.push(alert);
                    this.logger.warn('New alert created', { alert });
                }
            });
            return [...activeAlerts, ...newAlerts];
        }
        catch (error) {
            this.logger.error('Error checking alerts', { error });
            return [];
        }
    }
    async generateReport(type, period) {
        try {
            this.logger.info('Generating report', { type, period });
            const endTime = new Date();
            const startTime = this.getPeriodStartTime(endTime, period);
            const report = {
                id: this.generateReportId(),
                type,
                period,
                generatedAt: new Date(),
                data: {},
                summary: ''
            };
            switch (type) {
                case 'PERFORMANCE':
                    report.data = await this.generatePerformanceReport(startTime, endTime);
                    report.summary = this.generatePerformanceSummary(report.data);
                    break;
                case 'ERROR':
                    report.data = await this.generateErrorReport(startTime, endTime);
                    report.summary = this.generateErrorSummary(report.data);
                    break;
                case 'USAGE':
                    report.data = await this.generateUsageReport(startTime, endTime);
                    report.summary = this.generateUsageSummary(report.data);
                    break;
                case 'SECURITY':
                    report.data = await this.generateSecurityReport(startTime, endTime);
                    report.summary = this.generateSecuritySummary(report.data);
                    break;
            }
            this.logger.info('Report generated', { reportId: report.id, type, period });
            return report;
        }
        catch (error) {
            this.logger.error('Error generating report', { error, type, period });
            throw error;
        }
    }
    async getSystemHealth() {
        try {
            const services = Array.from(this.healthChecks.keys());
            const healthResults = [];
            for (const service of services) {
                const result = await this.performHealthCheck(service);
                healthResults.push(result);
            }
            const overall = healthResults.every(result => result.healthy);
            const metrics = this.calculateSystemMetrics();
            return {
                overall,
                services: healthResults,
                timestamp: new Date(),
                uptime: Date.now() - this.startTime.getTime(),
                metrics
            };
        }
        catch (error) {
            this.logger.error('Error getting system health', { error });
            throw error;
        }
    }
    initializeMetrics() {
        const services = ['pacer', 'stripe', 'paypal', 'lexisnexis', 'westlaw'];
        services.forEach(service => {
            this.serviceMetrics.set(service, {
                requestCount: 0,
                errorCount: 0,
                averageResponseTime: 0,
                lastRequestTime: new Date(),
                uptime: 0
            });
        });
    }
    startPeriodicTasks() {
        setInterval(async () => {
            const services = Array.from(this.healthChecks.keys());
            for (const service of services) {
                try {
                    await this.performHealthCheck(service);
                }
                catch (error) {
                    this.logger.error('Error in periodic health check', { error, service });
                }
            }
        }, 30000);
        setInterval(async () => {
            try {
                await this.checkAlerts();
            }
            catch (error) {
                this.logger.error('Error in periodic alert check', { error });
            }
        }, 60000);
        setInterval(() => {
            this.cleanupOldData();
        }, 3600000);
    }
    updateServiceMetrics(metric) {
        const service = metric.tags.service;
        if (!service)
            return;
        const serviceMetrics = this.serviceMetrics.get(service);
        if (!serviceMetrics)
            return;
        serviceMetrics.requestCount++;
        serviceMetrics.lastRequestTime = metric.timestamp;
        if (metric.name === 'response_time') {
            const currentAvg = serviceMetrics.averageResponseTime;
            const currentCount = serviceMetrics.requestCount - 1;
            serviceMetrics.averageResponseTime =
                (currentAvg * currentCount + metric.value) / serviceMetrics.requestCount;
        }
        if (metric.name === 'error_count') {
            serviceMetrics.errorCount++;
        }
        this.serviceMetrics.set(service, serviceMetrics);
    }
    async checkHealthAlerts(result) {
        if (!result.healthy) {
            const alert = {
                id: this.generateAlertId(),
                type: 'AVAILABILITY',
                severity: 'CRITICAL',
                service: result.service,
                message: `Service ${result.service} is unhealthy: ${result.error}`,
                timestamp: new Date(),
                resolved: false,
                metadata: {
                    responseTime: result.responseTime,
                    error: result.error
                }
            };
            if (!this.alerts.find(existing => existing.id === alert.id)) {
                this.alerts.push(alert);
                this.logger.warn('Health alert created', { alert });
            }
        }
    }
    checkEventAlerts(event) {
        if (event.severity === 'CRITICAL' || event.severity === 'ERROR') {
            const alert = {
                id: this.generateAlertId(),
                type: 'ERROR_RATE',
                severity: event.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                service: event.service,
                message: `Critical error in ${event.service}: ${event.type}`,
                timestamp: event.timestamp,
                resolved: false,
                metadata: {
                    eventType: event.type,
                    operation: event.operation,
                    userId: event.userId
                }
            };
            if (!this.alerts.find(existing => existing.id === alert.id)) {
                this.alerts.push(alert);
                this.logger.warn('Event alert created', { alert });
            }
        }
    }
    async checkErrorRateAlerts(newAlerts) {
        for (const [service, metrics] of this.serviceMetrics.entries()) {
            if (metrics.requestCount > 0) {
                const errorRate = metrics.errorCount / metrics.requestCount;
                if (errorRate > 0.1) {
                    const alert = {
                        id: this.generateAlertId(),
                        type: 'ERROR_RATE',
                        severity: errorRate > 0.2 ? 'CRITICAL' : 'HIGH',
                        service,
                        message: `High error rate for ${service}: ${(errorRate * 100).toFixed(1)}%`,
                        timestamp: new Date(),
                        resolved: false,
                        metadata: {
                            errorRate,
                            requestCount: metrics.requestCount,
                            errorCount: metrics.errorCount
                        }
                    };
                    if (!this.alerts.find(existing => existing.id === alert.id)) {
                        newAlerts.push(alert);
                    }
                }
            }
        }
    }
    async checkPerformanceAlerts(newAlerts) {
        for (const [service, metrics] of this.serviceMetrics.entries()) {
            if (metrics.averageResponseTime > 5000) {
                const alert = {
                    id: this.generateAlertId(),
                    type: 'PERFORMANCE',
                    severity: metrics.averageResponseTime > 10000 ? 'HIGH' : 'MEDIUM',
                    service,
                    message: `Slow response time for ${service}: ${metrics.averageResponseTime.toFixed(0)}ms`,
                    timestamp: new Date(),
                    resolved: false,
                    metadata: {
                        averageResponseTime: metrics.averageResponseTime,
                        requestCount: metrics.requestCount
                    }
                };
                if (!this.alerts.find(existing => existing.id === alert.id)) {
                    newAlerts.push(alert);
                }
            }
        }
    }
    async checkAvailabilityAlerts(newAlerts) {
        for (const [service, healthCheck] of this.healthChecks.entries()) {
            if (!healthCheck.healthy) {
                const timeSinceLastCheck = Date.now() - healthCheck.lastChecked.getTime();
                if (timeSinceLastCheck > 300000) {
                    const alert = {
                        id: this.generateAlertId(),
                        type: 'AVAILABILITY',
                        severity: 'CRITICAL',
                        service,
                        message: `Service ${service} has been unavailable for ${Math.floor(timeSinceLastCheck / 60000)} minutes`,
                        timestamp: new Date(),
                        resolved: false,
                        metadata: {
                            lastHealthyCheck: healthCheck.lastChecked,
                            error: healthCheck.error
                        }
                    };
                    if (!this.alerts.find(existing => existing.id === alert.id)) {
                        newAlerts.push(alert);
                    }
                }
            }
        }
    }
    calculateSystemMetrics() {
        const totalRequests = Array.from(this.serviceMetrics.values())
            .reduce((sum, metrics) => sum + metrics.requestCount, 0);
        const successfulRequests = totalRequests - Array.from(this.serviceMetrics.values())
            .reduce((sum, metrics) => sum + metrics.errorCount, 0);
        const failedRequests = totalRequests - successfulRequests;
        const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
        const averageResponseTime = Array.from(this.serviceMetrics.values())
            .reduce((sum, metrics) => sum + metrics.averageResponseTime, 0) / this.serviceMetrics.size;
        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            averageResponseTime,
            errorRate,
            activeConnections: this.serviceMetrics.size
        };
    }
    async generatePerformanceReport(startTime, endTime) {
        const serviceMetrics = Array.from(this.serviceMetrics.entries()).map(([service, metrics]) => ({
            service,
            ...metrics
        }));
        return {
            period: {
                start: startTime,
                end: endTime
            },
            services: serviceMetrics,
            system: this.calculateSystemMetrics()
        };
    }
    async generateErrorReport(startTime, endTime) {
        const errorEvents = this.events.filter(event => event.type === 'ERROR' &&
            event.timestamp >= startTime &&
            event.timestamp <= endTime);
        return {
            period: {
                start: startTime,
                end: endTime
            },
            totalErrors: errorEvents.length,
            errorsByService: this.groupErrorsByService(errorEvents),
            errorsByType: this.groupErrorsByType(errorEvents),
            recentErrors: errorEvents.slice(-10)
        };
    }
    async generateUsageReport(startTime, endTime) {
        const requestEvents = this.events.filter(event => event.type === 'REQUEST' &&
            event.timestamp >= startTime &&
            event.timestamp <= endTime);
        return {
            period: {
                start: startTime,
                end: endTime
            },
            totalRequests: requestEvents.length,
            requestsByService: this.groupRequestsByService(requestEvents),
            requestsByOperation: this.groupRequestsByOperation(requestEvents),
            topUsers: this.getTopUsers(requestEvents)
        };
    }
    async generateSecurityReport(startTime, endTime) {
        const securityEvents = this.events.filter(event => (event.type === 'ERROR' || event.severity === 'CRITICAL') &&
            event.timestamp >= startTime &&
            event.timestamp <= endTime);
        return {
            period: {
                start: startTime,
                end: endTime
            },
            securityEvents: securityEvents.length,
            eventsByType: this.groupEventsByType(securityEvents),
            eventsByService: this.groupEventsByService(securityEvents),
            recommendations: this.generateSecurityRecommendations(securityEvents)
        };
    }
    generatePerformanceSummary(data) {
        const avgResponseTime = data.system.averageResponseTime;
        const errorRate = data.system.errorRate;
        return `System performance: ${avgResponseTime.toFixed(0)}ms avg response time, ${(errorRate * 100).toFixed(1)}% error rate`;
    }
    generateErrorSummary(data) {
        return `${data.totalErrors} errors detected across ${Object.keys(data.errorsByService).length} services`;
    }
    generateUsageSummary(data) {
        return `${data.totalRequests} total requests with ${Object.keys(data.requestsByService).length} active services`;
    }
    generateSecuritySummary(data) {
        return `${data.securityEvents} security events detected with ${data.recommendations.length} recommendations`;
    }
    generateSecurityRecommendations(events) {
        const recommendations = [];
        if (events.length > 10) {
            recommendations.push('Consider implementing additional security monitoring');
        }
        const criticalEvents = events.filter(e => e.severity === 'CRITICAL');
        if (criticalEvents.length > 0) {
            recommendations.push('Immediate attention required for critical security events');
        }
        return recommendations;
    }
    groupErrorsByService(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.service] = (grouped[event.service] || 0) + 1;
        });
        return grouped;
    }
    groupErrorsByType(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.operation] = (grouped[event.operation] || 0) + 1;
        });
        return grouped;
    }
    groupRequestsByService(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.service] = (grouped[event.service] || 0) + 1;
        });
        return grouped;
    }
    groupRequestsByOperation(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.operation] = (grouped[event.operation] || 0) + 1;
        });
        return grouped;
    }
    groupEventsByType(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.type] = (grouped[event.type] || 0) + 1;
        });
        return grouped;
    }
    groupEventsByService(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.service] = (grouped[event.service] || 0) + 1;
        });
        return grouped;
    }
    getTopUsers(events) {
        const userCounts = {};
        events.forEach(event => {
            if (event.userId) {
                userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
            }
        });
        return Object.entries(userCounts)
            .map(([userId, requestCount]) => ({ userId, requestCount }))
            .sort((a, b) => b.requestCount - a.requestCount)
            .slice(0, 10);
    }
    getPeriodStartTime(endTime, period) {
        const startTime = new Date(endTime);
        switch (period) {
            case 'HOURLY':
                startTime.setHours(startTime.getHours() - 1);
                break;
            case 'DAILY':
                startTime.setDate(startTime.getDate() - 1);
                break;
            case 'WEEKLY':
                startTime.setDate(startTime.getDate() - 7);
                break;
            case 'MONTHLY':
                startTime.setMonth(startTime.getMonth() - 1);
                break;
        }
        return startTime;
    }
    cleanupOldData() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);
        const eventCutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        this.events = this.events.filter(event => event.timestamp > eventCutoffTime);
        const alertCutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(alert => !alert.resolved || alert.resolvedAt === undefined || alert.resolvedAt > alertCutoffTime);
    }
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.IntegrationMonitor = IntegrationMonitor;
//# sourceMappingURL=IntegrationMonitor.js.map