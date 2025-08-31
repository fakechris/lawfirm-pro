import { TaskStatus, TaskPriority, UserRole } from '@prisma/client';
import { Notification } from './WorkflowEngine';

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
  dependencies?: string[]; // task IDs
  metadata: Record<string, any>;
}

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number; // every X days/weeks/months/years
  endDate?: Date;
  maxOccurrences?: number;
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  monthOfYear?: number; // 1-12
  exceptions?: Date[]; // dates to skip
}

export interface ReminderSettings {
  enabled: boolean;
  reminders: Reminder[];
}

export interface Reminder {
  id: string;
  type: 'email' | 'in_app' | 'sms' | 'push';
  timeOffset: number; // minutes before due date
  recipients: string[]; // user IDs
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
  attendees: string[]; // user IDs
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
  upcomingTasks: number; // next 7 days
  conflicts: number;
  averageTaskDuration: number; // in hours
  utilizationRate: number; // percentage
}

export interface UserWorkload {
  userId: string;
  userName: string;
  role: UserRole;
  totalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  highPriorityTasks: number;
  totalHours: number; // estimated hours for all tasks
  availableHours: number; // available working hours
  utilizationRate: number; // percentage
  capacityStatus: 'under_capacity' | 'at_capacity' | 'over_capacity';
}

export interface ScheduleOptimizationRequest {
  userId?: string; // optional, for specific user
  caseId?: string; // optional, for specific case
  priority: 'balance_workload' | 'minimize_delays' | 'maximize_efficiency' | 'meet_deadlines';
  constraints: {
    maxHoursPerDay?: number;
    minBreakTime?: number; // minutes
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
  workloadImprovement: number; // percentage improvement
  timeSaved: number; // hours saved
  recommendations: string[];
  warnings: string[];
}

export class TaskSchedulingService {
  private scheduledTasks: Map<string, ScheduledTask>;
  private calendarEvents: Map<string, CalendarEvent>;
  private reminders: Map<string, Reminder[]>;
  private userWorkloads: Map<string, UserWorkload>;
  private scheduleHistory: Array<{
    id: string;
    action: string;
    taskId: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;

  constructor() {
    this.scheduledTasks = new Map();
    this.calendarEvents = new Map();
    this.reminders = new Map();
    this.userWorkloads = new Map();
    this.scheduleHistory = [];
    this.initializeDefaultReminders();
  }

  private initializeDefaultReminders(): void {
    // Default reminder templates for different task types
    const defaultReminders = {
      urgent: [
        {
          id: 'urgent_24h',
          type: 'email' as const,
          timeOffset: 24 * 60, // 24 hours
          recipients: ['assignee', 'supervisor'],
          message: 'URGENT: Task due in 24 hours - {taskTitle}'
        },
        {
          id: 'urgent_2h',
          type: 'in_app' as const,
          timeOffset: 2 * 60, // 2 hours
          recipients: ['assignee'],
          message: 'URGENT: Task due in 2 hours - {taskTitle}'
        }
      ],
      high: [
        {
          id: 'high_48h',
          type: 'email' as const,
          timeOffset: 48 * 60, // 48 hours
          recipients: ['assignee'],
          message: 'High priority task due in 2 days - {taskTitle}'
        },
        {
          id: 'high_24h',
          type: 'in_app' as const,
          timeOffset: 24 * 60, // 24 hours
          recipients: ['assignee'],
          message: 'High priority task due tomorrow - {taskTitle}'
        }
      ],
      medium: [
        {
          id: 'medium_72h',
          type: 'in_app' as const,
          timeOffset: 72 * 60, // 72 hours
          recipients: ['assignee'],
          message: 'Task due in 3 days - {taskTitle}'
        }
      ],
      deadline: [
        {
          id: 'deadline_7d',
          type: 'email' as const,
          timeOffset: 7 * 24 * 60, // 7 days
          recipients: ['assignee', 'case_attorney'],
          message: 'Deadline approaching: {taskTitle} due in 7 days'
        },
        {
          id: 'deadline_3d',
          type: 'email' as const,
          timeOffset: 3 * 24 * 60, // 3 days
          recipients: ['assignee', 'supervisor'],
          message: 'URGENT: Deadline in 3 days - {taskTitle}'
        },
        {
          id: 'deadline_1d',
          type: 'sms' as const,
          timeOffset: 24 * 60, // 24 hours
          recipients: ['assignee'],
          message: 'FINAL REMINDER: {taskTitle} due tomorrow'
        }
      ]
    };

    // Store default reminders by priority
    Object.entries(defaultReminders).forEach(([priority, reminders]) => {
      this.reminders.set(priority, reminders);
    });
  }

  public scheduleTask(request: ScheduleRequest): ScheduledTask | null {
    // Validate the schedule request
    const validationErrors = this.validateScheduleRequest(request);
    if (validationErrors.length > 0) {
      throw new Error(`Schedule validation failed: ${validationErrors.join(', ')}`);
    }

    // Check for conflicts
    const conflicts = this.checkScheduleConflicts(request);
    if (conflicts.length > 0) {
      const highPriorityConflicts = conflicts.filter(c => c.severity === 'high');
      if (highPriorityConflicts.length > 0) {
        throw new Error(`High priority schedule conflicts: ${highPriorityConflicts.map(c => c.description).join(', ')}`);
      }
    }

    // Create scheduled task
    const scheduledTask: ScheduledTask = {
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
      status: TaskStatus.PENDING,
      recurrence: request.recurrence,
      reminderSettings: this.getDefaultReminderSettings(request.priority),
      dependencies: request.dependencies,
      metadata: request.metadata || {}
    };

    // Store the scheduled task
    this.scheduledTasks.set(scheduledTask.id, scheduledTask);

    // Create calendar event
    this.createCalendarEvent(scheduledTask);

    // Schedule reminders
    this.scheduleReminders(scheduledTask);

    // Update user workload
    this.updateUserWorkload(request.assignedTo, scheduledTask);

    // Log to history
    this.logScheduleHistory('task_scheduled', scheduledTask.id, {
      title: scheduledTask.title,
      assignedTo: scheduledTask.assignedTo,
      scheduledTime: scheduledTask.scheduledTime
    });

    return scheduledTask;
  }

  public rescheduleTask(taskId: string, newScheduledTime: Date, newDueDate?: Date): boolean {
    const scheduledTask = this.findScheduledTaskByTaskId(taskId);
    if (!scheduledTask) {
      return false;
    }

    // Store old values for history
    const oldScheduledTime = scheduledTask.scheduledTime;
    const oldDueDate = scheduledTask.dueDate;

    // Update the task
    scheduledTask.scheduledTime = newScheduledTime;
    if (newDueDate) {
      scheduledTask.dueDate = newDueDate;
    }

    // Recreate calendar event
    this.deleteCalendarEvent(taskId);
    this.createCalendarEvent(scheduledTask);

    // Reschedule reminders
    this.cancelReminders(taskId);
    this.scheduleReminders(scheduledTask);

    // Log to history
    this.logScheduleHistory('task_rescheduled', scheduledTask.id, {
      title: scheduledTask.title,
      oldScheduledTime,
      newScheduledTime,
      oldDueDate,
      newDueDate: scheduledTask.dueDate
    });

    return true;
  }

  public cancelTaskSchedule(taskId: string): boolean {
    const scheduledTask = this.findScheduledTaskByTaskId(taskId);
    if (!scheduledTask) {
      return false;
    }

    // Remove from scheduled tasks
    this.scheduledTasks.delete(scheduledTask.id);

    // Delete calendar event
    this.deleteCalendarEvent(taskId);

    // Cancel reminders
    this.cancelReminders(taskId);

    // Update user workload
    this.updateUserWorkload(scheduledTask.assignedTo, scheduledTask, true);

    // Log to history
    this.logScheduleHistory('task_cancelled', scheduledTask.id, {
      title: scheduledTask.title,
      originalScheduledTime: scheduledTask.scheduledTime
    });

    return true;
  }

  public getScheduledTasks(filters?: {
    userId?: string;
    caseId?: string;
    startDate?: Date;
    endDate?: Date;
    priority?: TaskPriority;
    status?: TaskStatus;
  }): ScheduledTask[] {
    let tasks = Array.from(this.scheduledTasks.values());

    if (filters) {
      if (filters.userId) {
        tasks = tasks.filter(task => task.assignedTo === filters.userId);
      }
      if (filters.caseId) {
        tasks = tasks.filter(task => task.caseId === filters.caseId);
      }
      if (filters.startDate) {
        tasks = tasks.filter(task => task.scheduledTime >= filters.startDate!);
      }
      if (filters.endDate) {
        tasks = tasks.filter(task => task.scheduledTime <= filters.endDate!);
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

  public getCalendarEvents(userId?: string, startDate?: Date, endDate?: Date): CalendarEvent[] {
    let events = Array.from(this.calendarEvents.values());

    if (userId) {
      events = events.filter(event => event.attendees.includes(userId));
    }
    if (startDate) {
      events = events.filter(event => event.startTime >= startDate!);
    }
    if (endDate) {
      events = events.filter(event => event.endTime <= endDate!);
    }

    return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  public getUpcomingReminders(userId?: string, hoursAhead: number = 24): Reminder[] {
    const now = new Date();
    const endTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const upcomingReminders: Reminder[] = [];

    this.scheduledTasks.forEach(task => {
      if (userId && task.assignedTo !== userId) return;

      const reminders = this.getTaskReminders(task);
      reminders.forEach(reminder => {
        const reminderTime = new Date(task.dueDate!.getTime() - reminder.timeOffset * 60 * 1000);
        if (reminderTime >= now && reminderTime <= endTime) {
          upcomingReminders.push(reminder);
        }
      });
    });

    return upcomingReminders.sort((a, b) => a.timeOffset - b.timeOffset);
  }

  public checkScheduleConflicts(request: ScheduleRequest): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];

    // Check time conflicts for the same user
    const userTasks = this.getScheduledTasks({
      userId: request.assignedTo,
      startDate: new Date(request.scheduledTime.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
      endDate: new Date(request.scheduledTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours after
    });

    userTasks.forEach(task => {
      if (task.taskId === request.taskId) return; // Skip self

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

    // Check dependency conflicts
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

  public getScheduleStats(userId?: string, caseId?: string): ScheduleStats {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let tasks = Array.from(this.scheduledTasks.values());
    
    if (userId) {
      tasks = tasks.filter(task => task.assignedTo === userId);
    }
    if (caseId) {
      tasks = tasks.filter(task => task.caseId === caseId);
    }

    const overdueTasks = tasks.filter(task => 
      task.dueDate && task.dueDate < now && task.status !== TaskStatus.COMPLETED
    );
    const upcomingTasks = tasks.filter(task => 
      task.dueDate && task.dueDate >= now && task.dueDate <= nextWeek
    );

    // Calculate conflicts
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
      scheduledTasks: tasks.filter(task => task.status === TaskStatus.PENDING).length,
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.length,
      conflicts: totalConflicts,
      averageTaskDuration: this.calculateAverageTaskDuration(tasks),
      utilizationRate: this.calculateUtilizationRate(tasks, userId)
    };
  }

  public getUserWorkloads(userId?: string): UserWorkload[] {
    let workloads = Array.from(this.userWorkloads.values());
    
    if (userId) {
      workloads = workloads.filter(workload => workload.userId === userId);
    }

    return workloads.sort((a, b) => b.utilizationRate - a.utilizationRate);
  }

  public optimizeSchedule(request: ScheduleOptimizationRequest): ScheduleOptimizationResult {
    const result: ScheduleOptimizationResult = {
      success: true,
      optimizedTasks: [],
      conflictsResolved: 0,
      workloadImprovement: 0,
      timeSaved: 0,
      recommendations: [],
      warnings: []
    };

    try {
      // Get tasks to optimize
      let tasksToOptimize = this.getScheduledTasks({
        userId: request.userId,
        caseId: request.caseId
      }).filter(task => 
        task.scheduledTime >= request.timeframe.startDate && 
        task.scheduledTime <= request.timeframe.endDate
      );

      // Sort by priority
      tasksToOptimize.sort((a, b) => {
        const priorityOrder = { [TaskPriority.URGENT]: 4, [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Apply optimization strategy
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
    } catch (error) {
      result.success = false;
      result.warnings.push(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private validateScheduleRequest(request: ScheduleRequest): string[] {
    const errors: string[] = [];

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

    // Validate recurrence rules
    if (request.recurrence) {
      const recurrenceErrors = this.validateRecurrenceRule(request.recurrence);
      errors.push(...recurrenceErrors);
    }

    return errors;
  }

  private validateRecurrenceRule(rule: RecurrenceRule): string[] {
    const errors: string[] = [];

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

  private findScheduledTaskByTaskId(taskId: string): ScheduledTask | undefined {
    return Array.from(this.scheduledTasks.values()).find(task => task.taskId === taskId);
  }

  private createCalendarEvent(task: ScheduledTask): void {
    const event: CalendarEvent = {
      id: `event_${task.id}`,
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      startTime: task.scheduledTime,
      endTime: task.dueDate || new Date(task.scheduledTime.getTime() + 60 * 60 * 1000), // Default 1 hour
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

  private deleteCalendarEvent(taskId: string): void {
    const event = Array.from(this.calendarEvents.values()).find(e => e.taskId === taskId);
    if (event) {
      this.calendarEvents.delete(event.id);
    }
  }

  private getDefaultReminderSettings(priority: TaskPriority): ReminderSettings {
    const reminders = this.reminders.get(priority.toString().toLowerCase()) || [];
    
    return {
      enabled: reminders.length > 0,
      reminders: reminders.map(reminder => ({
        ...reminder,
        id: `${reminder.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))
    };
  }

  private scheduleReminders(task: ScheduledTask): void {
    if (!task.reminderSettings?.enabled || !task.dueDate) return;

    task.reminderSettings.reminders.forEach(reminder => {
      // In a real implementation, this would integrate with a notification system
      // For now, we'll just store the reminder configuration
    });
  }

  private cancelReminders(taskId: string): void {
    // In a real implementation, this would cancel scheduled notifications
    // For now, this is a placeholder
  }

  private getTaskReminders(task: ScheduledTask): Reminder[] {
    if (!task.reminderSettings?.enabled) return [];
    return task.reminderSettings.reminders;
  }

  private updateUserWorkload(userId: string, task: ScheduledTask, remove: boolean = false): void {
    let workload = this.userWorkloads.get(userId);
    
    if (!workload) {
      workload = this.createUserWorkload(userId);
      this.userWorkloads.set(userId, workload);
    }

    const estimatedHours = this.estimateTaskHours(task);
    
    if (remove) {
      workload.totalTasks = Math.max(0, workload.totalTasks - 1);
      workload.totalHours = Math.max(0, workload.totalHours - estimatedHours);
    } else {
      workload.totalTasks++;
      workload.totalHours += estimatedHours;
      
      if (task.status === TaskStatus.PENDING) {
        workload.activeTasks++;
      }
      
      if (task.priority === TaskPriority.HIGH || task.priority === TaskPriority.URGENT) {
        workload.highPriorityTasks++;
      }
    }

    // Update utilization rate
    workload.utilizationRate = workload.availableHours > 0 ? 
      (workload.totalHours / workload.availableHours) * 100 : 0;

    // Update capacity status
    if (workload.utilizationRate < 80) {
      workload.capacityStatus = 'under_capacity';
    } else if (workload.utilizationRate <= 100) {
      workload.capacityStatus = 'at_capacity';
    } else {
      workload.capacityStatus = 'over_capacity';
    }
  }

  private createUserWorkload(userId: string): UserWorkload {
    return {
      userId,
      userName: `User ${userId}`, // In real implementation, fetch from user service
      role: UserRole.ATTORNEY, // Default, should be fetched from user service
      totalTasks: 0,
      activeTasks: 0,
      overdueTasks: 0,
      highPriorityTasks: 0,
      totalHours: 0,
      availableHours: 40, // Default 40 hours per week
      utilizationRate: 0,
      capacityStatus: 'under_capacity'
    };
  }

  private checkTimeOverlap(time1: Date, time2: Date, thresholdMinutes: number = 30): boolean {
    const threshold = thresholdMinutes * 60 * 1000; // Convert to milliseconds
    const diff = Math.abs(time1.getTime() - time2.getTime());
    return diff < threshold;
  }

  private calculateAverageTaskDuration(tasks: ScheduledTask[]): number {
    if (tasks.length === 0) return 0;
    
    const totalDuration = tasks.reduce((sum, task) => {
      if (task.dueDate) {
        return sum + (task.dueDate.getTime() - task.scheduledTime.getTime()) / (1000 * 60 * 60);
      }
      return sum + 2; // Default 2 hours if no due date
    }, 0);

    return totalDuration / tasks.length;
  }

  private calculateUtilizationRate(tasks: ScheduledTask[], userId?: string): number {
    // Simple utilization calculation
    // In real implementation, this would consider working hours, vacations, etc.
    const totalEstimatedHours = tasks.reduce((sum, task) => {
      return sum + this.estimateTaskHours(task);
    }, 0);

    const availableHours = 40; // 40 hours per week
    return Math.min((totalEstimatedHours / availableHours) * 100, 100);
  }

  private estimateTaskHours(task: ScheduledTask): number {
    // Simple estimation based on priority
    const baseHours = {
      [TaskPriority.URGENT]: 4,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.LOW]: 1
    };

    return baseHours[task.priority] || 2;
  }

  private getPriorityColor(priority: TaskPriority): string {
    const colors = {
      [TaskPriority.URGENT]: '#dc3545', // red
      [TaskPriority.HIGH]: '#fd7e14', // orange
      [TaskPriority.MEDIUM]: '#ffc107', // yellow
      [TaskPriority.LOW]: '#28a745' // green
    };

    return colors[priority] || '#6c757d';
  }

  private balanceWorkload(tasks: ScheduledTask[], constraints: any): void {
    // Simple workload balancing algorithm
    // In real implementation, this would be more sophisticated
    const userWorkloads = new Map<string, number>();
    
    tasks.forEach(task => {
      const currentLoad = userWorkloads.get(task.assignedTo) || 0;
      userWorkloads.set(task.assignedTo, currentLoad + this.estimateTaskHours(task));
    });

    // Find users with lowest workload
    const sortedUsers = Array.from(userWorkloads.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([userId]) => userId);

    // Redistribute some tasks to balance workload
    // This is a simplified version - real implementation would be more complex
  }

  private minimizeDelays(tasks: ScheduledTask[], constraints: any): void {
    // Sort tasks by due date and priority
    tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      
      const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      
      const priorityOrder = { [TaskPriority.URGENT]: 4, [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private maximizeEfficiency(tasks: ScheduledTask[], constraints: any): void {
    // Group similar tasks together for efficiency
    // This is a placeholder for a more sophisticated algorithm
  }

  private meetDeadlines(tasks: ScheduledTask[], constraints: any): void {
    // Prioritize tasks with approaching deadlines
    const now = new Date();
    tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      
      const aUrgency = a.dueDate.getTime() - now.getTime();
      const bUrgency = b.dueDate.getTime() - now.getTime();
      
      return aUrgency - bUrgency;
    });
  }

  private generateOptimizationRecommendations(tasks: ScheduledTask[]): string[] {
    const recommendations: string[] = [];

    // Analyze task distribution and generate recommendations
    const overdueTasks = tasks.filter(task => 
      task.dueDate && task.dueDate < new Date() && task.status !== TaskStatus.COMPLETED
    );

    if (overdueTasks.length > 0) {
      recommendations.push(`Consider rescheduling or prioritizing ${overdueTasks.length} overdue tasks`);
    }

    const highPriorityTasks = tasks.filter(task => 
      task.priority === TaskPriority.HIGH || task.priority === TaskPriority.URGENT
    );

    if (highPriorityTasks.length > 5) {
      recommendations.push('High concentration of high-priority tasks - consider resource allocation');
    }

    return recommendations;
  }

  private logScheduleHistory(action: string, taskId: string, details: Record<string, any>): void {
    this.scheduleHistory.push({
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      taskId,
      timestamp: new Date(),
      details
    });
  }

  public getScheduleHistory(taskId?: string, limit?: number): Array<{
    id: string;
    action: string;
    taskId: string;
    timestamp: Date;
    details: Record<string, any>;
  }> {
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

  public processRecurringTasks(): ScheduledTask[] {
    const now = new Date();
    const newTasks: ScheduledTask[] = [];

    this.scheduledTasks.forEach(task => {
      if (task.recurrence && task.status === TaskStatus.COMPLETED) {
        const nextOccurrence = this.calculateNextOccurrence(task, now);
        if (nextOccurrence) {
          const newTask = this.createRecurringTask(task, nextOccurrence);
          newTasks.push(newTask);
        }
      }
    });

    return newTasks;
  }

  private calculateNextOccurrence(task: ScheduledTask, currentDate: Date): Date | null {
    if (!task.recurrence) return null;

    const { type, interval, endDate, maxOccurrences } = task.recurrence;
    let nextDate = new Date(task.scheduledTime);

    // Calculate next occurrence based on recurrence type
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

    // Check if we've exceeded the end date or max occurrences
    if (endDate && nextDate > endDate) return null;
    if (maxOccurrences && this.getOccurrenceCount(task) >= maxOccurrences) return null;

    // Check for exceptions
    if (task.recurrence.exceptions?.some(exception => 
      exception.toDateString() === nextDate.toDateString()
    )) {
      return this.calculateNextOccurrence(task, nextDate);
    }

    return nextDate;
  }

  private getOccurrenceCount(task: ScheduledTask): number {
    // In a real implementation, this would query the database for existing occurrences
    return 0;
  }

  private createRecurringTask(originalTask: ScheduledTask, nextDate: Date): ScheduledTask {
    const newTask: ScheduledTask = {
      ...originalTask,
      id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scheduledTime: nextDate,
      dueDate: originalTask.dueDate ? 
        new Date(nextDate.getTime() + (originalTask.dueDate.getTime() - originalTask.scheduledTime.getTime())) : 
        undefined,
      status: TaskStatus.PENDING,
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