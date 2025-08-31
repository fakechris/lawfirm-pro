"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
const logger_1 = require("../../utils/logger");
class MetricsCollector {
    constructor() {
        this.logger = new logger_1.Logger('MetricsCollector');
        this.metrics = [];
        this.aggregations = new Map();
        this.serviceMetrics = new Map();
        this.startTime = new Date();
        this.initializeServiceMetrics();
        this.startPeriodicTasks();
    }
    recordCounter(name, value = 1, tags = {}, metadata) {
        try {
            const metric = {
                name,
                value,
                timestamp: new Date(),
                tags,
                metadata
            };
            this.metrics.push(metric);
            this.updateServiceMetrics(metric);
            if (this.metrics.length > 50000) {
                this.metrics = this.metrics.slice(-50000);
            }
            this.logger.debug('Counter metric recorded', { metric });
        }
        catch (error) {
            this.logger.error('Error recording counter metric', { error, name, value, tags });
        }
    }
    recordGauge(name, value, tags = {}, metadata) {
        try {
            const metric = {
                name,
                value,
                timestamp: new Date(),
                tags,
                metadata
            };
            this.metrics.push(metric);
            if (this.metrics.length > 50000) {
                this.metrics = this.metrics.slice(-50000);
            }
            this.logger.debug('Gauge metric recorded', { metric });
        }
        catch (error) {
            this.logger.error('Error recording gauge metric', { error, name, value, tags });
        }
    }
    recordTiming(name, value, tags = {}, metadata) {
        try {
            const metric = {
                name,
                value,
                timestamp: new Date(),
                tags,
                metadata
            };
            this.metrics.push(metric);
            this.updateServiceMetrics(metric);
            if (this.metrics.length > 50000) {
                this.metrics = this.metrics.slice(-50000);
            }
            this.logger.debug('Timing metric recorded', { metric });
        }
        catch (error) {
            this.logger.error('Error recording timing metric', { error, name, value, tags });
        }
    }
    incrementCounter(name, value = 1, tags = {}, metadata) {
        this.recordCounter(name, value, tags, metadata);
    }
    async queryMetrics(query) {
        try {
            let filteredMetrics = [...this.metrics];
            if (query.name) {
                filteredMetrics = filteredMetrics.filter(m => m.name === query.name);
            }
            if (query.tags) {
                filteredMetrics = filteredMetrics.filter(m => {
                    return Object.entries(query.tags).every(([key, value]) => m.tags[key] === value);
                });
            }
            if (query.startTime) {
                filteredMetrics = filteredMetrics.filter(m => m.timestamp >= query.startTime);
            }
            if (query.endTime) {
                filteredMetrics = filteredMetrics.filter(m => m.timestamp <= query.endTime);
            }
            if (query.aggregation) {
                return this.aggregateMetrics(filteredMetrics, query.aggregation);
            }
            return filteredMetrics;
        }
        catch (error) {
            this.logger.error('Error querying metrics', { error, query });
            return [];
        }
    }
    async getServiceMetrics(serviceName) {
        return this.serviceMetrics.get(serviceName) || null;
    }
    async getAllServiceMetrics() {
        return Array.from(this.serviceMetrics.values());
    }
    async getSystemMetrics() {
        try {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const serviceMetrics = Array.from(this.serviceMetrics.values());
            const totalRequests = serviceMetrics.reduce((sum, m) => sum + m.requestCount, 0);
            const successfulRequests = totalRequests - serviceMetrics.reduce((sum, m) => sum + m.errorCount, 0);
            const failedRequests = totalRequests - successfulRequests;
            const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
            const avgResponseTime = serviceMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / serviceMetrics.length || 0;
            return {
                totalRequests,
                successfulRequests,
                failedRequests,
                averageResponseTime: avgResponseTime,
                errorRate,
                activeConnections: serviceMetrics.length,
                memoryUsage: memUsage,
                cpuUsage,
                uptime: Date.now() - this.startTime.getTime()
            };
        }
        catch (error) {
            this.logger.error('Error getting system metrics', { error });
            throw error;
        }
    }
    async createAggregation(aggregation) {
        const key = this.getAggregationKey(aggregation);
        this.aggregations.set(key, aggregation);
        this.logger.info('Metric aggregation created', { aggregation });
    }
    async removeAggregation(name, tags) {
        const key = this.getAggregationKey({ name, type: 'sum', period: 0, tags });
        this.aggregations.delete(key);
        this.logger.info('Metric aggregation removed', { name, tags });
    }
    async getAggregations() {
        return Array.from(this.aggregations.values());
    }
    async getTopMetrics(limit = 10) {
        const metricCounts = new Map();
        this.metrics.forEach(metric => {
            const count = metricCounts.get(metric.name) || 0;
            metricCounts.set(metric.name, count + 1);
        });
        return Array.from(metricCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    async getMetricsByTimeRange(startTime, endTime, interval = 3600) {
        try {
            const timeBuckets = new Map();
            this.metrics.forEach(metric => {
                if (metric.timestamp >= startTime && metric.timestamp <= endTime) {
                    const bucketKey = this.getTimeBucketKey(metric.timestamp, interval);
                    if (!timeBuckets.has(bucketKey)) {
                        timeBuckets.set(bucketKey, []);
                    }
                    timeBuckets.get(bucketKey).push(metric);
                }
            });
            return Array.from(timeBuckets.entries())
                .map(([bucketKey, metrics]) => ({
                time: new Date(parseInt(bucketKey) * 1000),
                metrics
            }))
                .sort((a, b) => a.time.getTime() - b.time.getTime());
        }
        catch (error) {
            this.logger.error('Error getting metrics by time range', { error, startTime, endTime });
            return [];
        }
    }
    initializeServiceMetrics() {
        const services = [
            'pacer', 'stripe', 'paypal', 'lexisnexis', 'westlaw',
            'google_drive', 'dropbox', 'twilio', 'sendgrid'
        ];
        services.forEach(service => {
            this.serviceMetrics.set(service, {
                serviceName: service,
                requestCount: 0,
                errorCount: 0,
                averageResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                throughput: 0,
                errorRate: 0,
                lastRequestTime: new Date(),
                uptime: 0
            });
        });
    }
    startPeriodicTasks() {
        setInterval(() => {
            this.updateSystemMetrics();
        }, 60000);
        setInterval(() => {
            this.calculatePercentiles();
        }, 300000);
        setInterval(() => {
            this.cleanupOldMetrics();
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
        serviceMetrics.errorRate = serviceMetrics.requestCount > 0
            ? serviceMetrics.errorCount / serviceMetrics.requestCount
            : 0;
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentRequests = this.metrics.filter(m => m.tags.service === service &&
            m.timestamp > oneMinuteAgo &&
            (m.name === 'request_count' || m.name === 'response_time')).length;
        serviceMetrics.throughput = recentRequests / 60;
        this.serviceMetrics.set(service, serviceMetrics);
    }
    updateSystemMetrics() {
        const uptime = Date.now() - this.startTime.getTime();
        this.serviceMetrics.forEach(metrics => {
            metrics.uptime = uptime;
        });
    }
    calculatePercentiles() {
        this.serviceMetrics.forEach(serviceMetrics => {
            const responseTimes = this.metrics
                .filter(m => m.tags.service === serviceMetrics.serviceName && m.name === 'response_time')
                .map(m => m.value)
                .sort((a, b) => a - b);
            if (responseTimes.length > 0) {
                const p95Index = Math.floor(responseTimes.length * 0.95);
                const p99Index = Math.floor(responseTimes.length * 0.99);
                serviceMetrics.p95ResponseTime = responseTimes[p95Index] || 0;
                serviceMetrics.p99ResponseTime = responseTimes[p99Index] || 0;
            }
        });
    }
    cleanupOldMetrics() {
        const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);
        this.logger.info('Old metrics cleaned up', {
            remainingMetrics: this.metrics.length,
            cutoffTime
        });
    }
    aggregateMetrics(metrics, aggregation) {
        const grouped = new Map();
        metrics.forEach(metric => {
            const key = this.getAggregationKey({ ...aggregation, name: metric.name });
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(metric);
        });
        return Array.from(grouped.entries()).map(([key, groupMetrics]) => {
            const aggregatedValue = this.calculateAggregation(groupMetrics, aggregation.type);
            return {
                name: aggregation.name,
                value: aggregatedValue,
                timestamp: new Date(),
                tags: aggregation.tags,
                metadata: {
                    aggregation: aggregation.type,
                    period: aggregation.period,
                    count: groupMetrics.length
                }
            };
        });
    }
    calculateAggregation(metrics, type) {
        switch (type) {
            case 'sum':
                return metrics.reduce((sum, m) => sum + m.value, 0);
            case 'avg':
                return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
            case 'min':
                return Math.min(...metrics.map(m => m.value));
            case 'max':
                return Math.max(...metrics.map(m => m.value));
            case 'count':
                return metrics.length;
            default:
                return 0;
        }
    }
    getAggregationKey(aggregation) {
        const tags = Object.entries(aggregation.tags || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
        return `${aggregation.name}:${tags}`;
    }
    getTimeBucketKey(timestamp, interval) {
        return Math.floor(timestamp.getTime() / 1000 / interval).toString();
    }
}
exports.MetricsCollector = MetricsCollector;
//# sourceMappingURL=MetricsCollector.js.map