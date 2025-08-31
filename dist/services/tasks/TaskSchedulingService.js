"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskSchedulingService = void 0;
const client_1 = require("@prisma/client");
class TaskSchedulingService {
    constructor() {
        this.scheduledTasks = new Map();
        this.calendarEvents = new Map();
        this.reminders = new Map();
        this.userWorkloads = new Map();
        this.scheduleHistory = [];
        this.initializeDefaultReminders();
    }
    initializeDefaultReminders() {
        const defaultReminders = {
            urgent: [
                {
                    id: 'urgent_24h',
                    type: 'email',
                    timeOffset: 24 * 60,
                    recipients: ['assignee', 'supervisor'],
                    message: 'URGENT: Task due in 24 hours - {taskTitle}'
                },
                {
                    id: 'urgent_2h',
                    type: 'in_app',
                    timeOffset: 2 * 60,
                    recipients: ['assignee'],
                    message: 'URGENT: Task due in 2 hours - {taskTitle}'
                }
            ],
            high: [
                {
                    id: 'high_48h',
                    type: 'email',
                    timeOffset: 48 * 60,
                    recipients: ['assignee'],
                    message: 'High priority task due in 2 days - {taskTitle}'
                },
                {
                    id: 'high_24h',
                    type: 'in_app',
                    timeOffset: 24 * 60,
                    recipients: ['assignee'],
                    message: 'High priority task due tomorrow - {taskTitle}'
                }
            ],
            medium: [
                {
                    id: 'medium_72h',
                    type: 'in_app',
                    timeOffset: 72 * 60,
                    recipients: ['assignee'],
                    message: 'Task due in 3 days - {taskTitle}'
                }
            ],
            deadline: [
                {
                    id: 'deadline_7d',
                    type: 'email',
                    timeOffset: 7 * 24 * 60,
                    recipients: ['assignee', 'case_attorney'],
                    message: 'Deadline approaching: {taskTitle} due in 7 days'
                },
                {
                    id: 'deadline_3d',
                    type: 'email',
                    timeOffset: 3 * 24 * 60,
                    recipients: ['assignee', 'supervisor'],
                    message: 'URGENT: Deadline in 3 days - {taskTitle}'
                },
                {
                    id: 'deadline_1d',
                    type: 'sms',
                    timeOffset: 24 * 60,
                    recipients: ['assignee'],
                    message: 'FINAL REMINDER: {taskTitle} due tomorrow'
                }
            ]
        };
        Object.entries(defaultReminders).forEach(([priority, reminders]) => {
            this.reminders.set(priority, reminders);
        });
    }
    scheduleTask(request) {
        const validationErrors = this.validateScheduleRequest(request);
        if (validationErrors.length > 0) {
            throw new Error(`Schedule validation failed: ${validationErrors.join(', ')}`);
        }
        const conflicts = this.checkScheduleConflicts(request);
        if (conflicts.length > 0) {
            const highPriorityConflicts = conflicts.filter(c => c.severity === 'high');
            if (highPriorityConflicts.length > 0) {
                throw new Error(`High priority schedule conflicts: ${highPriorityConflicts.map(c => c.description).join(', ')}`);
            }
        }
        const scheduledTask = {
            id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            taskId: request.taskId,
            caseId: request.caseId,
            title: request.title,
            description: request.description,
            scheduledTime: request.scheduledTime,
            dueDate: request.dueDate,
            priority: request.priority,
            assignedTo: request.assignedTo,
            assignedBy: request.assignedBy,
            status: client_1.TaskStatus.PENDING,
            recurrence: request.recurrence,
            reminderSettings: this.getDefaultReminderSettings(request.priority),
            dependencies: request.dependencies,
            metadata: request.metadata || {}
        };
        this.scheduledTasks.set(scheduledTask.id, scheduledTask);
        this.createCalendarEvent(scheduledTask);
        this.scheduleReminders(scheduledTask);
        this.updateUserWorkload(request.assignedTo, scheduledTask);
        this.logScheduleHistory('task_scheduled', scheduledTask.id, {
            title: scheduledTask.title,
            assignedTo: scheduledTask.assignedTo,
            scheduledTime: scheduledTask.scheduledTime
        });
        return scheduledTask;
    }
    rescheduleTask(taskId, newScheduledTime, newDueDate) {
        const scheduledTask = this.findScheduledTaskByTaskId(taskId);
        if (!scheduledTask) {
            return false;
        }
        const oldScheduledTime = scheduledTask.scheduledTime;
        const oldDueDate = scheduledTask.dueDate;
        scheduledTask.scheduledTime = newScheduledTime;
        if (newDueDate) {
            scheduledTask.dueDate = newDueDate;
        }
        this.deleteCalendarEvent(taskId);
        this.createCalendarEvent(scheduledTask);
        this.cancelReminders(taskId);
        this.scheduleReminders(scheduledTask);
        this.logScheduleHistory('task_rescheduled', scheduledTask.id, {
            title: scheduledTask.title,
            oldScheduledTime,
            newScheduledTime,
            oldDueDate,
            newDueDate: scheduledTask.dueDate
        });
        return true;
    }
    cancelTaskSchedule(taskId) {
        const scheduledTask = this.findScheduledTaskByTaskId(taskId);
        if (!scheduledTask) {
            return false;
        }
        this.scheduledTasks.delete(scheduledTask.id);
        this.deleteCalendarEvent(taskId);
        this.cancelReminders(taskId);
        this.updateUserWorkload(scheduledTask.assignedTo, scheduledTask, true);
        this.logScheduleHistory('task_cancelled', scheduledTask.id, {
            title: scheduledTask.title,
            originalScheduledTime: scheduledTask.scheduledTime
        });
        return true;
    }
    getScheduledTasks(filters) {
        let tasks = Array.from(this.scheduledTasks.values());
        if (filters) {
            if (filters.userId) {
                tasks = tasks.filter(task => task.assignedTo === filters.userId);
            }
            if (filters.caseId) {
                tasks = tasks.filter(task => task.caseId === filters.caseId);
            }
            if (filters.startDate) {
                tasks = tasks.filter(task => task.scheduledTime >= filters.startDate);
            }
            if (filters.endDate) {
                tasks = tasks.filter(task => task.scheduledTime <= filters.endDate);
            }
            if (filters.priority) {
                tasks = tasks.filter(task => task.priority === filters.priority);
            }
            if (filters.status) {
                tasks = tasks.filter(task => task.status === filters.status);
            }
        }
        return tasks.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    }
    getCalendarEvents(userId, startDate, endDate) {
        let events = Array.from(this.calendarEvents.values());
        if (userId) {
            events = events.filter(event => event.attendees.includes(userId));
        }
        if (startDate) {
            events = events.filter(event => event.startTime >= startDate);
        }
        if (endDate) {
            events = events.filter(event => event.endTime <= endDate);
        }
        return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
    getUpcomingReminders(userId, hoursAhead = 24) {
        const now = new Date();
        const endTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
        const upcomingReminders = [];
        this.scheduledTasks.forEach(task => {
            if (userId && task.assignedTo !== userId)
                return;
            const reminders = this.getTaskReminders(task);
            reminders.forEach(reminder => {
                const reminderTime = new Date(task.dueDate.getTime() - reminder.timeOffset * 60 * 1000);
                if (reminderTime >= now && reminderTime <= endTime) {
                    upcomingReminders.push(reminder);
                }
            });
        });
        return upcomingReminders.sort((a, b) => a.timeOffset - b.timeOffset);
    }
    checkScheduleConflicts(request) {
        const conflicts = [];
        const userTasks = this.getScheduledTasks({
            userId: request.assignedTo,
            startDate: new Date(request.scheduledTime.getTime() - 2 * 60 * 60 * 1000),
            endDate: new Date(request.scheduledTime.getTime() + 2 * 60 * 60 * 1000)
        });
        userTasks.forEach(task => {
            if (task.taskId === request.taskId)
                return;
            const timeOverlap = this.checkTimeOverlap(task.scheduledTime, request.scheduledTime);
            if (timeOverlap) {
                conflicts.push({
                    taskId: request.taskId,
                    conflictingTaskId: task.taskId,
                    conflictType: 'time_overlap',
                    severity: 'medium',
                    description: `Time overlap with task "${task.title}"`,
                    suggestedResolution: 'Reschedule one of the tasks to avoid overlap'
                });
            }
        });
        if (request.dependencies) {
            request.dependencies.forEach(depTaskId => {
                const depTask = this.findScheduledTaskByTaskId(depTaskId);
                if (depTask && depTask.dueDate && depTask.dueDate > request.scheduledTime) {
                    conflicts.push({
                        taskId: request.taskId,
                        conflictingTaskId: depTaskId,
                        conflictType: 'dependency_conflict',
                        severity: 'high',
                        description: `Scheduled before dependency "${depTask.title}" is complete`,
                        suggestedResolution: `Reschedule after ${depTask.dueDate.toLocaleDateString()}`
                    });
                }
            });
        }
        return conflicts;
    }
    getScheduleStats(userId, caseId) {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        let tasks = Array.from(this.scheduledTasks.values());
        if (userId) {
            tasks = tasks.filter(task => task.assignedTo === userId);
        }
        if (caseId) {
            tasks = tasks.filter(task => task.caseId === caseId);
        }
        const overdueTasks = tasks.filter(task => task.dueDate && task.dueDate < now && task.status !== client_1.TaskStatus.COMPLETED);
        const upcomingTasks = tasks.filter(task => task.dueDate && task.dueDate >= now && task.dueDate <= nextWeek);
        let totalConflicts = 0;
        tasks.forEach(task => {
            const conflicts = this.checkScheduleConflicts({
                taskId: task.taskId,
                caseId: task.caseId,
                title: task.title,
                scheduledTime: task.scheduledTime,
                dueDate: task.dueDate,
                priority: task.priority,
                assignedTo: task.assignedTo,
                assignedBy: task.assignedBy
            });
            totalConflicts += conflicts.length;
        });
        return {
            totalTasks: tasks.length,
            scheduledTasks: tasks.filter(task => task.status === client_1.TaskStatus.PENDING).length,
            overdueTasks: overdueTasks.length,
            upcomingTasks: upcomingTasks.length,
            conflicts: totalConflicts,
            averageTaskDuration: this.calculateAverageTaskDuration(tasks),
            utilizationRate: this.calculateUtilizationRate(tasks, userId)
        };
    }
    getUserWorkloads(userId) {
        let workloads = Array.from(this.userWorkloads.values());
        if (userId) {
            workloads = workloads.filter(workload => workload.userId === userId);
        }
        return workloads.sort((a, b) => b.utilizationRate - a.utilizationRate);
    }
    optimizeSchedule(request) {
        const result = {
            success: true,
            optimizedTasks: [],
            conflictsResolved: 0,
            workloadImprovement: 0,
            timeSaved: 0,
            recommendations: [],
            warnings: []
        };
        try {
            let tasksToOptimize = this.getScheduledTasks({
                userId: request.userId,
                caseId: request.caseId
            }).filter(task => task.scheduledTime >= request.timeframe.startDate &&
                task.scheduledTime <= request.timeframe.endDate);
            tasksToOptimize.sort((a, b) => {
                const priorityOrder = { [client_1.TaskPriority.URGENT]: 4, [client_1.TaskPriority.HIGH]: 3, [client_1.TaskPriority.MEDIUM]: 2, [client_1.TaskPriority.LOW]: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
            switch (request.priority) {
                case 'balance_workload':
                    this.balanceWorkload(tasksToOptimize, request.constraints);
                    break;
                case 'minimize_delays':
                    this.minimizeDelays(tasksToOptimize, request.constraints);
                    break;
                case 'maximize_efficiency':
                    this.maximizeEfficiency(tasksToOptimize, request.constraints);
                    break;
                case 'meet_deadlines':
                    this.meetDeadlines(tasksToOptimize, request.constraints);
                    break;
            }
            result.optimizedTasks = tasksToOptimize;
            result.recommendations = this.generateOptimizationRecommendations(tasksToOptimize);
            return result;
        }
        catch (error) {
            result.success = false;
            result.warnings.push(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }
    validateScheduleRequest(request) {
        const errors = [];
        if (!request.title || request.title.trim() === '') {
            errors.push('Task title is required');
        }
        if (!request.assignedTo) {
            errors.push('Assignee is required');
        }
        if (!request.assignedBy) {
            errors.push('Assigned by is required');
        }
        if (!request.scheduledTime) {
            errors.push('Scheduled time is required');
        }
        if (request.scheduledTime < new Date()) {
            errors.push('Scheduled time cannot be in the past');
        }
        if (request.dueDate && request.dueDate < request.scheduledTime) {
            errors.push('Due date must be after scheduled time');
        }
        if (request.recurrence) {
            const recurrenceErrors = this.validateRecurrenceRule(request.recurrence);
            errors.push(...recurrenceErrors);
        }
        return errors;
    }
    validateRecurrenceRule(rule) {
        const errors = [];
        if (rule.interval <= 0) {
            errors.push('Recurrence interval must be positive');
        }
        if (rule.endDate && rule.endDate <= new Date()) {
            errors.push('Recurrence end date must be in the future');
        }
        if (rule.maxOccurrences && rule.maxOccurrences <= 0) {
            errors.push('Max occurrences must be positive');
        }
        if (rule.daysOfWeek && rule.daysOfWeek.some(day => day < 0 || day > 6)) {
            errors.push('Days of week must be between 0 and 6');
        }
        if (rule.dayOfMonth && (rule.dayOfMonth < 1 || rule.dayOfMonth > 31)) {
            errors.push('Day of month must be between 1 and 31');
        }
        if (rule.monthOfYear && (rule.monthOfYear < 1 || rule.monthOfYear > 12)) {
            errors.push('Month of year must be between 1 and 12');
        }
        return errors;
    }
    findScheduledTaskByTaskId(taskId) {
        return Array.from(this.scheduledTasks.values()).find(task => task.taskId === taskId);
    }
    createCalendarEvent(task) {
        const event = {
            id: `event_${task.id}`,
            taskId: task.taskId,
            title: task.title,
            description: task.description,
            startTime: task.scheduledTime,
            endTime: task.dueDate || new Date(task.scheduledTime.getTime() + 60 * 60 * 1000),
            allDay: false,
            attendees: [task.assignedTo, task.assignedBy],
            color: this.getPriorityColor(task.priority),
            recurring: !!task.recurrence,
            recurrenceRule: task.recurrence,
            metadata: {
                caseId: task.caseId,
                priority: task.priority,
                status: task.status
            }
        };
        this.calendarEvents.set(event.id, event);
    }
    deleteCalendarEvent(taskId) {
        const event = Array.from(this.calendarEvents.values()).find(e => e.taskId === taskId);
        if (event) {
            this.calendarEvents.delete(event.id);
        }
    }
    getDefaultReminderSettings(priority) {
        const reminders = this.reminders.get(priority.toString().toLowerCase()) || [];
        return {
            enabled: reminders.length > 0,
            reminders: reminders.map(reminder => ({
                ...reminder,
                id: `${reminder.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }))
        };
    }
    scheduleReminders(task) {
        if (!task.reminderSettings?.enabled || !task.dueDate)
            return;
        task.reminderSettings.reminders.forEach(reminder => {
        });
    }
    cancelReminders(taskId) {
    }
    getTaskReminders(task) {
        if (!task.reminderSettings?.enabled)
            return [];
        return task.reminderSettings.reminders;
    }
    updateUserWorkload(userId, task, remove = false) {
        let workload = this.userWorkloads.get(userId);
        if (!workload) {
            workload = this.createUserWorkload(userId);
            this.userWorkloads.set(userId, workload);
        }
        const estimatedHours = this.estimateTaskHours(task);
        if (remove) {
            workload.totalTasks = Math.max(0, workload.totalTasks - 1);
            workload.totalHours = Math.max(0, workload.totalHours - estimatedHours);
        }
        else {
            workload.totalTasks++;
            workload.totalHours += estimatedHours;
            if (task.status === client_1.TaskStatus.PENDING) {
                workload.activeTasks++;
            }
            if (task.priority === client_1.TaskPriority.HIGH || task.priority === client_1.TaskPriority.URGENT) {
                workload.highPriorityTasks++;
            }
        }
        workload.utilizationRate = workload.availableHours > 0 ?
            (workload.totalHours / workload.availableHours) * 100 : 0;
        if (workload.utilizationRate < 80) {
            workload.capacityStatus = 'under_capacity';
        }
        else if (workload.utilizationRate <= 100) {
            workload.capacityStatus = 'at_capacity';
        }
        else {
            workload.capacityStatus = 'over_capacity';
        }
    }
    createUserWorkload(userId) {
        return {
            userId,
            userName: `User ${userId}`,
            role: client_1.UserRole.ATTORNEY,
            totalTasks: 0,
            activeTasks: 0,
            overdueTasks: 0,
            highPriorityTasks: 0,
            totalHours: 0,
            availableHours: 40,
            utilizationRate: 0,
            capacityStatus: 'under_capacity'
        };
    }
    checkTimeOverlap(time1, time2, thresholdMinutes = 30) {
        const threshold = thresholdMinutes * 60 * 1000;
        const diff = Math.abs(time1.getTime() - time2.getTime());
        return diff < threshold;
    }
    calculateAverageTaskDuration(tasks) {
        if (tasks.length === 0)
            return 0;
        const totalDuration = tasks.reduce((sum, task) => {
            if (task.dueDate) {
                return sum + (task.dueDate.getTime() - task.scheduledTime.getTime()) / (1000 * 60 * 60);
            }
            return sum + 2;
        }, 0);
        return totalDuration / tasks.length;
    }
    calculateUtilizationRate(tasks, userId) {
        const totalEstimatedHours = tasks.reduce((sum, task) => {
            return sum + this.estimateTaskHours(task);
        }, 0);
        const availableHours = 40;
        return Math.min((totalEstimatedHours / availableHours) * 100, 100);
    }
    estimateTaskHours(task) {
        const baseHours = {
            [client_1.TaskPriority.URGENT]: 4,
            [client_1.TaskPriority.HIGH]: 3,
            [client_1.TaskPriority.MEDIUM]: 2,
            [client_1.TaskPriority.LOW]: 1
        };
        return baseHours[task.priority] || 2;
    }
    getPriorityColor(priority) {
        const colors = {
            [client_1.TaskPriority.URGENT]: '#dc3545',
            [client_1.TaskPriority.HIGH]: '#fd7e14',
            [client_1.TaskPriority.MEDIUM]: '#ffc107',
            [client_1.TaskPriority.LOW]: '#28a745'
        };
        return colors[priority] || '#6c757d';
    }
    balanceWorkload(tasks, constraints) {
        const userWorkloads = new Map();
        tasks.forEach(task => {
            const currentLoad = userWorkloads.get(task.assignedTo) || 0;
            userWorkloads.set(task.assignedTo, currentLoad + this.estimateTaskHours(task));
        });
        const sortedUsers = Array.from(userWorkloads.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([userId]) => userId);
    }
    minimizeDelays(tasks, constraints) {
        tasks.sort((a, b) => {
            if (!a.dueDate && !b.dueDate)
                return 0;
            if (!a.dueDate)
                return 1;
            if (!b.dueDate)
                return -1;
            const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
            if (dateDiff !== 0)
                return dateDiff;
            const priorityOrder = { [client_1.TaskPriority.URGENT]: 4, [client_1.TaskPriority.HIGH]: 3, [client_1.TaskPriority.MEDIUM]: 2, [client_1.TaskPriority.LOW]: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }
    maximizeEfficiency(tasks, constraints) {
    }
    meetDeadlines(tasks, constraints) {
        const now = new Date();
        tasks.sort((a, b) => {
            if (!a.dueDate && !b.dueDate)
                return 0;
            if (!a.dueDate)
                return 1;
            if (!b.dueDate)
                return -1;
            const aUrgency = a.dueDate.getTime() - now.getTime();
            const bUrgency = b.dueDate.getTime() - now.getTime();
            return aUrgency - bUrgency;
        });
    }
    generateOptimizationRecommendations(tasks) {
        const recommendations = [];
        const overdueTasks = tasks.filter(task => task.dueDate && task.dueDate < new Date() && task.status !== client_1.TaskStatus.COMPLETED);
        if (overdueTasks.length > 0) {
            recommendations.push(`Consider rescheduling or prioritizing ${overdueTasks.length} overdue tasks`);
        }
        const highPriorityTasks = tasks.filter(task => task.priority === client_1.TaskPriority.HIGH || task.priority === client_1.TaskPriority.URGENT);
        if (highPriorityTasks.length > 5) {
            recommendations.push('High concentration of high-priority tasks - consider resource allocation');
        }
        return recommendations;
    }
    logScheduleHistory(action, taskId, details) {
        this.scheduleHistory.push({
            id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            action,
            taskId,
            timestamp: new Date(),
            details
        });
    }
    getScheduleHistory(taskId, limit) {
        let history = [...this.scheduleHistory];
        if (taskId) {
            history = history.filter(entry => entry.taskId === taskId);
        }
        history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (limit) {
            history = history.slice(0, limit);
        }
        return history;
    }
    processRecurringTasks() {
        const now = new Date();
        const newTasks = [];
        this.scheduledTasks.forEach(task => {
            if (task.recurrence && task.status === client_1.TaskStatus.COMPLETED) {
                const nextOccurrence = this.calculateNextOccurrence(task, now);
                if (nextOccurrence) {
                    const newTask = this.createRecurringTask(task, nextOccurrence);
                    newTasks.push(newTask);
                }
            }
        });
        return newTasks;
    }
    calculateNextOccurrence(task, currentDate) {
        if (!task.recurrence)
            return null;
        const { type, interval, endDate, maxOccurrences } = task.recurrence;
        let nextDate = new Date(task.scheduledTime);
        switch (type) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + interval);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + (interval * 7));
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + interval);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + interval);
                break;
            default:
                return null;
        }
        if (endDate && nextDate > endDate)
            return null;
        if (maxOccurrences && this.getOccurrenceCount(task) >= maxOccurrences)
            return null;
        if (task.recurrence.exceptions?.some(exception => exception.toDateString() === nextDate.toDateString())) {
            return this.calculateNextOccurrence(task, nextDate);
        }
        return nextDate;
    }
    getOccurrenceCount(task) {
        return 0;
    }
    createRecurringTask(originalTask, nextDate) {
        const newTask = {
            ...originalTask,
            id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            scheduledTime: nextDate,
            dueDate: originalTask.dueDate ?
                new Date(nextDate.getTime() + (originalTask.dueDate.getTime() - originalTask.scheduledTime.getTime())) :
                undefined,
            status: client_1.TaskStatus.PENDING,
            metadata: {
                ...originalTask.metadata,
                recurringTaskId: originalTask.taskId,
                occurrenceNumber: this.getOccurrenceCount(originalTask) + 1
            }
        };
        this.scheduledTasks.set(newTask.id, newTask);
        this.createCalendarEvent(newTask);
        this.scheduleReminders(newTask);
        return newTask;
    }
}
exports.TaskSchedulingService = TaskSchedulingService;
//# sourceMappingURL=TaskSchedulingService.js.map