"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertingService = void 0;
const logger_1 = require("../../utils/logger");
class AlertingService {
    constructor() {
        this.logger = new logger_1.Logger('AlertingService');
        this.alerts = new Map();
        this.alertConfigs = new Map();
        this.notificationChannels = new Map();
        this.evaluationHistory = new Map();
        this.cooldownTimers = new Map();
        this.initializeDefaultChannels();
        this.startPeriodicTasks();
    }
    async createAlertConfig(config) {
        try {
            this.validateAlertConfig(config);
            this.alertConfigs.set(config.id, config);
            this.logger.info('Alert configuration created', { configId: config.id, name: config.name });
            return config;
        }
        catch (error) {
            this.logger.error('Error creating alert configuration', { error, config });
            throw error;
        }
    }
    async updateAlertConfig(id, updates) {
        try {
            const existing = this.alertConfigs.get(id);
            if (!existing) {
                throw new Error(`Alert configuration not found: ${id}`);
            }
            const updated = { ...existing, ...updates };
            this.validateAlertConfig(updated);
            this.alertConfigs.set(id, updated);
            this.logger.info('Alert configuration updated', { configId: id, updates });
            return updated;
        }
        catch (error) {
            this.logger.error('Error updating alert configuration', { error, id, updates });
            throw error;
        }
    }
    async deleteAlertConfig(id) {
        try {
            const config = this.alertConfigs.get(id);
            if (!config) {
                throw new Error(`Alert configuration not found: ${id}`);
            }
            this.alertConfigs.delete(id);
            const timer = this.cooldownTimers.get(id);
            if (timer) {
                clearTimeout(timer);
                this.cooldownTimers.delete(id);
            }
            this.logger.info('Alert configuration deleted', { configId: id });
        }
        catch (error) {
            this.logger.error('Error deleting alert configuration', { error, id });
            throw error;
        }
    }
    async getAlertConfig(id) {
        return this.alertConfigs.get(id) || null;
    }
    async getAllAlertConfigs() {
        return Array.from(this.alertConfigs.values());
    }
    async createNotificationChannel(channel) {
        try {
            this.validateNotificationChannel(channel);
            this.notificationChannels.set(channel.id, channel);
            this.logger.info('Notification channel created', { channelId: channel.id, name: channel.name });
            return channel;
        }
        catch (error) {
            this.logger.error('Error creating notification channel', { error, channel });
            throw error;
        }
    }
    async updateNotificationChannel(id, updates) {
        try {
            const existing = this.notificationChannels.get(id);
            if (!existing) {
                throw new Error(`Notification channel not found: ${id}`);
            }
            const updated = { ...existing, ...updates };
            this.validateNotificationChannel(updated);
            this.notificationChannels.set(id, updated);
            this.logger.info('Notification channel updated', { channelId: id, updates });
            return updated;
        }
        catch (error) {
            this.logger.error('Error updating notification channel', { error, id, updates });
            throw error;
        }
    }
    async deleteNotificationChannel(id) {
        try {
            const channel = this.notificationChannels.get(id);
            if (!channel) {
                throw new Error(`Notification channel not found: ${id}`);
            }
            this.notificationChannels.delete(id);
            this.logger.info('Notification channel deleted', { channelId: id });
        }
        catch (error) {
            this.logger.error('Error deleting notification channel', { error, id });
            throw error;
        }
    }
    async getNotificationChannel(id) {
        return this.notificationChannels.get(id) || null;
    }
    async getAllNotificationChannels() {
        return Array.from(this.notificationChannels.values());
    }
    async evaluateAlert(metricName, value, tags = {}) {
        try {
            const configs = Array.from(this.alertConfigs.values()).filter(config => config.enabled && config.condition.metric === metricName);
            for (const config of configs) {
                if (config.condition.tags && !this.tagsMatch(tags, config.condition.tags)) {
                    continue;
                }
                await this.evaluateSingleAlert(config, value, tags);
            }
        }
        catch (error) {
            this.logger.error('Error evaluating alerts', { error, metricName, value, tags });
        }
    }
    async triggerAlert(alertId, triggeredBy) {
        try {
            const config = this.alertConfigs.get(alertId);
            if (!config) {
                throw new Error(`Alert configuration not found: ${alertId}`);
            }
            const alert = {
                id: this.generateAlertId(),
                configId: alertId,
                name: config.name,
                type: config.type,
                severity: config.severity,
                service: config.service,
                message: this.generateAlertMessage(config, triggeredBy),
                triggeredAt: new Date(),
                status: 'ACTIVE',
                triggeredBy,
                notificationStatus: config.notificationChannels.map(channel => ({
                    channelId: channel.id,
                    status: 'PENDING',
                    retryCount: 0
                })),
                metadata: config.metadata
            };
            this.alerts.set(alert.id, alert);
            await this.sendNotifications(alert);
            this.setupCooldown(config);
            this.logger.warn('Alert triggered', { alertId: alert.id, name: alert.name, severity: alert.severity });
            return alert;
        }
        catch (error) {
            this.logger.error('Error triggering alert', { error, alertId, triggeredBy });
            throw error;
        }
    }
    async resolveAlert(alertId) {
        try {
            const alert = this.alerts.get(alertId);
            if (!alert) {
                throw new Error(`Alert not found: ${alertId}`);
            }
            alert.resolvedAt = new Date();
            alert.status = 'RESOLVED';
            this.alerts.set(alertId, alert);
            await this.sendResolutionNotifications(alert);
            this.logger.info('Alert resolved', { alertId, name: alert.name });
            return alert;
        }
        catch (error) {
            this.logger.error('Error resolving alert', { error, alertId });
            throw error;
        }
    }
    async getAlerts(filter) {
        let alerts = Array.from(this.alerts.values());
        if (filter) {
            if (filter.status) {
                alerts = alerts.filter(a => a.status === filter.status);
            }
            if (filter.severity) {
                alerts = alerts.filter(a => a.severity === filter.severity);
            }
            if (filter.service) {
                alerts = alerts.filter(a => a.service === filter.service);
            }
        }
        return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
    }
    async getAlert(alertId) {
        return this.alerts.get(alertId) || null;
    }
    async getAlertHistory(alertId, limit = 100) {
        return Array.from(this.alerts.values())
            .filter(a => a.configId === alertId)
            .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
            .slice(0, limit);
    }
    async getAlertStats() {
        const alerts = Array.from(this.alerts.values());
        return {
            total: alerts.length,
            active: alerts.filter(a => a.status === 'ACTIVE').length,
            resolved: alerts.filter(a => a.status === 'RESOLVED').length,
            bySeverity: {
                LOW: alerts.filter(a => a.severity === 'LOW').length,
                MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
                HIGH: alerts.filter(a => a.severity === 'HIGH').length,
                CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length
            },
            byType: {
                METRIC: alerts.filter(a => a.type === 'METRIC').length,
                HEALTH: alerts.filter(a => a.type === 'HEALTH').length,
                SECURITY: alerts.filter(a => a.type === 'SECURITY').length,
                PERFORMANCE: alerts.filter(a => a.type === 'PERFORMANCE').length,
                AVAILABILITY: alerts.filter(a => a.type === 'AVAILABILITY').length
            }
        };
    }
    async evaluateSingleAlert(config, value, tags) {
        const key = `${config.id}:${JSON.stringify(tags)}`;
        if (!this.evaluationHistory.has(key)) {
            this.evaluationHistory.set(key, []);
        }
        const history = this.evaluationHistory.get(key);
        history.push({ value, timestamp: new Date() });
        if (history.length > 60) {
            history.shift();
        }
        const conditionMet = this.checkCondition(config.condition, value);
        if (conditionMet) {
            if (config.condition.duration && config.condition.duration > 0) {
                const durationThreshold = new Date(Date.now() - config.condition.duration * 1000);
                const recentEvaluations = history.filter(e => e.timestamp >= durationThreshold);
                if (recentEvaluations.length < config.condition.duration) {
                    return;
                }
                const allRecentMet = recentEvaluations.every(e => this.checkCondition(config.condition, e.value));
                if (!allRecentMet) {
                    return;
                }
            }
            if (this.cooldownTimers.has(config.id)) {
                return;
            }
            const triggeredBy = {
                metric: config.condition.metric,
                value,
                threshold: config.condition.threshold,
                condition: `${config.condition.operator} ${config.condition.threshold}`,
                tags
            };
            await this.triggerAlert(config.id, triggeredBy);
        }
    }
    checkCondition(condition, value) {
        switch (condition.operator) {
            case 'gt':
                return value > condition.threshold;
            case 'lt':
                return value < condition.threshold;
            case 'eq':
                return value === condition.threshold;
            case 'gte':
                return value >= condition.threshold;
            case 'lte':
                return value <= condition.threshold;
            default:
                return false;
        }
    }
    tagsMatch(actual, required) {
        return Object.entries(required).every(([key, value]) => actual[key] === value);
    }
    async sendNotifications(alert) {
        const notificationPromises = alert.notificationStatus.map(async (status) => {
            const channel = this.notificationChannels.get(status.channelId);
            if (!channel || !channel.enabled) {
                status.status = 'FAILED';
                status.error = 'Channel not found or disabled';
                return;
            }
            try {
                await this.sendToChannel(channel, alert);
                status.status = 'SENT';
                status.sentAt = new Date();
            }
            catch (error) {
                status.status = 'FAILED';
                status.error = error instanceof Error ? error.message : 'Unknown error';
                if (status.retryCount < 3) {
                    status.retryCount++;
                    status.status = 'RETRYING';
                    setTimeout(() => this.retryNotification(alert, status), 5000 * status.retryCount);
                }
            }
        });
        await Promise.all(notificationPromises);
    }
    async sendToChannel(channel, alert) {
        switch (channel.type) {
            case 'EMAIL':
                await this.sendEmailNotification(channel, alert);
                break;
            case 'SLACK':
                await this.sendSlackNotification(channel, alert);
                break;
            case 'WEBHOOK':
                await this.sendWebhookNotification(channel, alert);
                break;
            case 'SMS':
                await this.sendSmsNotification(channel, alert);
                break;
            case 'PAGERDUTY':
                await this.sendPagerDutyNotification(channel, alert);
                break;
            default:
                throw new Error(`Unsupported channel type: ${channel.type}`);
        }
    }
    async sendEmailNotification(channel, alert) {
        const emailConfig = channel.config.email;
        if (!emailConfig) {
            throw new Error('Email configuration not found');
        }
        this.logger.info('Sending email notification', {
            to: emailConfig.to,
            subject: emailConfig.subject,
            alertId: alert.id
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async sendSlackNotification(channel, alert) {
        const slackConfig = channel.config.slack;
        if (!slackConfig) {
            throw new Error('Slack configuration not found');
        }
        const payload = {
            text: alert.message,
            attachments: [{
                    color: this.getSeverityColor(alert.severity),
                    fields: [
                        { title: 'Severity', value: alert.severity, short: true },
                        { title: 'Service', value: alert.service || 'N/A', short: true },
                        { title: 'Triggered At', value: alert.triggeredAt.toISOString(), short: false }
                    ]
                }]
        };
        this.logger.info('Sending Slack notification', {
            webhookUrl: slackConfig.webhookUrl,
            alertId: alert.id
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async sendWebhookNotification(channel, alert) {
        const webhookConfig = channel.config.webhook;
        if (!webhookConfig) {
            throw new Error('Webhook configuration not found');
        }
        const payload = {
            alert: {
                id: alert.id,
                name: alert.name,
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                triggeredAt: alert.triggeredAt,
                triggeredBy: alert.triggeredBy
            }
        };
        this.logger.info('Sending webhook notification', {
            url: webhookConfig.url,
            alertId: alert.id
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async sendSmsNotification(channel, alert) {
        const smsConfig = channel.config.sms;
        if (!smsConfig) {
            throw new Error('SMS configuration not found');
        }
        const message = smsConfig.message || alert.message;
        this.logger.info('Sending SMS notification', {
            to: smsConfig.to,
            alertId: alert.id
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async sendPagerDutyNotification(channel, alert) {
        const pagerDutyConfig = channel.config.pagerduty;
        if (!pagerDutyConfig) {
            throw new Error('PagerDuty configuration not found');
        }
        this.logger.info('Sending PagerDuty notification', {
            serviceKey: pagerDutyConfig.serviceKey,
            alertId: alert.id
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async sendResolutionNotifications(alert) {
        const resolutionMessage = `Alert resolved: ${alert.name}`;
        for (const status of alert.notificationStatus) {
            const channel = this.notificationChannels.get(status.channelId);
            if (!channel || !channel.enabled)
                continue;
            try {
                await this.sendResolutionToChannel(channel, alert, resolutionMessage);
            }
            catch (error) {
                this.logger.error('Error sending resolution notification', {
                    error,
                    channelId: status.channelId,
                    alertId: alert.id
                });
            }
        }
    }
    async sendResolutionToChannel(channel, alert, message) {
        this.logger.info('Sending resolution notification', {
            channelType: channel.type,
            alertId: alert.id
        });
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    async retryNotification(alert, status) {
        const channel = this.notificationChannels.get(status.channelId);
        if (!channel || !channel.enabled)
            return;
        try {
            await this.sendToChannel(channel, alert);
            status.status = 'SENT';
            status.sentAt = new Date();
        }
        catch (error) {
            status.status = 'FAILED';
            status.error = error instanceof Error ? error.message : 'Unknown error';
        }
    }
    setupCooldown(config) {
        const timer = setTimeout(() => {
            this.cooldownTimers.delete(config.id);
        }, config.cooldownPeriod * 1000);
        this.cooldownTimers.set(config.id, timer);
    }
    generateAlertMessage(config, triggeredBy) {
        return `Alert: ${config.name} - ${config.type} - ${triggeredBy.metric} ${triggeredBy.condition} (current: ${triggeredBy.value})`;
    }
    getSeverityColor(severity) {
        switch (severity) {
            case 'LOW':
                return 'good';
            case 'MEDIUM':
                return 'warning';
            case 'HIGH':
                return 'danger';
            case 'CRITICAL':
                return '#ff0000';
            default:
                return '#808080';
        }
    }
    validateAlertConfig(config) {
        if (!config.id || !config.name) {
            throw new Error('Alert configuration must have id and name');
        }
        if (!config.condition || !config.condition.metric) {
            throw new Error('Alert configuration must have a valid condition');
        }
        if (!config.notificationChannels || config.notificationChannels.length === 0) {
            throw new Error('Alert configuration must have at least one notification channel');
        }
        for (const channel of config.notificationChannels) {
            if (!this.notificationChannels.has(channel.id)) {
                throw new Error(`Notification channel not found: ${channel.id}`);
            }
        }
    }
    validateNotificationChannel(channel) {
        if (!channel.id || !channel.name) {
            throw new Error('Notification channel must have id and name');
        }
        if (!channel.config) {
            throw new Error('Notification channel must have configuration');
        }
        switch (channel.type) {
            case 'EMAIL':
                if (!channel.config.email?.to || channel.config.email.to.length === 0) {
                    throw new Error('Email channel must have recipients');
                }
                break;
            case 'SLACK':
                if (!channel.config.slack?.webhookUrl) {
                    throw new Error('Slack channel must have webhook URL');
                }
                break;
            case 'WEBHOOK':
                if (!channel.config.webhook?.url) {
                    throw new Error('Webhook channel must have URL');
                }
                break;
            case 'SMS':
                if (!channel.config.sms?.to || channel.config.sms.to.length === 0) {
                    throw new Error('SMS channel must have recipients');
                }
                break;
            case 'PAGERDUTY':
                if (!channel.config.pagerduty?.serviceKey) {
                    throw new Error('PagerDuty channel must have service key');
                }
                break;
        }
    }
    initializeDefaultChannels() {
        const emailChannel = {
            id: 'default-email',
            name: 'Default Email Notifications',
            type: 'EMAIL',
            enabled: true,
            config: {
                email: {
                    to: ['admin@lawfirmpro.com'],
                    subject: 'Law Firm Pro Alert'
                }
            }
        };
        this.notificationChannels.set(emailChannel.id, emailChannel);
        const slackChannel = {
            id: 'default-slack',
            name: 'Default Slack Notifications',
            type: 'SLACK',
            enabled: true,
            config: {
                slack: {
                    webhookUrl: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/...',
                    username: 'Law Firm Pro',
                    icon: ':warning:'
                }
            }
        };
        this.notificationChannels.set(slackChannel.id, slackChannel);
    }
    startPeriodicTasks() {
        setInterval(() => {
            this.cleanupOldAlerts();
        }, 3600000);
        setInterval(() => {
            this.cleanupEvaluationHistory();
        }, 300000);
    }
    cleanupOldAlerts() {
        const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const alertsToDelete = Array.from(this.alerts.entries())
            .filter(([_, alert]) => alert.status === 'RESOLVED' &&
            alert.resolvedAt &&
            alert.resolvedAt < cutoffTime)
            .map(([id]) => id);
        alertsToDelete.forEach(id => this.alerts.delete(id));
        this.logger.info('Old alerts cleaned up', {
            deletedCount: alertsToDelete.length,
            cutoffTime
        });
    }
    cleanupEvaluationHistory() {
        const cutoffTime = new Date(Date.now() - 60 * 60 * 1000);
        for (const [key, history] of this.evaluationHistory.entries()) {
            const filtered = history.filter(e => e.timestamp >= cutoffTime);
            if (filtered.length === 0) {
                this.evaluationHistory.delete(key);
            }
            else {
                this.evaluationHistory.set(key, filtered);
            }
        }
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.AlertingService = AlertingService;
//# sourceMappingURL=AlertingService.js.map