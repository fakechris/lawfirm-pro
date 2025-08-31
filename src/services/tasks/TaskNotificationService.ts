import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  NotificationType, 
  NotificationPriority, 
  TaskStatus, 
  TaskPriority,
  UserRole,
  EmailFrequency,
  Task,
  User,
  Case
} from '@prisma/client';
import { NotificationPreferenceService } from './NotificationPreferenceService';
import { EmailNotificationService } from './EmailNotificationService';
import { InAppNotificationService } from './InAppNotificationService';
import { WebSocketService } from '../../services/websocket';

export interface TaskNotificationPayload {
  taskId: string;
  taskTitle: string;
  caseId: string;
  caseTitle: string;
  assignedTo: string;
  assignedBy: string;
  dueDate?: Date;
  status: TaskStatus;
  priority: TaskPriority;
  oldStatus?: TaskStatus;
  oldPriority?: TaskPriority;
  assigneeName: string;
  creatorName: string;
  caseType: string;
  metadata?: Record<string, any>;
}

export interface NotificationOptions {
  sendEmail?: boolean;
  sendInApp?: boolean;
  isEscalation?: boolean;
  quietHoursOverride?: boolean;
}

@injectable()
export class TaskNotificationService {
  constructor(
    @inject(Database) private db: Database,
    @inject(NotificationPreferenceService) private preferenceService: NotificationPreferenceService,
    @inject(EmailNotificationService) private emailService: EmailNotificationService,
    @inject(InAppNotificationService) private inAppService: InAppNotificationService,
    @inject(WebSocketService) private wsService: WebSocketService
  ) {}

  async notifyTaskAssigned(payload: TaskNotificationPayload, options: NotificationOptions = {}): Promise<void> {
    const { sendEmail = true, sendInApp = true } = options;
    
    // Get user preferences
    const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
    
    // Check if notifications are enabled during quiet hours
    const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
    
    if (!canNotify) {
      // Queue for later if during quiet hours
      await this.queueForLater(payload.assignedTo, NotificationType.TASK_ASSIGNED, payload);
      return;
    }

    const title = `新任务分配: ${payload.taskTitle}`;
    const message = `您被分配了一个新任务 "${payload.taskTitle}" 在案件 "${payload.caseTitle}" 中`;
    
    const notificationData = {
      userId: payload.assignedTo,
      type: NotificationType.TASK_ASSIGNED,
      title,
      message,
      priority: this.mapTaskPriorityToNotificationPriority(payload.priority),
      data: {
        taskId: payload.taskId,
        caseId: payload.caseId,
        assignedBy: payload.assignedBy,
        dueDate: payload.dueDate,
        ...payload.metadata
      }
    };

    // Send in-app notification
    if (sendInApp && preferences.inAppEnabled && preferences.taskAssignment) {
      await this.inAppService.createNotification(notificationData);
      
      // Send real-time WebSocket notification
      this.wsService.broadcastToUser(payload.assignedTo, {
        type: 'task_assigned',
        data: {
          taskId: payload.taskId,
          taskTitle: payload.taskTitle,
          caseTitle: payload.caseTitle,
          assignedBy: payload.creatorName,
          dueDate: payload.dueDate,
          priority: payload.priority
        }
      });
    }

    // Send email notification
    if (sendEmail && preferences.emailEnabled && preferences.taskAssignment) {
      await this.emailService.sendTaskAssignmentEmail(payload, preferences);
    }
  }

  async notifyTaskUpdated(payload: TaskNotificationPayload, options: NotificationOptions = {}): Promise<void> {
    const { sendEmail = true, sendInApp = true } = options;
    
    const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
    const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
    
    if (!canNotify) {
      await this.queueForLater(payload.assignedTo, NotificationType.TASK_UPDATED, payload);
      return;
    }

    let title = '';
    let message = '';

    // Determine what changed
    if (payload.oldStatus && payload.oldStatus !== payload.status) {
      title = `任务状态更新: ${payload.taskTitle}`;
      message = `任务 "${payload.taskTitle}" 的状态已从 ${this.getStatusLabel(payload.oldStatus)} 更改为 ${this.getStatusLabel(payload.status)}`;
    } else if (payload.oldPriority && payload.oldPriority !== payload.priority) {
      title = `任务优先级更新: ${payload.taskTitle}`;
      message = `任务 "${payload.taskTitle}" 的优先级已更改为 ${this.getPriorityLabel(payload.priority)}`;
    } else {
      title = `任务更新: ${payload.taskTitle}`;
      message = `任务 "${payload.taskTitle}" 已更新`;
    }

    const notificationData = {
      userId: payload.assignedTo,
      type: NotificationType.TASK_UPDATED,
      title,
      message,
      priority: this.mapTaskPriorityToNotificationPriority(payload.priority),
      data: {
        taskId: payload.taskId,
        caseId: payload.caseId,
        oldStatus: payload.oldStatus,
        newStatus: payload.status,
        oldPriority: payload.oldPriority,
        newPriority: payload.priority,
        ...payload.metadata
      }
    };

    if (sendInApp && preferences.inAppEnabled) {
      await this.inAppService.createNotification(notificationData);
      
      this.wsService.broadcastToUser(payload.assignedTo, {
        type: 'task_updated',
        data: {
          taskId: payload.taskId,
          taskTitle: payload.taskTitle,
          status: payload.status,
          priority: payload.priority,
          changes: {
            status: payload.oldStatus !== payload.status,
            priority: payload.oldPriority !== payload.priority
          }
        }
      });
    }

    if (sendEmail && preferences.emailEnabled) {
      await this.emailService.sendTaskUpdateEmail(payload, preferences);
    }
  }

  async notifyTaskCompleted(payload: TaskNotificationPayload, options: NotificationOptions = {}): Promise<void> {
    const { sendEmail = true, sendInApp = true } = options;
    
    // Notify assignee (task completer)
    const assigneePreferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
    const canNotifyAssignee = await this.checkQuietHours(payload.assignedTo, assigneePreferences, options.quietHoursOverride);
    
    if (canNotifyAssignee) {
      const assigneeTitle = `任务完成: ${payload.taskTitle}`;
      const assigneeMessage = `您已完成任务 "${payload.taskTitle}"`;
      
      if (sendInApp && assigneePreferences.inAppEnabled && assigneePreferences.taskCompletion) {
        await this.inAppService.createNotification({
          userId: payload.assignedTo,
          type: NotificationType.TASK_COMPLETED,
          title: assigneeTitle,
          message: assigneeMessage,
          priority: NotificationPriority.MEDIUM,
          data: {
            taskId: payload.taskId,
            caseId: payload.caseId,
            completedAt: new Date(),
            ...payload.metadata
          }
        });
      }
    }

    // Notify task creator/admin about completion
    const creatorPreferences = await this.preferenceService.getUserPreferences(payload.assignedBy);
    const canNotifyCreator = await this.checkQuietHours(payload.assignedBy, creatorPreferences, options.quietHoursOverride);
    
    if (canNotifyCreator && payload.assignedTo !== payload.assignedBy) {
      const creatorTitle = `任务已完成: ${payload.taskTitle}`;
      const creatorMessage = `${payload.assigneeName} 已完成任务 "${payload.taskTitle}"`;
      
      if (sendInApp && creatorPreferences.inAppEnabled && creatorPreferences.taskCompletion) {
        await this.inAppService.createNotification({
          userId: payload.assignedBy,
          type: NotificationType.TASK_COMPLETED,
          title: creatorTitle,
          message: creatorMessage,
          priority: NotificationPriority.MEDIUM,
          data: {
            taskId: payload.taskId,
            caseId: payload.caseId,
            completedBy: payload.assignedTo,
            completedAt: new Date(),
            ...payload.metadata
          }
        });

        this.wsService.broadcastToUser(payload.assignedBy, {
          type: 'task_completed',
          data: {
            taskId: payload.taskId,
            taskTitle: payload.taskTitle,
            completedBy: payload.assigneeName,
            caseTitle: payload.caseTitle
          }
        });
      }

      if (sendEmail && creatorPreferences.emailEnabled && creatorPreferences.taskCompletion) {
        await this.emailService.sendTaskCompletionEmail(payload, creatorPreferences);
      }
    }
  }

  async notifyTaskDeadlineReminder(payload: TaskNotificationPayload, hoursUntilDeadline: number, options: NotificationOptions = {}): Promise<void> {
    const { sendEmail = true, sendInApp = true } = options;
    
    const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
    const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
    
    if (!canNotify) {
      await this.queueForLater(payload.assignedTo, NotificationType.TASK_DEADLINE_REMINDER, payload);
      return;
    }

    const urgency = hoursUntilDeadline <= 24 ? '紧急' : hoursUntilDeadline <= 72 ? '即将到期' : '提醒';
    const title = `${urgency}任务截止日期: ${payload.taskTitle}`;
    const message = `任务 "${payload.taskTitle}" 将在 ${hoursUntilDeadline} 小时后到期`;

    const priority = hoursUntilDeadline <= 24 ? NotificationPriority.URGENT : 
                     hoursUntilDeadline <= 72 ? NotificationPriority.HIGH : 
                     NotificationPriority.MEDIUM;

    if (sendInApp && preferences.inAppEnabled && preferences.taskDeadline) {
      await this.inAppService.createNotification({
        userId: payload.assignedTo,
        type: NotificationType.TASK_DEADLINE_REMINDER,
        title,
        message,
        priority,
        data: {
          taskId: payload.taskId,
          caseId: payload.caseId,
          dueDate: payload.dueDate,
          hoursUntilDeadline,
          ...payload.metadata
        }
      });

      this.wsService.broadcastToUser(payload.assignedTo, {
        type: 'deadline_reminder',
        data: {
          taskId: payload.taskId,
          taskTitle: payload.taskTitle,
          dueDate: payload.dueDate,
          hoursUntilDeadline,
          priority: payload.priority
        }
      });
    }

    if (sendEmail && preferences.emailEnabled && preferences.taskDeadline) {
      await this.emailService.sendDeadlineReminderEmail(payload, hoursUntilDeadline, preferences);
    }
  }

  async notifyTaskOverdue(payload: TaskNotificationPayload, daysOverdue: number, options: NotificationOptions = {}): Promise<void> {
    const { sendEmail = true, sendInApp = true, isEscalation = false } = options;
    
    // Notify assignee
    const assigneePreferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
    const canNotifyAssignee = await this.checkQuietHours(payload.assignedTo, assigneePreferences, options.quietHoursOverride);
    
    if (canNotifyAssignee) {
      const title = `任务逾期: ${payload.taskTitle}`;
      const message = `任务 "${payload.taskTitle}" 已逾期 ${daysOverdue} 天`;

      if (sendInApp && assigneePreferences.inAppEnabled && assigneePreferences.taskDeadline) {
        await this.inAppService.createNotification({
          userId: payload.assignedTo,
          type: NotificationType.OVERDUE_TASK,
          title,
          message,
          priority: NotificationPriority.HIGH,
          data: {
            taskId: payload.taskId,
            caseId: payload.caseId,
            dueDate: payload.dueDate,
            daysOverdue,
            ...payload.metadata
          }
        });
      }
    }

    // Escalate to admin/manager if severely overdue
    if (isEscalation && daysOverdue >= 3) {
      await this.escalateOverdueTask(payload, daysOverdue, assigneePreferences);
    }

    if (sendEmail && assigneePreferences.emailEnabled && assigneePreferences.taskDeadline) {
      await this.emailService.sendOverdueTaskEmail(payload, daysOverdue, assigneePreferences);
    }
  }

  async notifyTaskEscalation(payload: TaskNotificationPayload, escalationReason: string, options: NotificationOptions = {}): Promise<void> {
    const { sendEmail = true, sendInApp = true } = options;
    
    // Get admin users for escalation
    const adminUsers = await this.db.client.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    for (const admin of adminUsers) {
      const preferences = await this.preferenceService.getUserPreferences(admin.id);
      const canNotify = await this.checkQuietHours(admin.id, preferences, options.quietHoursOverride);
      
      if (!canNotify) continue;

      const title = `任务升级: ${payload.taskTitle}`;
      const message = `任务 "${payload.taskTitle}" 需要关注: ${escalationReason}`;

      if (sendInApp && preferences.inAppEnabled && preferences.taskEscalation) {
        await this.inAppService.createNotification({
          userId: admin.id,
          type: NotificationType.TASK_ESCALATION,
          title,
          message,
          priority: NotificationPriority.URGENT,
          data: {
            taskId: payload.taskId,
            caseId: payload.caseId,
            assignedTo: payload.assignedTo,
            escalationReason,
            ...payload.metadata
          }
        });

        this.wsService.broadcastToUser(admin.id, {
          type: 'task_escalation',
          data: {
            taskId: payload.taskId,
            taskTitle: payload.taskTitle,
            caseTitle: payload.caseTitle,
            assignedTo: payload.assigneeName,
            escalationReason
          }
        });
      }

      if (sendEmail && preferences.emailEnabled && preferences.taskEscalation) {
        await this.emailService.sendTaskEscalationEmail(payload, escalationReason, admin, preferences);
      }
    }
  }

  async notifyDependencyBlocked(payload: TaskNotificationPayload, blockedByTaskTitle: string, options: NotificationOptions = {}): Promise<void> {
    const { sendEmail = true, sendInApp = true } = options;
    
    const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
    const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
    
    if (!canNotify) {
      await this.queueForLater(payload.assignedTo, NotificationType.DEPENDENCY_BLOCKED, payload);
      return;
    }

    const title = `任务被阻止: ${payload.taskTitle}`;
    const message = `任务 "${payload.taskTitle}" 被依赖任务 "${blockedByTaskTitle}" 阻止`;

    if (sendInApp && preferences.inAppEnabled) {
      await this.inAppService.createNotification({
        userId: payload.assignedTo,
        type: NotificationType.DEPENDENCY_BLOCKED,
        title,
        message,
        priority: NotificationPriority.HIGH,
        data: {
          taskId: payload.taskId,
          caseId: payload.caseId,
          blockedByTaskTitle,
          ...payload.metadata
        }
      });

      this.wsService.broadcastToUser(payload.assignedTo, {
        type: 'dependency_blocked',
        data: {
          taskId: payload.taskId,
          taskTitle: payload.taskTitle,
          blockedByTaskTitle
        }
      });
    }

    if (sendEmail && preferences.emailEnabled) {
      await this.emailService.sendDependencyBlockedEmail(payload, blockedByTaskTitle, preferences);
    }
  }

  private async escalateOverdueTask(payload: TaskNotificationPayload, daysOverdue: number, assigneePreferences: any): Promise<void> {
    const adminUsers = await this.db.client.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    for (const admin of adminUsers) {
      const adminPreferences = await this.preferenceService.getUserPreferences(admin.id);
      
      if (adminPreferences.inAppEnabled && adminPreferences.taskEscalation) {
        const title = `严重逾期任务: ${payload.taskTitle}`;
        const message = `任务 "${payload.taskTitle}" 已逾期 ${daysOverdue} 天，需要立即关注`;

        await this.inAppService.createNotification({
          userId: admin.id,
          type: NotificationType.TASK_ESCALATION,
          title,
          message,
          priority: NotificationPriority.URGENT,
          data: {
            taskId: payload.taskId,
            caseId: payload.caseId,
            assignedTo: payload.assignedTo,
            daysOverdue,
            escalationReason: `任务逾期 ${daysOverdue} 天`,
            ...payload.metadata
          }
        });

        this.wsService.broadcastToUser(admin.id, {
          type: 'severe_overdue_escalation',
          data: {
            taskId: payload.taskId,
            taskTitle: payload.taskTitle,
            daysOverdue,
            assignedTo: payload.assigneeName
          }
        });
      }
    }
  }

  private async checkQuietHours(userId: string, preferences: any, override: boolean = false): Promise<boolean> {
    if (override) return true;
    
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return true;
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm format
    const startTime = preferences.quietHoursStart;
    const endTime = preferences.quietHoursEnd;

    // Simple check if current time is within quiet hours
    if (startTime <= endTime) {
      return currentTime < startTime || currentTime >= endTime;
    } else {
      // Handle overnight quiet hours (e.g., 22:00 to 06:00)
      return currentTime < startTime && currentTime >= endTime;
    }
  }

  private async queueForLater(userId: string, type: NotificationType, payload: TaskNotificationPayload): Promise<void> {
    // Implementation for queuing notifications during quiet hours
    // This would typically involve storing in a queue table and processing later
    console.log(`Notification queued for user ${userId} during quiet hours:`, { type, payload });
  }

  private mapTaskPriorityToNotificationPriority(taskPriority: TaskPriority): NotificationPriority {
    switch (taskPriority) {
      case TaskPriority.URGENT:
        return NotificationPriority.URGENT;
      case TaskPriority.HIGH:
        return NotificationPriority.HIGH;
      case TaskPriority.MEDIUM:
        return NotificationPriority.MEDIUM;
      case TaskPriority.LOW:
        return NotificationPriority.LOW;
      default:
        return NotificationPriority.MEDIUM;
    }
  }

  private getStatusLabel(status: TaskStatus): string {
    const labels = {
      [TaskStatus.PENDING]: '待处理',
      [TaskStatus.IN_PROGRESS]: '进行中',
      [TaskStatus.COMPLETED]: '已完成',
      [TaskStatus.CANCELLED]: '已取消'
    };
    return labels[status] || status;
  }

  private getPriorityLabel(priority: TaskPriority): string {
    const labels = {
      [TaskPriority.LOW]: '低',
      [TaskPriority.MEDIUM]: '中',
      [TaskPriority.HIGH]: '高',
      [TaskPriority.URGENT]: '紧急'
    };
    return labels[priority] || priority;
  }
}