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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskNotificationService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
const NotificationPreferenceService_1 = require("./NotificationPreferenceService");
const EmailNotificationService_1 = require("./EmailNotificationService");
const InAppNotificationService_1 = require("./InAppNotificationService");
const websocket_1 = require("../../services/websocket");
let TaskNotificationService = class TaskNotificationService {
    constructor(db, preferenceService, emailService, inAppService, wsService) {
        this.db = db;
        this.preferenceService = preferenceService;
        this.emailService = emailService;
        this.inAppService = inAppService;
        this.wsService = wsService;
    }
    async notifyTaskAssigned(payload, options = {}) {
        const { sendEmail = true, sendInApp = true } = options;
        const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
        const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
        if (!canNotify) {
            await this.queueForLater(payload.assignedTo, client_1.NotificationType.TASK_ASSIGNED, payload);
            return;
        }
        const title = `新任务分配: ${payload.taskTitle}`;
        const message = `您被分配了一个新任务 "${payload.taskTitle}" 在案件 "${payload.caseTitle}" 中`;
        const notificationData = {
            userId: payload.assignedTo,
            type: client_1.NotificationType.TASK_ASSIGNED,
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
        if (sendInApp && preferences.inAppEnabled && preferences.taskAssignment) {
            await this.inAppService.createNotification(notificationData);
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
        if (sendEmail && preferences.emailEnabled && preferences.taskAssignment) {
            await this.emailService.sendTaskAssignmentEmail(payload, preferences);
        }
    }
    async notifyTaskUpdated(payload, options = {}) {
        const { sendEmail = true, sendInApp = true } = options;
        const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
        const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
        if (!canNotify) {
            await this.queueForLater(payload.assignedTo, client_1.NotificationType.TASK_UPDATED, payload);
            return;
        }
        let title = '';
        let message = '';
        if (payload.oldStatus && payload.oldStatus !== payload.status) {
            title = `任务状态更新: ${payload.taskTitle}`;
            message = `任务 "${payload.taskTitle}" 的状态已从 ${this.getStatusLabel(payload.oldStatus)} 更改为 ${this.getStatusLabel(payload.status)}`;
        }
        else if (payload.oldPriority && payload.oldPriority !== payload.priority) {
            title = `任务优先级更新: ${payload.taskTitle}`;
            message = `任务 "${payload.taskTitle}" 的优先级已更改为 ${this.getPriorityLabel(payload.priority)}`;
        }
        else {
            title = `任务更新: ${payload.taskTitle}`;
            message = `任务 "${payload.taskTitle}" 已更新`;
        }
        const notificationData = {
            userId: payload.assignedTo,
            type: client_1.NotificationType.TASK_UPDATED,
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
    async notifyTaskCompleted(payload, options = {}) {
        const { sendEmail = true, sendInApp = true } = options;
        const assigneePreferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
        const canNotifyAssignee = await this.checkQuietHours(payload.assignedTo, assigneePreferences, options.quietHoursOverride);
        if (canNotifyAssignee) {
            const assigneeTitle = `任务完成: ${payload.taskTitle}`;
            const assigneeMessage = `您已完成任务 "${payload.taskTitle}"`;
            if (sendInApp && assigneePreferences.inAppEnabled && assigneePreferences.taskCompletion) {
                await this.inAppService.createNotification({
                    userId: payload.assignedTo,
                    type: client_1.NotificationType.TASK_COMPLETED,
                    title: assigneeTitle,
                    message: assigneeMessage,
                    priority: client_1.NotificationPriority.MEDIUM,
                    data: {
                        taskId: payload.taskId,
                        caseId: payload.caseId,
                        completedAt: new Date(),
                        ...payload.metadata
                    }
                });
            }
        }
        const creatorPreferences = await this.preferenceService.getUserPreferences(payload.assignedBy);
        const canNotifyCreator = await this.checkQuietHours(payload.assignedBy, creatorPreferences, options.quietHoursOverride);
        if (canNotifyCreator && payload.assignedTo !== payload.assignedBy) {
            const creatorTitle = `任务已完成: ${payload.taskTitle}`;
            const creatorMessage = `${payload.assigneeName} 已完成任务 "${payload.taskTitle}"`;
            if (sendInApp && creatorPreferences.inAppEnabled && creatorPreferences.taskCompletion) {
                await this.inAppService.createNotification({
                    userId: payload.assignedBy,
                    type: client_1.NotificationType.TASK_COMPLETED,
                    title: creatorTitle,
                    message: creatorMessage,
                    priority: client_1.NotificationPriority.MEDIUM,
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
    async notifyTaskDeadlineReminder(payload, hoursUntilDeadline, options = {}) {
        const { sendEmail = true, sendInApp = true } = options;
        const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
        const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
        if (!canNotify) {
            await this.queueForLater(payload.assignedTo, client_1.NotificationType.TASK_DEADLINE_REMINDER, payload);
            return;
        }
        const urgency = hoursUntilDeadline <= 24 ? '紧急' : hoursUntilDeadline <= 72 ? '即将到期' : '提醒';
        const title = `${urgency}任务截止日期: ${payload.taskTitle}`;
        const message = `任务 "${payload.taskTitle}" 将在 ${hoursUntilDeadline} 小时后到期`;
        const priority = hoursUntilDeadline <= 24 ? client_1.NotificationPriority.URGENT :
            hoursUntilDeadline <= 72 ? client_1.NotificationPriority.HIGH :
                client_1.NotificationPriority.MEDIUM;
        if (sendInApp && preferences.inAppEnabled && preferences.taskDeadline) {
            await this.inAppService.createNotification({
                userId: payload.assignedTo,
                type: client_1.NotificationType.TASK_DEADLINE_REMINDER,
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
    async notifyTaskOverdue(payload, daysOverdue, options = {}) {
        const { sendEmail = true, sendInApp = true, isEscalation = false } = options;
        const assigneePreferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
        const canNotifyAssignee = await this.checkQuietHours(payload.assignedTo, assigneePreferences, options.quietHoursOverride);
        if (canNotifyAssignee) {
            const title = `任务逾期: ${payload.taskTitle}`;
            const message = `任务 "${payload.taskTitle}" 已逾期 ${daysOverdue} 天`;
            if (sendInApp && assigneePreferences.inAppEnabled && assigneePreferences.taskDeadline) {
                await this.inAppService.createNotification({
                    userId: payload.assignedTo,
                    type: client_1.NotificationType.OVERDUE_TASK,
                    title,
                    message,
                    priority: client_1.NotificationPriority.HIGH,
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
        if (isEscalation && daysOverdue >= 3) {
            await this.escalateOverdueTask(payload, daysOverdue, assigneePreferences);
        }
        if (sendEmail && assigneePreferences.emailEnabled && assigneePreferences.taskDeadline) {
            await this.emailService.sendOverdueTaskEmail(payload, daysOverdue, assigneePreferences);
        }
    }
    async notifyTaskEscalation(payload, escalationReason, options = {}) {
        const { sendEmail = true, sendInApp = true } = options;
        const adminUsers = await this.db.client.user.findMany({
            where: { role: client_1.UserRole.ADMIN },
            select: { id: true, email: true, firstName: true, lastName: true }
        });
        for (const admin of adminUsers) {
            const preferences = await this.preferenceService.getUserPreferences(admin.id);
            const canNotify = await this.checkQuietHours(admin.id, preferences, options.quietHoursOverride);
            if (!canNotify)
                continue;
            const title = `任务升级: ${payload.taskTitle}`;
            const message = `任务 "${payload.taskTitle}" 需要关注: ${escalationReason}`;
            if (sendInApp && preferences.inAppEnabled && preferences.taskEscalation) {
                await this.inAppService.createNotification({
                    userId: admin.id,
                    type: client_1.NotificationType.TASK_ESCALATION,
                    title,
                    message,
                    priority: client_1.NotificationPriority.URGENT,
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
    async notifyDependencyBlocked(payload, blockedByTaskTitle, options = {}) {
        const { sendEmail = true, sendInApp = true } = options;
        const preferences = await this.preferenceService.getUserPreferences(payload.assignedTo);
        const canNotify = await this.checkQuietHours(payload.assignedTo, preferences, options.quietHoursOverride);
        if (!canNotify) {
            await this.queueForLater(payload.assignedTo, client_1.NotificationType.DEPENDENCY_BLOCKED, payload);
            return;
        }
        const title = `任务被阻止: ${payload.taskTitle}`;
        const message = `任务 "${payload.taskTitle}" 被依赖任务 "${blockedByTaskTitle}" 阻止`;
        if (sendInApp && preferences.inAppEnabled) {
            await this.inAppService.createNotification({
                userId: payload.assignedTo,
                type: client_1.NotificationType.DEPENDENCY_BLOCKED,
                title,
                message,
                priority: client_1.NotificationPriority.HIGH,
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
    async escalateOverdueTask(payload, daysOverdue, assigneePreferences) {
        const adminUsers = await this.db.client.user.findMany({
            where: { role: client_1.UserRole.ADMIN },
            select: { id: true, email: true, firstName: true, lastName: true }
        });
        for (const admin of adminUsers) {
            const adminPreferences = await this.preferenceService.getUserPreferences(admin.id);
            if (adminPreferences.inAppEnabled && adminPreferences.taskEscalation) {
                const title = `严重逾期任务: ${payload.taskTitle}`;
                const message = `任务 "${payload.taskTitle}" 已逾期 ${daysOverdue} 天，需要立即关注`;
                await this.inAppService.createNotification({
                    userId: admin.id,
                    type: client_1.NotificationType.TASK_ESCALATION,
                    title,
                    message,
                    priority: client_1.NotificationPriority.URGENT,
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
    async checkQuietHours(userId, preferences, override = false) {
        if (override)
            return true;
        if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
            return true;
        }
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const startTime = preferences.quietHoursStart;
        const endTime = preferences.quietHoursEnd;
        if (startTime <= endTime) {
            return currentTime < startTime || currentTime >= endTime;
        }
        else {
            return currentTime < startTime && currentTime >= endTime;
        }
    }
    async queueForLater(userId, type, payload) {
        console.log(`Notification queued for user ${userId} during quiet hours:`, { type, payload });
    }
    mapTaskPriorityToNotificationPriority(taskPriority) {
        switch (taskPriority) {
            case client_1.TaskPriority.URGENT:
                return client_1.NotificationPriority.URGENT;
            case client_1.TaskPriority.HIGH:
                return client_1.NotificationPriority.HIGH;
            case client_1.TaskPriority.MEDIUM:
                return client_1.NotificationPriority.MEDIUM;
            case client_1.TaskPriority.LOW:
                return client_1.NotificationPriority.LOW;
            default:
                return client_1.NotificationPriority.MEDIUM;
        }
    }
    getStatusLabel(status) {
        const labels = {
            [client_1.TaskStatus.PENDING]: '待处理',
            [client_1.TaskStatus.IN_PROGRESS]: '进行中',
            [client_1.TaskStatus.COMPLETED]: '已完成',
            [client_1.TaskStatus.CANCELLED]: '已取消'
        };
        return labels[status] || status;
    }
    getPriorityLabel(priority) {
        const labels = {
            [client_1.TaskPriority.LOW]: '低',
            [client_1.TaskPriority.MEDIUM]: '中',
            [client_1.TaskPriority.HIGH]: '高',
            [client_1.TaskPriority.URGENT]: '紧急'
        };
        return labels[priority] || priority;
    }
};
exports.TaskNotificationService = TaskNotificationService;
exports.TaskNotificationService = TaskNotificationService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __param(1, (0, tsyringe_1.inject)(NotificationPreferenceService_1.NotificationPreferenceService)),
    __param(2, (0, tsyringe_1.inject)(EmailNotificationService_1.EmailNotificationService)),
    __param(3, (0, tsyringe_1.inject)(InAppNotificationService_1.InAppNotificationService)),
    __param(4, (0, tsyringe_1.inject)(websocket_1.WebSocketService)),
    __metadata("design:paramtypes", [database_1.Database,
        NotificationPreferenceService_1.NotificationPreferenceService,
        EmailNotificationService_1.EmailNotificationService,
        InAppNotificationService_1.InAppNotificationService,
        websocket_1.WebSocketService])
], TaskNotificationService);
//# sourceMappingURL=TaskNotificationService.js.map