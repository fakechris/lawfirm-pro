import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  NotificationPreference, 
  EmailFrequency,
  User
} from '@prisma/client';

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

@injectable()
export class NotificationPreferenceService {
  constructor(@inject(Database) private db: Database) {}

  async getUserPreferences(userId: string): Promise<NotificationPreferenceResponse> {
    let preferences = await this.db.client.notificationPreference.findUnique({
      where: { userId }
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId);
    }

    return this.mapPreferencesToResponse(preferences);
  }

  async updatePreferences(
    userId: string, 
    updates: UpdateNotificationPreferencesRequest
  ): Promise<NotificationPreferenceResponse> {
    // Validate quiet hours format if provided
    if (updates.quietHoursStart || updates.quietHoursEnd) {
      this.validateQuietHoursFormat(updates.quietHoursStart, updates.quietHoursEnd);
    }

    let preferences = await this.db.client.notificationPreference.findUnique({
      where: { userId }
    });

    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId);
    }

    const updatedPreferences = await this.db.client.notificationPreference.update({
      where: { userId },
      data: updates
    });

    return this.mapPreferencesToResponse(updatedPreferences);
  }

  async canDeliverNotification(
    userId: string, 
    notificationType: string, 
    channel: 'email' | 'inApp' = 'inApp',
    overrideQuietHours: boolean = false
  ): Promise<NotificationDeliveryCheck> {
    const preferences = await this.getUserPreferences(userId);
    
    const check: NotificationDeliveryCheck = {
      canDeliverEmail: false,
      canDeliverInApp: false,
      quietHoursActive: false
    };

    // Check if notifications are globally enabled for the channel
    if (channel === 'email' && !preferences.emailEnabled) {
      check.reason = 'Email notifications are disabled';
      return check;
    }

    if (channel === 'inApp' && !preferences.inAppEnabled) {
      check.reason = 'In-app notifications are disabled';
      return check;
    }

    // Check if specific notification type is enabled
    const typeEnabled = this.isNotificationTypeEnabled(notificationType, preferences);
    if (!typeEnabled) {
      check.reason = `${notificationType} notifications are disabled`;
      return check;
    }

    // Check quiet hours
    if (!overrideQuietHours) {
      const quietHoursActive = this.isQuietHoursActive(preferences);
      check.quietHoursActive = quietHoursActive;
      
      if (quietHoursActive) {
        check.reason = 'Quiet hours are active';
        check.nextDeliveryWindow = this.getNextDeliveryWindow(preferences);
        
        // For email, check if we should queue for later based on frequency
        if (channel === 'email' && preferences.emailFrequency !== EmailFrequency.IMMEDIATE) {
          check.reason = 'Email frequency settings prevent immediate delivery';
          check.canDeliverEmail = false;
          check.canDeliverInApp = true; // In-app can still be delivered
          return check;
        }
        
        // For in-app, we might still deliver urgent notifications
        if (channel === 'inApp') {
          // Allow urgent notifications during quiet hours
          const isUrgent = this.isUrgentNotificationType(notificationType);
          if (!isUrgent) {
            check.canDeliverInApp = false;
            return check;
          }
        }
      }
    }

    // If we passed all checks, delivery is allowed
    if (channel === 'email') {
      check.canDeliverEmail = true;
    }
    if (channel === 'inApp') {
      check.canDeliverInApp = true;
    }

    return check;
  }

  async getUsersForBulkNotification(
    notificationType: string, 
    channel: 'email' | 'inApp' = 'inApp',
    filters?: {
      roles?: string[];
      caseId?: string;
      excludeUsers?: string[];
    }
  ): Promise<string[]> {
    let userIds: string[] = [];

    // Build user query based on filters
    const userWhereClause: any = {};
    
    if (filters?.roles && filters.roles.length > 0) {
      userWhereClause.role = { in: filters.roles };
    }

    if (filters?.caseId) {
      // Get users associated with a specific case
      const caseUsers = await this.db.client.case.findUnique({
        where: { id: filters.caseId },
        include: {
          attorney: { include: { user: true } },
          client: { include: { user: true } }
        }
      });

      if (caseUsers) {
        const caseUserIds = [
          caseUsers.attorney?.user?.id,
          caseUsers.client?.user?.id
        ].filter(Boolean);
        
        userWhereClause.id = { in: caseUserIds };
      }
    }

    if (filters?.excludeUsers && filters.excludeUsers.length > 0) {
      userWhereClause.id = {
        ...userWhereClause.id,
        notIn: filters.excludeUsers
      };
    }

    const users = await this.db.client.user.findMany({
      where: userWhereClause,
      select: { id: true }
    });

    // Check each user's preferences
    for (const user of users) {
      const deliveryCheck = await this.canDeliverNotification(user.id, notificationType, channel);
      
      if (channel === 'email' && deliveryCheck.canDeliverEmail) {
        userIds.push(user.id);
      } else if (channel === 'inApp' && deliveryCheck.canDeliverInApp) {
        userIds.push(user.id);
      }
    }

    return userIds;
  }

  async createDefaultPreferences(userId: string): Promise<NotificationPreference> {
    return await this.db.client.notificationPreference.create({
      data: {
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        taskAssignment: true,
        taskDeadline: true,
        taskCompletion: true,
        taskEscalation: true,
        caseUpdates: true,
        messages: true,
        emailFrequency: EmailFrequency.IMMEDIATE,
        timezone: 'Asia/Shanghai'
      }
    });
  }

  async resetToDefaults(userId: string): Promise<NotificationPreferenceResponse> {
    const preferences = await this.db.client.notificationPreference.findUnique({
      where: { userId }
    });

    if (!preferences) {
      return this.getUserPreferences(userId);
    }

    const updatedPreferences = await this.db.client.notificationPreference.update({
      where: { userId },
      data: {
        emailEnabled: true,
        inAppEnabled: true,
        taskAssignment: true,
        taskDeadline: true,
        taskCompletion: true,
        taskEscalation: true,
        caseUpdates: true,
        messages: true,
        emailFrequency: EmailFrequency.IMMEDIATE,
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: 'Asia/Shanghai'
      }
    });

    return this.mapPreferencesToResponse(updatedPreferences);
  }

  async getUserEmailFrequency(userId: string): Promise<EmailFrequency> {
    const preferences = await this.getUserPreferences(userId);
    return preferences.emailFrequency;
  }

  async setUserEmailFrequency(userId: string, frequency: EmailFrequency): Promise<NotificationPreferenceResponse> {
    return await this.updatePreferences(userId, { emailFrequency: frequency });
  }

  async setQuietHours(
    userId: string, 
    startTime: string, 
    endTime: string
  ): Promise<NotificationPreferenceResponse> {
    this.validateQuietHoursFormat(startTime, endTime);
    
    return await this.updatePreferences(userId, {
      quietHoursStart: startTime,
      quietHoursEnd: endTime
    });
  }

  async disableQuietHours(userId: string): Promise<NotificationPreferenceResponse> {
    return await this.updatePreferences(userId, {
      quietHoursStart: null,
      quietHoursEnd: null
    });
  }

  async getTimezoneInfo(userId: string): Promise<{
    timezone: string;
    currentTime: Date;
    quietHoursActive: boolean;
    nextDeliveryWindow?: Date;
  }> {
    const preferences = await this.getUserPreferences(userId);
    const currentTime = new Date();
    const quietHoursActive = this.isQuietHoursActive(preferences);
    
    return {
      timezone: preferences.timezone,
      currentTime,
      quietHoursActive,
      nextDeliveryWindow: quietHoursActive ? this.getNextDeliveryWindow(preferences) : undefined
    };
  }

  private validateQuietHoursFormat(startTime?: string, endTime?: string): void {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (startTime && !timeRegex.test(startTime)) {
      throw new Error('Invalid quiet hours start time format. Use HH:mm format.');
    }
    
    if (endTime && !timeRegex.test(endTime)) {
      throw new Error('Invalid quiet hours end time format. Use HH:mm format.');
    }
  }

  private isQuietHoursActive(preferences: NotificationPreferenceResponse): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm format
    const startTime = preferences.quietHoursStart;
    const endTime = preferences.quietHoursEnd;

    // Simple check if current time is within quiet hours
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Handle overnight quiet hours (e.g., 22:00 to 06:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  private getNextDeliveryWindow(preferences: NotificationPreferenceResponse): Date {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return new Date(); // Can deliver immediately
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const startTime = preferences.quietHoursStart;
    const endTime = preferences.quietHoursEnd;

    // If current time is during quiet hours, calculate next delivery time
    if (this.isQuietHoursActive(preferences)) {
      const nextDelivery = new Date(now);
      
      if (startTime <= endTime) {
        // Normal day hours (e.g., 22:00 to 06:00)
        const [endHour, endMinute] = endTime.split(':').map(Number);
        nextDelivery.setHours(endHour, endMinute, 0, 0);
        
        // If end time is earlier than current time, add one day
        if (nextDelivery <= now) {
          nextDelivery.setDate(nextDelivery.getDate() + 1);
        }
      } else {
        // Overnight quiet hours (e.g., 22:00 to 06:00)
        const [endHour, endMinute] = endTime.split(':').map(Number);
        nextDelivery.setHours(endHour, endMinute, 0, 0);
        
        // If end time is earlier than current time, it's the next day
        if (nextDelivery <= now) {
          nextDelivery.setDate(nextDelivery.getDate() + 1);
        }
      }
      
      return nextDelivery;
    }

    return now; // Can deliver immediately
  }

  private isNotificationTypeEnabled(notificationType: string, preferences: NotificationPreferenceResponse): boolean {
    switch (notificationType) {
      case 'TASK_ASSIGNED':
        return preferences.taskAssignment;
      case 'TASK_DEADLINE_REMINDER':
      case 'OVERDUE_TASK':
        return preferences.taskDeadline;
      case 'TASK_COMPLETED':
        return preferences.taskCompletion;
      case 'TASK_ESCALATION':
        return preferences.taskEscalation;
      case 'CASE_UPDATED':
        return preferences.caseUpdates;
      case 'MESSAGE_RECEIVED':
        return preferences.messages;
      default:
        return true; // Allow unknown types by default
    }
  }

  private isUrgentNotificationType(notificationType: string): boolean {
    const urgentTypes = [
      'TASK_ESCALATION',
      'OVERDUE_TASK',
      'URGENT_SYSTEM_ALERT'
    ];
    
    return urgentTypes.includes(notificationType);
  }

  private mapPreferencesToResponse(preferences: NotificationPreference): NotificationPreferenceResponse {
    return {
      id: preferences.id,
      userId: preferences.userId,
      emailEnabled: preferences.emailEnabled,
      inAppEnabled: preferences.inAppEnabled,
      taskAssignment: preferences.taskAssignment,
      taskDeadline: preferences.taskDeadline,
      taskCompletion: preferences.taskCompletion,
      taskEscalation: preferences.taskEscalation,
      caseUpdates: preferences.caseUpdates,
      messages: preferences.messages,
      emailFrequency: preferences.emailFrequency,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      timezone: preferences.timezone,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt
    };
  }
}