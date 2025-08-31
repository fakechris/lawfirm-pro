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
exports.NotificationPreferenceService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
let NotificationPreferenceService = class NotificationPreferenceService {
    constructor(db) {
        this.db = db;
    }
    async getUserPreferences(userId) {
        let preferences = await this.db.client.notificationPreference.findUnique({
            where: { userId }
        });
        if (!preferences) {
            preferences = await this.createDefaultPreferences(userId);
        }
        return this.mapPreferencesToResponse(preferences);
    }
    async updatePreferences(userId, updates) {
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
    async canDeliverNotification(userId, notificationType, channel = 'inApp', overrideQuietHours = false) {
        const preferences = await this.getUserPreferences(userId);
        const check = {
            canDeliverEmail: false,
            canDeliverInApp: false,
            quietHoursActive: false
        };
        if (channel === 'email' && !preferences.emailEnabled) {
            check.reason = 'Email notifications are disabled';
            return check;
        }
        if (channel === 'inApp' && !preferences.inAppEnabled) {
            check.reason = 'In-app notifications are disabled';
            return check;
        }
        const typeEnabled = this.isNotificationTypeEnabled(notificationType, preferences);
        if (!typeEnabled) {
            check.reason = `${notificationType} notifications are disabled`;
            return check;
        }
        if (!overrideQuietHours) {
            const quietHoursActive = this.isQuietHoursActive(preferences);
            check.quietHoursActive = quietHoursActive;
            if (quietHoursActive) {
                check.reason = 'Quiet hours are active';
                check.nextDeliveryWindow = this.getNextDeliveryWindow(preferences);
                if (channel === 'email' && preferences.emailFrequency !== client_1.EmailFrequency.IMMEDIATE) {
                    check.reason = 'Email frequency settings prevent immediate delivery';
                    check.canDeliverEmail = false;
                    check.canDeliverInApp = true;
                    return check;
                }
                if (channel === 'inApp') {
                    const isUrgent = this.isUrgentNotificationType(notificationType);
                    if (!isUrgent) {
                        check.canDeliverInApp = false;
                        return check;
                    }
                }
            }
        }
        if (channel === 'email') {
            check.canDeliverEmail = true;
        }
        if (channel === 'inApp') {
            check.canDeliverInApp = true;
        }
        return check;
    }
    async getUsersForBulkNotification(notificationType, channel = 'inApp', filters) {
        let userIds = [];
        const userWhereClause = {};
        if (filters?.roles && filters.roles.length > 0) {
            userWhereClause.role = { in: filters.roles };
        }
        if (filters?.caseId) {
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
        for (const user of users) {
            const deliveryCheck = await this.canDeliverNotification(user.id, notificationType, channel);
            if (channel === 'email' && deliveryCheck.canDeliverEmail) {
                userIds.push(user.id);
            }
            else if (channel === 'inApp' && deliveryCheck.canDeliverInApp) {
                userIds.push(user.id);
            }
        }
        return userIds;
    }
    async createDefaultPreferences(userId) {
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
                emailFrequency: client_1.EmailFrequency.IMMEDIATE,
                timezone: 'Asia/Shanghai'
            }
        });
    }
    async resetToDefaults(userId) {
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
                emailFrequency: client_1.EmailFrequency.IMMEDIATE,
                quietHoursStart: null,
                quietHoursEnd: null,
                timezone: 'Asia/Shanghai'
            }
        });
        return this.mapPreferencesToResponse(updatedPreferences);
    }
    async getUserEmailFrequency(userId) {
        const preferences = await this.getUserPreferences(userId);
        return preferences.emailFrequency;
    }
    async setUserEmailFrequency(userId, frequency) {
        return await this.updatePreferences(userId, { emailFrequency: frequency });
    }
    async setQuietHours(userId, startTime, endTime) {
        this.validateQuietHoursFormat(startTime, endTime);
        return await this.updatePreferences(userId, {
            quietHoursStart: startTime,
            quietHoursEnd: endTime
        });
    }
    async disableQuietHours(userId) {
        return await this.updatePreferences(userId, {
            quietHoursStart: null,
            quietHoursEnd: null
        });
    }
    async getTimezoneInfo(userId) {
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
    validateQuietHoursFormat(startTime, endTime) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (startTime && !timeRegex.test(startTime)) {
            throw new Error('Invalid quiet hours start time format. Use HH:mm format.');
        }
        if (endTime && !timeRegex.test(endTime)) {
            throw new Error('Invalid quiet hours end time format. Use HH:mm format.');
        }
    }
    isQuietHoursActive(preferences) {
        if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
            return false;
        }
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const startTime = preferences.quietHoursStart;
        const endTime = preferences.quietHoursEnd;
        if (startTime <= endTime) {
            return currentTime >= startTime && currentTime < endTime;
        }
        else {
            return currentTime >= startTime || currentTime < endTime;
        }
    }
    getNextDeliveryWindow(preferences) {
        if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
            return new Date();
        }
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const startTime = preferences.quietHoursStart;
        const endTime = preferences.quietHoursEnd;
        if (this.isQuietHoursActive(preferences)) {
            const nextDelivery = new Date(now);
            if (startTime <= endTime) {
                const [endHour, endMinute] = endTime.split(':').map(Number);
                nextDelivery.setHours(endHour, endMinute, 0, 0);
                if (nextDelivery <= now) {
                    nextDelivery.setDate(nextDelivery.getDate() + 1);
                }
            }
            else {
                const [endHour, endMinute] = endTime.split(':').map(Number);
                nextDelivery.setHours(endHour, endMinute, 0, 0);
                if (nextDelivery <= now) {
                    nextDelivery.setDate(nextDelivery.getDate() + 1);
                }
            }
            return nextDelivery;
        }
        return now;
    }
    isNotificationTypeEnabled(notificationType, preferences) {
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
                return true;
        }
    }
    isUrgentNotificationType(notificationType) {
        const urgentTypes = [
            'TASK_ESCALATION',
            'OVERDUE_TASK',
            'URGENT_SYSTEM_ALERT'
        ];
        return urgentTypes.includes(notificationType);
    }
    mapPreferencesToResponse(preferences) {
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
};
exports.NotificationPreferenceService = NotificationPreferenceService;
exports.NotificationPreferenceService = NotificationPreferenceService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], NotificationPreferenceService);
//# sourceMappingURL=NotificationPreferenceService.js.map