import { TaskStatus, TaskPriority, UserRole } from '@prisma/client';
export interface ScheduledTask {
    id: string;
    taskId: string;
    caseId: string;
    title: string;
    description?: string;
    scheduledTime: Date;
    dueDate?: Date;
    priority: TaskPriority;
    assignedTo: string;
    assignedBy: string;
    status: TaskStatus;
    recurrence?: RecurrenceRule;
    reminderSettings?: ReminderSettings;
    dependencies?: string[];
    metadata: Record<string, any>;
}
export interface RecurrenceRule {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval: number;
    endDate?: Date;
    maxOccurrences?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    exceptions?: Date[];
}
export interface ReminderSettings {
    enabled: boolean;
    reminders: Reminder[];
}
export interface Reminder {
    id: string;
    type: 'email' | 'in_app' | 'sms' | 'push';
    timeOffset: number;
    recipients: string[];
    message?: string;
    customTemplate?: string;
    conditions?: ReminderCondition[];
}
export interface ReminderCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than';
    value: any;
}
export interface ScheduleRequest {
    taskId: string;
    caseId: string;
    title: string;
    description?: string;
    scheduledTime: Date;
    dueDate?: Date;
    priority: TaskPriority;
    assignedTo: string;
    assignedBy: string;
    recurrence?: RecurrenceRule;
    reminderSettings?: ReminderSettings;
    dependencies?: string[];
    metadata?: Record<string, any>;
}
export interface CalendarEvent {
    id: string;
    taskId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    allDay: boolean;
    location?: string;
    attendees: string[];
    color?: string;
    recurring: boolean;
    recurrenceRule?: RecurrenceRule;
    metadata: Record<string, any>;
}
export interface ScheduleConflict {
    taskId: string;
    conflictingTaskId: string;
    conflictType: 'time_overlap' | 'resource_conflict' | 'dependency_conflict';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestedResolution: string;
}
export interface ScheduleStats {
    totalTasks: number;
    scheduledTasks: number;
    overdueTasks: number;
    upcomingTasks: number;
    conflicts: number;
    averageTaskDuration: number;
    utilizationRate: number;
}
export interface UserWorkload {
    userId: string;
    userName: string;
    role: UserRole;
    totalTasks: number;
    activeTasks: number;
    overdueTasks: number;
    highPriorityTasks: number;
    totalHours: number;
    availableHours: number;
    utilizationRate: number;
    capacityStatus: 'under_capacity' | 'at_capacity' | 'over_capacity';
}
export interface ScheduleOptimizationRequest {
    userId?: string;
    caseId?: string;
    priority: 'balance_workload' | 'minimize_delays' | 'maximize_efficiency' | 'meet_deadlines';
    constraints: {
        maxHoursPerDay?: number;
        minBreakTime?: number;
        preferNonWorkingHours?: boolean;
        considerDependencies?: boolean;
        respectVacations?: boolean;
    };
    timeframe: {
        startDate: Date;
        endDate: Date;
    };
}
export interface ScheduleOptimizationResult {
    success: boolean;
    optimizedTasks: ScheduledTask[];
    conflictsResolved: number;
    workloadImprovement: number;
    timeSaved: number;
    recommendations: string[];
    warnings: string[];
}
export declare class TaskSchedulingService {
    private scheduledTasks;
    private calendarEvents;
    private reminders;
    private userWorkloads;
    private scheduleHistory;
    constructor();
    private initializeDefaultReminders;
    scheduleTask(request: ScheduleRequest): ScheduledTask | null;
    rescheduleTask(taskId: string, newScheduledTime: Date, newDueDate?: Date): boolean;
    cancelTaskSchedule(taskId: string): boolean;
    getScheduledTasks(filters?: {
        userId?: string;
        caseId?: string;
        startDate?: Date;
        endDate?: Date;
        priority?: TaskPriority;
        status?: TaskStatus;
    }): ScheduledTask[];
    getCalendarEvents(userId?: string, startDate?: Date, endDate?: Date): CalendarEvent[];
    getUpcomingReminders(userId?: string, hoursAhead?: number): Reminder[];
    checkScheduleConflicts(request: ScheduleRequest): ScheduleConflict[];
    getScheduleStats(userId?: string, caseId?: string): ScheduleStats;
    getUserWorkloads(userId?: string): UserWorkload[];
    optimizeSchedule(request: ScheduleOptimizationRequest): ScheduleOptimizationResult;
    private validateScheduleRequest;
    private validateRecurrenceRule;
    private findScheduledTaskByTaskId;
    private createCalendarEvent;
    private deleteCalendarEvent;
    private getDefaultReminderSettings;
    private scheduleReminders;
    private cancelReminders;
    private getTaskReminders;
    private updateUserWorkload;
    private createUserWorkload;
    private checkTimeOverlap;
    private calculateAverageTaskDuration;
    private calculateUtilizationRate;
    private estimateTaskHours;
    private getPriorityColor;
    private balanceWorkload;
    private minimizeDelays;
    private maximizeEfficiency;
    private meetDeadlines;
    private generateOptimizationRecommendations;
    private logScheduleHistory;
    getScheduleHistory(taskId?: string, limit?: number): Array<{
        id: string;
        action: string;
        taskId: string;
        timestamp: Date;
        details: Record<string, any>;
    }>;
    processRecurringTasks(): ScheduledTask[];
    private calculateNextOccurrence;
    private getOccurrenceCount;
    private createRecurringTask;
}
//# sourceMappingURL=TaskSchedulingService.d.ts.map