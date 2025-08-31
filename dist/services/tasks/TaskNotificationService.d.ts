import { Database } from '../../utils/database';
import { TaskStatus, TaskPriority } from '@prisma/client';
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
export declare class TaskNotificationService {
    private db;
    private preferenceService;
    private emailService;
    private inAppService;
    private wsService;
    constructor(db: Database, preferenceService: NotificationPreferenceService, emailService: EmailNotificationService, inAppService: InAppNotificationService, wsService: WebSocketService);
    notifyTaskAssigned(payload: TaskNotificationPayload, options?: NotificationOptions): Promise<void>;
    notifyTaskUpdated(payload: TaskNotificationPayload, options?: NotificationOptions): Promise<void>;
    notifyTaskCompleted(payload: TaskNotificationPayload, options?: NotificationOptions): Promise<void>;
    notifyTaskDeadlineReminder(payload: TaskNotificationPayload, hoursUntilDeadline: number, options?: NotificationOptions): Promise<void>;
    notifyTaskOverdue(payload: TaskNotificationPayload, daysOverdue: number, options?: NotificationOptions): Promise<void>;
    notifyTaskEscalation(payload: TaskNotificationPayload, escalationReason: string, options?: NotificationOptions): Promise<void>;
    notifyDependencyBlocked(payload: TaskNotificationPayload, blockedByTaskTitle: string, options?: NotificationOptions): Promise<void>;
    private escalateOverdueTask;
    private checkQuietHours;
    private queueForLater;
    private mapTaskPriorityToNotificationPriority;
    private getStatusLabel;
    private getPriorityLabel;
}
//# sourceMappingURL=TaskNotificationService.d.ts.map