import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { 
  TaskNotificationService, 
  TaskNotificationPayload,
  NotificationOptions 
} from '../services/tasks/TaskNotificationService';
import { EmailNotificationService } from '../services/tasks/EmailNotificationService';
import { InAppNotificationService, CreateNotificationRequest } from '../services/tasks/InAppNotificationService';
import { NotificationPreferenceService, UpdateNotificationPreferencesRequest } from '../services/tasks/NotificationPreferenceService';
import { Database } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { 
  NotificationType, 
  NotificationPriority, 
  EmailFrequency,
  UserRole,
  TaskStatus,
  TaskPriority
} from '@prisma/client';

@injectable()
export class NotificationController {
  constructor(
    @inject(TaskNotificationService) private taskNotificationService: TaskNotificationService,
    @inject(EmailNotificationService) private emailService: EmailNotificationService,
    @inject(InAppNotificationService) private inAppService: InAppNotificationService,
    @inject(NotificationPreferenceService) private preferenceService: NotificationPreferenceService,
    @inject(Database) private db: Database
  ) {}

  // Validation schemas
  private createNotificationSchema = z.object({
    type: z.nativeEnum(NotificationType),
    title: z.string().min(1, 'Title is required'),
    message: z.string().min(1, 'Message is required'),
    priority: z.nativeEnum(NotificationPriority).optional(),
    data: z.record(z.any()).optional(),
    expiresAt: z.string().datetime().optional()
  });

  private updatePreferencesSchema = z.object({
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    taskAssignment: z.boolean().optional(),
    taskDeadline: z.boolean().optional(),
    taskCompletion: z.boolean().optional(),
    taskEscalation: z.boolean().optional(),
    caseUpdates: z.boolean().optional(),
    messages: z.boolean().optional(),
    emailFrequency: z.nativeEnum(EmailFrequency).optional(),
    quietHoursStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    quietHoursEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    timezone: z.string().optional()
  });

  private taskNotificationSchema = z.object({
    taskId: z.string().min(1, 'Task ID is required'),
    taskTitle: z.string().min(1, 'Task title is required'),
    caseId: z.string().min(1, 'Case ID is required'),
    caseTitle: z.string().min(1, 'Case title is required'),
    assignedTo: z.string().min(1, 'Assigned to is required'),
    assignedBy: z.string().min(1, 'Assigned by is required'),
    dueDate: z.string().datetime().optional(),
    status: z.nativeEnum(TaskStatus),
    priority: z.nativeEnum(TaskPriority),
    oldStatus: z.nativeEnum(TaskStatus).optional(),
    oldPriority: z.nativeEnum(TaskPriority).optional(),
    assigneeName: z.string().min(1, 'Assignee name is required'),
    creatorName: z.string().min(1, 'Creator name is required'),
    caseType: z.string().min(1, 'Case type is required'),
    metadata: z.record(z.any()).optional()
  });

  private notificationOptionsSchema = z.object({
    sendEmail: z.boolean().optional(),
    sendInApp: z.boolean().optional(),
    isEscalation: z.boolean().optional(),
    quietHoursOverride: z.boolean().optional()
  });

  // In-App Notification Endpoints
  createNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
    const validatedData = this.createNotificationSchema.parse(req.body);
    
    const notificationRequest: CreateNotificationRequest = {
      userId: req.user!.id,
      type: validatedData.type,
      title: validatedData.title,
      message: validatedData.message,
      priority: validatedData.priority,
      data: validatedData.data,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined
    };

    const notification = await this.inAppService.createNotification(notificationRequest);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification }
    });
  });

  getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      type: req.query.type as NotificationType,
      priority: req.query.priority as NotificationPriority,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      expiresOnly: req.query.expiresOnly === 'true'
    };

    const notifications = await this.inAppService.getNotifications(req.user!.id, filters);

    res.json({
      success: true,
      data: { notifications }
    });
  });

  getUnreadNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    const notifications = await this.inAppService.getUnreadNotifications(req.user!.id, limit);

    res.json({
      success: true,
      data: { notifications }
    });
  });

  getNotificationById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    
    const notification = await this.inAppService.getNotificationById(id, req.user!.id);

    res.json({
      success: true,
      data: { notification }
    });
  });

  markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    
    const notification = await this.inAppService.markAsRead(id, req.user!.id);

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  });

  markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      type: req.query.type as NotificationType,
      priority: req.query.priority as NotificationPriority
    };

    const count = await this.inAppService.markAllAsRead(req.user!.id, filters);

    res.json({
      success: true,
      message: `Marked ${count} notifications as read`,
      data: { count }
    });
  });

  deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    await this.inAppService.deleteNotification(id, req.user!.id);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  });

  getNotificationStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await this.inAppService.getNotificationStats(req.user!.id);

    res.json({
      success: true,
      data: { stats }
    });
  });

  searchNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      throw createError('Search query is required', 400);
    }

    const filters = {
      type: req.query.type as NotificationType,
      priority: req.query.priority as NotificationPriority,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined
    };

    const notifications = await this.inAppService.searchNotifications(req.user!.id, query, filters);

    res.json({
      success: true,
      data: { notifications }
    });
  });

  // Notification Preference Endpoints
  getPreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
    const preferences = await this.preferenceService.getUserPreferences(req.user!.id);

    res.json({
      success: true,
      data: { preferences }
    });
  });

  updatePreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
    const validatedData = this.updatePreferencesSchema.parse(req.body);

    const preferences = await this.preferenceService.updatePreferences(
      req.user!.id, 
      validatedData
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences }
    });
  });

  resetPreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
    const preferences = await this.preferenceService.resetToDefaults(req.user!.id);

    res.json({
      success: true,
      message: 'Preferences reset to defaults',
      data: { preferences }
    });
  });

  setQuietHours = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      throw createError('Start time and end time are required', 400);
    }

    const preferences = await this.preferenceService.setQuietHours(
      req.user!.id, 
      startTime, 
      endTime
    );

    res.json({
      success: true,
      message: 'Quiet hours set successfully',
      data: { preferences }
    });
  });

  disableQuietHours = asyncHandler(async (req: AuthRequest, res: Response) => {
    const preferences = await this.preferenceService.disableQuietHours(req.user!.id);

    res.json({
      success: true,
      message: 'Quiet hours disabled',
      data: { preferences }
    });
  });

  getTimezoneInfo = asyncHandler(async (req: AuthRequest, res: Response) => {
    const timezoneInfo = await this.preferenceService.getTimezoneInfo(req.user!.id);

    res.json({
      success: true,
      data: { timezoneInfo }
    });
  });

  // Task Notification Endpoints
  sendTaskAssignment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = this.taskNotificationSchema.parse(req.body);
    const options = this.notificationOptionsSchema.parse(req.body.options || {});

    await this.taskNotificationService.notifyTaskAssigned(payload, options);

    res.json({
      success: true,
      message: 'Task assignment notification sent successfully'
    });
  });

  sendTaskUpdate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = this.taskNotificationSchema.parse(req.body);
    const options = this.notificationOptionsSchema.parse(req.body.options || {});

    await this.taskNotificationService.notifyTaskUpdated(payload, options);

    res.json({
      success: true,
      message: 'Task update notification sent successfully'
    });
  });

  sendTaskCompletion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = this.taskNotificationSchema.parse(req.body);
    const options = this.notificationOptionsSchema.parse(req.body.options || {});

    await this.taskNotificationService.notifyTaskCompleted(payload, options);

    res.json({
      success: true,
      message: 'Task completion notification sent successfully'
    });
  });

  sendDeadlineReminder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = this.taskNotificationSchema.parse(req.body);
    const { hoursUntilDeadline } = req.body;
    const options = this.notificationOptionsSchema.parse(req.body.options || {});

    if (!hoursUntilDeadline || typeof hoursUntilDeadline !== 'number') {
      throw createError('Hours until deadline is required', 400);
    }

    await this.taskNotificationService.notifyTaskDeadlineReminder(payload, hoursUntilDeadline, options);

    res.json({
      success: true,
      message: 'Deadline reminder notification sent successfully'
    });
  });

  sendOverdueTask = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = this.taskNotificationSchema.parse(req.body);
    const { daysOverdue } = req.body;
    const options = this.notificationOptionsSchema.parse(req.body.options || {});

    if (!daysOverdue || typeof daysOverdue !== 'number') {
      throw createError('Days overdue is required', 400);
    }

    await this.taskNotificationService.notifyTaskOverdue(payload, daysOverdue, options);

    res.json({
      success: true,
      message: 'Overdue task notification sent successfully'
    });
  });

  sendTaskEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = this.taskNotificationSchema.parse(req.body);
    const { escalationReason } = req.body;
    const options = this.notificationOptionsSchema.parse(req.body.options || {});

    if (!escalationReason || typeof escalationReason !== 'string') {
      throw createError('Escalation reason is required', 400);
    }

    await this.taskNotificationService.notifyTaskEscalation(payload, escalationReason, options);

    res.json({
      success: true,
      message: 'Task escalation notification sent successfully'
    });
  });

  sendDependencyBlocked = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = this.taskNotificationSchema.parse(req.body);
    const { blockedByTaskTitle } = req.body;
    const options = this.notificationOptionsSchema.parse(req.body.options || {});

    if (!blockedByTaskTitle || typeof blockedByTaskTitle !== 'string') {
      throw createError('Blocked by task title is required', 400);
    }

    await this.taskNotificationService.notifyDependencyBlocked(payload, blockedByTaskTitle, options);

    res.json({
      success: true,
      message: 'Dependency blocked notification sent successfully'
    });
  });

  // Email Queue Management (Admin only)
  processEmailQueue = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const { batchSize } = req.query;
    const size = batchSize ? parseInt(batchSize as string) : 50;

    await this.emailService.processEmailQueue(size);

    res.json({
      success: true,
      message: `Email queue processed with batch size ${size}`
    });
  });

  retryFailedEmails = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const { maxRetries } = req.query;
    const retries = maxRetries ? parseInt(maxRetries as string) : 3;

    await this.emailService.retryFailedEmails(retries);

    res.json({
      success: true,
      message: `Failed emails queued for retry (max ${retries} retries)`
    });
  });

  // Cleanup Operations (Admin only)
  cleanupExpiredNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const count = await this.inAppService.deleteExpiredNotifications();

    res.json({
      success: true,
      message: `Cleaned up ${count} expired notifications`
    });
  });

  cleanupOldNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const { daysToKeep } = req.query;
    const days = daysToKeep ? parseInt(daysToKeep as string) : 90;

    const count = await this.inAppService.cleanupOldNotifications(days);

    res.json({
      success: true,
      message: `Cleaned up ${count} old notifications (older than ${days} days)`
    });
  });

  // Bulk Notification Operations (Admin only)
  sendBulkNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const { 
      notificationType, 
      channel, 
      title, 
      message, 
      filters 
    } = req.body;

    if (!notificationType || !title || !message) {
      throw createError('Notification type, title, and message are required', 400);
    }

    const userIds = await this.preferenceService.getUsersForBulkNotification(
      notificationType, 
      channel || 'inApp',
      filters
    );

    if (userIds.length === 0) {
      res.json({
        success: true,
        message: 'No users found for this notification',
        data: { recipientCount: 0 }
      });
      return;
    }

    // Create bulk notifications
    const notificationRequests = userIds.map(userId => ({
      userId,
      type: notificationType as NotificationType,
      title,
      message,
      priority: NotificationPriority.MEDIUM
    }));

    const notifications = await this.inAppService.createBulkNotifications(notificationRequests);

    res.json({
      success: true,
      message: `Bulk notification sent to ${userIds.length} users`,
      data: { 
        recipientCount: userIds.length,
        notificationCount: notifications.length 
      }
    });
  });

  // Notification Delivery Check
  checkDeliveryStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { notificationType, channel } = req.query;
    const { overrideQuietHours } = req.body;

    if (!notificationType || typeof notificationType !== 'string') {
      throw createError('Notification type is required', 400);
    }

    const deliveryCheck = await this.preferenceService.canDeliverNotification(
      req.user!.id,
      notificationType,
      (channel as 'email' | 'inApp') || 'inApp',
      overrideQuietHours
    );

    res.json({
      success: true,
      data: { deliveryCheck }
    });
  });
}