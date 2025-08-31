import { Database } from '../../utils/database';
import { NotificationPreference, EmailFrequency } from '@prisma/client';
export interface UpdateNotificationPreferencesRequest {
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    taskAssignment?: boolean;
    taskDeadline?: boolean;
    taskCompletion?: boolean;
    taskEscalation?: boolean;
    caseUpdates?: boolean;
    messages?: boolean;
    emailFrequency?: EmailFrequency;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
}
export interface NotificationPreferenceResponse {
    id: string;
    userId: string;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    taskAssignment: boolean;
    taskDeadline: boolean;
    taskCompletion: boolean;
    taskEscalation: boolean;
    caseUpdates: boolean;
    messages: boolean;
    emailFrequency: EmailFrequency;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface NotificationDeliveryCheck {
    canDeliverEmail: boolean;
    canDeliverInApp: boolean;
    reason?: string;
    quietHoursActive: boolean;
    nextDeliveryWindow?: Date;
}
export declare class NotificationPreferenceService {
    private db;
    constructor(db: Database);
    getUserPreferences(userId: string): Promise<NotificationPreferenceResponse>;
    updatePreferences(userId: string, updates: UpdateNotificationPreferencesRequest): Promise<NotificationPreferenceResponse>;
    canDeliverNotification(userId: string, notificationType: string, channel?: 'email' | 'inApp', overrideQuietHours?: boolean): Promise<NotificationDeliveryCheck>;
    getUsersForBulkNotification(notificationType: string, channel?: 'email' | 'inApp', filters?: {
        roles?: string[];
        caseId?: string;
        excludeUsers?: string[];
    }): Promise<string[]>;
    createDefaultPreferences(userId: string): Promise<NotificationPreference>;
    resetToDefaults(userId: string): Promise<NotificationPreferenceResponse>;
    getUserEmailFrequency(userId: string): Promise<EmailFrequency>;
    setUserEmailFrequency(userId: string, frequency: EmailFrequency): Promise<NotificationPreferenceResponse>;
    setQuietHours(userId: string, startTime: string, endTime: string): Promise<NotificationPreferenceResponse>;
    disableQuietHours(userId: string): Promise<NotificationPreferenceResponse>;
    getTimezoneInfo(userId: string): Promise<{
        timezone: string;
        currentTime: Date;
        quietHoursActive: boolean;
        nextDeliveryWindow?: Date;
    }>;
    private validateQuietHoursFormat;
    private isQuietHoursActive;
    private getNextDeliveryWindow;
    private isNotificationTypeEnabled;
    private isUrgentNotificationType;
    private mapPreferencesToResponse;
}
//# sourceMappingURL=NotificationPreferenceService.d.ts.map