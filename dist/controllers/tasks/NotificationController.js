"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const tsyringe_1 = require("tsyringe");
const zod_1 = require("zod");
const TaskNotificationService_1 = require("../services/tasks/TaskNotificationService");
const EmailNotificationService_1 = require("../services/tasks/EmailNotificationService");
const InAppNotificationService_1 = require("../services/tasks/InAppNotificationService");
const NotificationPreferenceService_1 = require("../services/tasks/NotificationPreferenceService");
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const client_1 = require("@prisma/client");
let NotificationController = class NotificationController {
    constructor(taskNotificationService, emailService, inAppService, preferenceService, db) {
        this.taskNotificationService = taskNotificationService;
        this.emailService = emailService;
        this.inAppService = inAppService;
        this.preferenceService = preferenceService;
        this.db = db;
        this.createNotificationSchema = zod_1.z.object({
            type: zod_1.z.nativeEnum(client_1.NotificationType),
            title: zod_1.z.string().min(1, 'Title is required'),
            message: zod_1.z.string().min(1, 'Message is required'),
            priority: zod_1.z.nativeEnum(client_1.NotificationPriority).optional(),
            data: zod_1.z.record(zod_1.z.any()).optional(),
            expiresAt: zod_1.z.string().datetime().optional()
        });
        this.updatePreferencesSchema = zod_1.z.object({
            emailEnabled: zod_1.z.boolean().optional(),
            inAppEnabled: zod_1.z.boolean().optional(),
            taskAssignment: zod_1.z.boolean().optional(),
            taskDeadline: zod_1.z.boolean().optional(),
            taskCompletion: zod_1.z.boolean().optional(),
            taskEscalation: zod_1.z.boolean().optional(),
            caseUpdates: zod_1.z.boolean().optional(),
            messages: zod_1.z.boolean().optional(),
            emailFrequency: zod_1.z.nativeEnum(client_1.EmailFrequency).optional(),
            quietHoursStart: zod_1.z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
            quietHoursEnd: zod_1.z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
            timezone: zod_1.z.string().optional()
        });
        this.taskNotificationSchema = zod_1.z.object({
            taskId: zod_1.z.string().min(1, 'Task ID is required'),
            taskTitle: zod_1.z.string().min(1, 'Task title is required'),
            caseId: zod_1.z.string().min(1, 'Case ID is required'),
            caseTitle: zod_1.z.string().min(1, 'Case title is required'),
            assignedTo: zod_1.z.string().min(1, 'Assigned to is required'),
            assignedBy: zod_1.z.string().min(1, 'Assigned by is required'),
            dueDate: zod_1.z.string().datetime().optional(),
            status: zod_1.z.nativeEnum(client_1.TaskStatus),
            priority: zod_1.z.nativeEnum(client_1.TaskPriority),
            oldStatus: zod_1.z.nativeEnum(client_1.TaskStatus).optional(),
            oldPriority: zod_1.z.nativeEnum(client_1.TaskPriority).optional(),
            assigneeName: zod_1.z.string().min(1, 'Assignee name is required'),
            creatorName: zod_1.z.string().min(1, 'Creator name is required'),
            caseType: zod_1.z.string().min(1, 'Case type is required'),
            metadata: zod_1.z.record(zod_1.z.any()).optional()
        });
        this.notificationOptionsSchema = zod_1.z.object({
            sendEmail: zod_1.z.boolean().optional(),
            sendInApp: zod_1.z.boolean().optional(),
            isEscalation: zod_1.z.boolean().optional(),
            quietHoursOverride: zod_1.z.boolean().optional()
        });
        this.createNotification = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const validatedData = this.createNotificationSchema.parse(req.body);
            const notificationRequest = {
                userId: req.user.id,
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
        this.getNotifications = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const filters = {
                type: req.query.type,
                priority: req.query.priority,
                isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
                fromDate: req.query.fromDate ? new Date(req.query.fromDate) : undefined,
                toDate: req.query.toDate ? new Date(req.query.toDate) : undefined,
                expiresOnly: req.query.expiresOnly === 'true'
            };
            const notifications = await this.inAppService.getNotifications(req.user.id, filters);
            res.json({
                success: true,
                data: { notifications }
            });
        });
        this.getUnreadNotifications = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
            const notifications = await this.inAppService.getUnreadNotifications(req.user.id, limit);
            res.json({
                success: true,
                data: { notifications }
            });
        });
        this.getNotificationById = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const notification = await this.inAppService.getNotificationById(id, req.user.id);
            res.json({
                success: true,
                data: { notification }
            });
        });
        this.markAsRead = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const notification = await this.inAppService.markAsRead(id, req.user.id);
            res.json({
                success: true,
                message: 'Notification marked as read',
                data: { notification }
            });
        });
        this.markAllAsRead = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const filters = {
                type: req.query.type,
                priority: req.query.priority
            };
            const count = await this.inAppService.markAllAsRead(req.user.id, filters);
            res.json({
                success: true,
                message: `Marked ${count} notifications as read`,
                data: { count }
            });
        });
        this.deleteNotification = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.inAppService.deleteNotification(id, req.user.id);
            res.json({
                success: true,
                message: 'Notification deleted successfully'
            });
        });
        this.getNotificationStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const stats = await this.inAppService.getNotificationStats(req.user.id);
            res.json({
                success: true,
                data: { stats }
            });
        });
        this.searchNotifications = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { query } = req.query;
            if (!query || typeof query !== 'string') {
                throw (0, errorHandler_1.createError)('Search query is required', 400);
            }
            const filters = {
                type: req.query.type,
                priority: req.query.priority,
                isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined
            };
            const notifications = await this.inAppService.searchNotifications(req.user.id, query, filters);
            res.json({
                success: true,
                data: { notifications }
            });
        });
        this.getPreferences = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const preferences = await this.preferenceService.getUserPreferences(req.user.id);
            res.json({
                success: true,
                data: { preferences }
            });
        });
        this.updatePreferences = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const validatedData = this.updatePreferencesSchema.parse(req.body);
            const preferences = await this.preferenceService.updatePreferences(req.user.id, validatedData);
            res.json({
                success: true,
                message: 'Preferences updated successfully',
                data: { preferences }
            });
        });
        this.resetPreferences = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const preferences = await this.preferenceService.resetToDefaults(req.user.id);
            res.json({
                success: true,
                message: 'Preferences reset to defaults',
                data: { preferences }
            });
        });
        this.setQuietHours = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { startTime, endTime } = req.body;
            if (!startTime || !endTime) {
                throw (0, errorHandler_1.createError)('Start time and end time are required', 400);
            }
            const preferences = await this.preferenceService.setQuietHours(req.user.id, startTime, endTime);
            res.json({
                success: true,
                message: 'Quiet hours set successfully',
                data: { preferences }
            });
        });
        this.disableQuietHours = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const preferences = await this.preferenceService.disableQuietHours(req.user.id);
            res.json({
                success: true,
                message: 'Quiet hours disabled',
                data: { preferences }
            });
        });
        this.getTimezoneInfo = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const timezoneInfo = await this.preferenceService.getTimezoneInfo(req.user.id);
            res.json({
                success: true,
                data: { timezoneInfo }
            });
        });
        this.sendTaskAssignment = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const payload = this.taskNotificationSchema.parse(req.body);
            const options = this.notificationOptionsSchema.parse(req.body.options || {});
            await this.taskNotificationService.notifyTaskAssigned(payload, options);
            res.json({
                success: true,
                message: 'Task assignment notification sent successfully'
            });
        });
        this.sendTaskUpdate = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const payload = this.taskNotificationSchema.parse(req.body);
            const options = this.notificationOptionsSchema.parse(req.body.options || {});
            await this.taskNotificationService.notifyTaskUpdated(payload, options);
            res.json({
                success: true,
                message: 'Task update notification sent successfully'
            });
        });
        this.sendTaskCompletion = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const payload = this.taskNotificationSchema.parse(req.body);
            const options = this.notificationOptionsSchema.parse(req.body.options || {});
            await this.taskNotificationService.notifyTaskCompleted(payload, options);
            res.json({
                success: true,
                message: 'Task completion notification sent successfully'
            });
        });
        this.sendDeadlineReminder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const payload = this.taskNotificationSchema.parse(req.body);
            const { hoursUntilDeadline } = req.body;
            const options = this.notificationOptionsSchema.parse(req.body.options || {});
            if (!hoursUntilDeadline || typeof hoursUntilDeadline !== 'number') {
                throw (0, errorHandler_1.createError)('Hours until deadline is required', 400);
            }
            await this.taskNotificationService.notifyTaskDeadlineReminder(payload, hoursUntilDeadline, options);
            res.json({
                success: true,
                message: 'Deadline reminder notification sent successfully'
            });
        });
        this.sendOverdueTask = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const payload = this.taskNotificationSchema.parse(req.body);
            const { daysOverdue } = req.body;
            const options = this.notificationOptionsSchema.parse(req.body.options || {});
            if (!daysOverdue || typeof daysOverdue !== 'number') {
                throw (0, errorHandler_1.createError)('Days overdue is required', 400);
            }
            await this.taskNotificationService.notifyTaskOverdue(payload, daysOverdue, options);
            res.json({
                success: true,
                message: 'Overdue task notification sent successfully'
            });
        });
        this.sendTaskEscalation = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const payload = this.taskNotificationSchema.parse(req.body);
            const { escalationReason } = req.body;
            const options = this.notificationOptionsSchema.parse(req.body.options || {});
            if (!escalationReason || typeof escalationReason !== 'string') {
                throw (0, errorHandler_1.createError)('Escalation reason is required', 400);
            }
            await this.taskNotificationService.notifyTaskEscalation(payload, escalationReason, options);
            res.json({
                success: true,
                message: 'Task escalation notification sent successfully'
            });
        });
        this.sendDependencyBlocked = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const payload = this.taskNotificationSchema.parse(req.body);
            const { blockedByTaskTitle } = req.body;
            const options = this.notificationOptionsSchema.parse(req.body.options || {});
            if (!blockedByTaskTitle || typeof blockedByTaskTitle !== 'string') {
                throw (0, errorHandler_1.createError)('Blocked by task title is required', 400);
            }
            await this.taskNotificationService.notifyDependencyBlocked(payload, blockedByTaskTitle, options);
            res.json({
                success: true,
                message: 'Dependency blocked notification sent successfully'
            });
        });
        this.processEmailQueue = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const { batchSize } = req.query;
            const size = batchSize ? parseInt(batchSize) : 50;
            await this.emailService.processEmailQueue(size);
            res.json({
                success: true,
                message: `Email queue processed with batch size ${size}`
            });
        });
        this.retryFailedEmails = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const { maxRetries } = req.query;
            const retries = maxRetries ? parseInt(maxRetries) : 3;
            await this.emailService.retryFailedEmails(retries);
            res.json({
                success: true,
                message: `Failed emails queued for retry (max ${retries} retries)`
            });
        });
        this.cleanupExpiredNotifications = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const count = await this.inAppService.deleteExpiredNotifications();
            res.json({
                success: true,
                message: `Cleaned up ${count} expired notifications`
            });
        });
        this.cleanupOldNotifications = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const { daysToKeep } = req.query;
            const days = daysToKeep ? parseInt(daysToKeep) : 90;
            const count = await this.inAppService.cleanupOldNotifications(days);
            res.json({
                success: true,
                message: `Cleaned up ${count} old notifications (older than ${days} days)`
            });
        });
        this.sendBulkNotification = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const { notificationType, channel, title, message, filters } = req.body;
            if (!notificationType || !title || !message) {
                throw (0, errorHandler_1.createError)('Notification type, title, and message are required', 400);
            }
            const userIds = await this.preferenceService.getUsersForBulkNotification(notificationType, channel || 'inApp', filters);
            if (userIds.length === 0) {
                res.json({
                    success: true,
                    message: 'No users found for this notification',
                    data: { recipientCount: 0 }
                });
                return;
            }
            const notificationRequests = userIds.map(userId => ({
                userId,
                type: notificationType,
                title,
                message,
                priority: client_1.NotificationPriority.MEDIUM
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
        this.checkDeliveryStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { notificationType, channel } = req.query;
            const { overrideQuietHours } = req.body;
            if (!notificationType || typeof notificationType !== 'string') {
                throw (0, errorHandler_1.createError)('Notification type is required', 400);
            }
            const deliveryCheck = await this.preferenceService.canDeliverNotification(req.user.id, notificationType, channel || 'inApp', overrideQuietHours);
            res.json({
                success: true,
                data: { deliveryCheck }
            });
        });
    }
};
exports.NotificationController = NotificationController;
exports.NotificationController = NotificationController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(TaskNotificationService_1.TaskNotificationService)),
    __param(1, (0, tsyringe_1.inject)(EmailNotificationService_1.EmailNotificationService)),
    __param(2, (0, tsyringe_1.inject)(InAppNotificationService_1.InAppNotificationService)),
    __param(3, (0, tsyringe_1.inject)(NotificationPreferenceService_1.NotificationPreferenceService)),
    __param(4, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [typeof (_a = typeof TaskNotificationService_1.TaskNotificationService !== "undefined" && TaskNotificationService_1.TaskNotificationService) === "function" ? _a : Object, typeof (_b = typeof EmailNotificationService_1.EmailNotificationService !== "undefined" && EmailNotificationService_1.EmailNotificationService) === "function" ? _b : Object, typeof (_c = typeof InAppNotificationService_1.InAppNotificationService !== "undefined" && InAppNotificationService_1.InAppNotificationService) === "function" ? _c : Object, typeof (_d = typeof NotificationPreferenceService_1.NotificationPreferenceService !== "undefined" && NotificationPreferenceService_1.NotificationPreferenceService) === "function" ? _d : Object, typeof (_e = typeof database_1.Database !== "undefined" && database_1.Database) === "function" ? _e : Object])
], NotificationController);
//# sourceMappingURL=NotificationController.js.map