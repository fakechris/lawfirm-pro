import { Database } from '../../utils/database';
import { EmailPriority } from '@prisma/client';
import { TaskNotificationPayload } from './TaskNotificationService';
export interface EmailTemplate {
    subject: string;
    htmlContent: string;
    textContent?: string;
}
export interface EmailNotificationOptions {
    priority?: EmailPriority;
    sendAt?: Date;
    retryCount?: number;
    metadata?: Record<string, any>;
}
export declare class EmailNotificationService {
    private db;
    private transporter;
    constructor(db: Database);
    private initializeTransporter;
    sendTaskAssignmentEmail(payload: TaskNotificationPayload, preferences: any): Promise<void>;
    sendTaskUpdateEmail(payload: TaskNotificationPayload, preferences: any): Promise<void>;
    sendTaskCompletionEmail(payload: TaskNotificationPayload, preferences: any): Promise<void>;
    sendDeadlineReminderEmail(payload: TaskNotificationPayload, hoursUntilDeadline: number, preferences: any): Promise<void>;
    sendOverdueTaskEmail(payload: TaskNotificationPayload, daysOverdue: number, preferences: any): Promise<void>;
    sendTaskEscalationEmail(payload: TaskNotificationPayload, escalationReason: string, adminUser: any, preferences: any): Promise<void>;
    sendDependencyBlockedEmail(payload: TaskNotificationPayload, blockedByTaskTitle: string, preferences: any): Promise<void>;
    queueEmail(emailData: {
        userId: string;
        to: string;
        subject: string;
        htmlContent: string;
        textContent?: string;
        priority?: EmailPriority;
        sendAt?: Date;
        retryCount?: number;
        metadata?: Record<string, any>;
    }): Promise<string>;
    processEmail(emailId: string): Promise<void>;
    processEmailQueue(batchSize?: number): Promise<void>;
    retryFailedEmails(maxRetries?: number): Promise<void>;
    private handleEmailFailure;
    private getUserEmail;
    private getTaskAssignmentTemplate;
    private getTaskUpdateTemplate;
    private getTaskCompletionTemplate;
    private getDeadlineReminderTemplate;
    private getOverdueTaskTemplate;
    private getTaskEscalationTemplate;
    private getDependencyBlockedTemplate;
    private getPriorityLabel;
    private getStatusLabel;
}
//# sourceMappingURL=EmailNotificationService.d.ts.map