export interface AlertConfig {
    id: string;
    name: string;
    type: AlertType;
    severity: AlertSeverity;
    service?: string;
    condition: AlertCondition;
    notificationChannels: NotificationChannel[];
    enabled: boolean;
    cooldownPeriod: number;
    metadata?: Record<string, any>;
}
export interface AlertCondition {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    duration?: number;
    tags?: Record<string, string>;
}
export interface Alert {
    id: string;
    configId: string;
    name: string;
    type: AlertType;
    severity: AlertSeverity;
    service?: string;
    message: string;
    triggeredAt: Date;
    resolvedAt?: Date;
    status: 'ACTIVE' | 'RESOLVED' | 'SUPPRESSED';
    triggeredBy: TriggerInfo;
    notificationStatus: NotificationStatus[];
    metadata?: Record<string, any>;
}
export interface TriggerInfo {
    metric: string;
    value: number;
    threshold: number;
    condition: string;
    tags: Record<string, string>;
}
export interface NotificationChannel {
    id: string;
    name: string;
    type: ChannelType;
    config: ChannelConfig;
    enabled: boolean;
}
export interface NotificationStatus {
    channelId: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
    sentAt?: Date;
    error?: string;
    retryCount: number;
}
export interface ChannelConfig {
    email?: EmailConfig;
    slack?: SlackConfig;
    webhook?: WebhookConfig;
    sms?: SmsConfig;
    pagerduty?: PagerDutyConfig;
}
export interface EmailConfig {
    to: string[];
    subject: string;
    template?: string;
}
export interface SlackConfig {
    webhookUrl: string;
    channel?: string;
    username?: string;
    icon?: string;
}
export interface WebhookConfig {
    url: string;
    method: 'POST' | 'PUT';
    headers?: Record<string, string>;
    timeout?: number;
}
export interface SmsConfig {
    to: string[];
    message?: string;
    provider: 'twilio' | 'aws-sns';
}
export interface PagerDutyConfig {
    serviceKey: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
}
export type AlertType = 'METRIC' | 'HEALTH' | 'SECURITY' | 'PERFORMANCE' | 'AVAILABILITY';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ChannelType = 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'SMS' | 'PAGERDUTY';
export declare class AlertingService {
    private logger;
    private alerts;
    private alertConfigs;
    private notificationChannels;
    private evaluationHistory;
    private cooldownTimers;
    constructor();
    createAlertConfig(config: AlertConfig): Promise<AlertConfig>;
    updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<AlertConfig>;
    deleteAlertConfig(id: string): Promise<void>;
    getAlertConfig(id: string): Promise<AlertConfig | null>;
    getAllAlertConfigs(): Promise<AlertConfig[]>;
    createNotificationChannel(channel: NotificationChannel): Promise<NotificationChannel>;
    updateNotificationChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel>;
    deleteNotificationChannel(id: string): Promise<void>;
    getNotificationChannel(id: string): Promise<NotificationChannel | null>;
    getAllNotificationChannels(): Promise<NotificationChannel[]>;
    evaluateAlert(metricName: string, value: number, tags?: Record<string, string>): Promise<void>;
    triggerAlert(alertId: string, triggeredBy: TriggerInfo): Promise<Alert>;
    resolveAlert(alertId: string): Promise<Alert>;
    getAlerts(filter?: {
        status?: Alert['status'];
        severity?: Alert['severity'];
        service?: string;
    }): Promise<Alert[]>;
    getAlert(alertId: string): Promise<Alert | null>;
    getAlertHistory(alertId: string, limit?: number): Promise<Alert[]>;
    getAlertStats(): Promise<{
        total: number;
        active: number;
        resolved: number;
        bySeverity: Record<AlertSeverity, number>;
        byType: Record<AlertType, number>;
    }>;
    private evaluateSingleAlert;
    private checkCondition;
    private tagsMatch;
    private sendNotifications;
    private sendToChannel;
    private sendEmailNotification;
    private sendSlackNotification;
    private sendWebhookNotification;
    private sendSmsNotification;
    private sendPagerDutyNotification;
    private sendResolutionNotifications;
    private sendResolutionToChannel;
    private retryNotification;
    private setupCooldown;
    private generateAlertMessage;
    private getSeverityColor;
    private validateAlertConfig;
    private validateNotificationChannel;
    private initializeDefaultChannels;
    private startPeriodicTasks;
    private cleanupOldAlerts;
    private cleanupEvaluationHistory;
    private generateAlertId;
}
//# sourceMappingURL=AlertingService.d.ts.map