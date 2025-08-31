import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { EmailStatus, EmailPriority, EmailFrequency, TaskStatus, TaskPriority } from '@prisma/client';
import nodemailer from 'nodemailer';
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

@injectable()
export class EmailNotificationService {
  private transporter: nodemailer.Transporter;

  constructor(@inject(Database) private db: Database) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    // Configure email transporter
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendTaskAssignmentEmail(payload: TaskNotificationPayload, preferences: any): Promise<void> {
    const template = this.getTaskAssignmentTemplate(payload);
    await this.queueEmail({
      userId: payload.assignedTo,
      to: this.getUserEmail(payload.assignedTo),
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      priority: EmailPriority.HIGH,
      metadata: {
        type: 'task_assignment',
        taskId: payload.taskId,
        caseId: payload.caseId
      }
    });
  }

  async sendTaskUpdateEmail(payload: TaskNotificationPayload, preferences: any): Promise<void> {
    const template = this.getTaskUpdateTemplate(payload);
    await this.queueEmail({
      userId: payload.assignedTo,
      to: this.getUserEmail(payload.assignedTo),
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      priority: EmailPriority.MEDIUM,
      metadata: {
        type: 'task_update',
        taskId: payload.taskId,
        caseId: payload.caseId,
        changes: {
          status: payload.oldStatus !== payload.status,
          priority: payload.oldPriority !== payload.priority
        }
      }
    });
  }

  async sendTaskCompletionEmail(payload: TaskNotificationPayload, preferences: any): Promise<void> {
    const template = this.getTaskCompletionTemplate(payload);
    await this.queueEmail({
      userId: payload.assignedBy,
      to: this.getUserEmail(payload.assignedBy),
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      priority: EmailPriority.MEDIUM,
      metadata: {
        type: 'task_completion',
        taskId: payload.taskId,
        caseId: payload.caseId,
        completedBy: payload.assignedTo
      }
    });
  }

  async sendDeadlineReminderEmail(payload: TaskNotificationPayload, hoursUntilDeadline: number, preferences: any): Promise<void> {
    const template = this.getDeadlineReminderTemplate(payload, hoursUntilDeadline);
    const priority = hoursUntilDeadline <= 24 ? EmailPriority.URGENT : 
                     hoursUntilDeadline <= 72 ? EmailPriority.HIGH : 
                     EmailPriority.MEDIUM;

    await this.queueEmail({
      userId: payload.assignedTo,
      to: this.getUserEmail(payload.assignedTo),
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      priority,
      metadata: {
        type: 'deadline_reminder',
        taskId: payload.taskId,
        caseId: payload.caseId,
        hoursUntilDeadline
      }
    });
  }

  async sendOverdueTaskEmail(payload: TaskNotificationPayload, daysOverdue: number, preferences: any): Promise<void> {
    const template = this.getOverdueTaskTemplate(payload, daysOverdue);
    const priority = daysOverdue >= 3 ? EmailPriority.URGENT : EmailPriority.HIGH;

    await this.queueEmail({
      userId: payload.assignedTo,
      to: this.getUserEmail(payload.assignedTo),
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      priority,
      metadata: {
        type: 'overdue_task',
        taskId: payload.taskId,
        caseId: payload.caseId,
        daysOverdue
      }
    });
  }

  async sendTaskEscalationEmail(
    payload: TaskNotificationPayload, 
    escalationReason: string, 
    adminUser: any, 
    preferences: any
  ): Promise<void> {
    const template = this.getTaskEscalationTemplate(payload, escalationReason, adminUser);
    
    await this.queueEmail({
      userId: adminUser.id,
      to: adminUser.email,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      priority: EmailPriority.URGENT,
      metadata: {
        type: 'task_escalation',
        taskId: payload.taskId,
        caseId: payload.caseId,
        assignedTo: payload.assignedTo,
        escalationReason
      }
    });
  }

  async sendDependencyBlockedEmail(payload: TaskNotificationPayload, blockedByTaskTitle: string, preferences: any): Promise<void> {
    const template = this.getDependencyBlockedTemplate(payload, blockedByTaskTitle);
    
    await this.queueEmail({
      userId: payload.assignedTo,
      to: this.getUserEmail(payload.assignedTo),
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      priority: EmailPriority.HIGH,
      metadata: {
        type: 'dependency_blocked',
        taskId: payload.taskId,
        caseId: payload.caseId,
        blockedByTaskTitle
      }
    });
  }

  async queueEmail(emailData: {
    userId: string;
    to: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    priority?: EmailPriority;
    sendAt?: Date;
    retryCount?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const emailQueue = await this.db.client.emailQueue.create({
      data: {
        userId: emailData.userId,
        to: emailData.to,
        subject: emailData.subject,
        htmlContent: emailData.htmlContent,
        textContent: emailData.textContent,
        status: EmailStatus.PENDING,
        priority: emailData.priority || EmailPriority.MEDIUM,
        sendAt: emailData.sendAt || new Date(),
        retryCount: emailData.retryCount || 0,
        metadata: emailData.metadata || {}
      }
    });

    // Process email immediately if sendAt is now or in the past
    if (!emailData.sendAt || emailData.sendAt <= new Date()) {
      await this.processEmail(emailQueue.id);
    }

    return emailQueue.id;
  }

  async processEmail(emailId: string): Promise<void> {
    const email = await this.db.client.emailQueue.findUnique({
      where: { id: emailId }
    });

    if (!email || email.status !== EmailStatus.PENDING) {
      return;
    }

    try {
      await this.transporter.sendMail({
        to: email.to,
        subject: email.subject,
        html: email.htmlContent,
        text: email.textContent,
        priority: email.priority
      });

      await this.db.client.emailQueue.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date()
        }
      });
    } catch (error) {
      await this.handleEmailFailure(emailId, error as Error);
    }
  }

  async processEmailQueue(batchSize: number = 50): Promise<void> {
    const pendingEmails = await this.db.client.emailQueue.findMany({
      where: {
        status: EmailStatus.PENDING,
        sendAt: { lte: new Date() }
      },
      orderBy: [
        { priority: 'desc' },
        { sendAt: 'asc' }
      ],
      take: batchSize
    });

    for (const email of pendingEmails) {
      await this.processEmail(email.id);
    }
  }

  async retryFailedEmails(maxRetries: number = 3): Promise<void> {
    const failedEmails = await this.db.client.emailQueue.findMany({
      where: {
        status: EmailStatus.FAILED,
        retryCount: { lt: maxRetries }
      },
      orderBy: { updatedAt: 'asc' }
    });

    for (const email of failedEmails) {
      // Exponential backoff
      const delay = Math.pow(2, email.retryCount) * 60000; // 1min, 2min, 4min
      const retryAt = new Date(Date.now() + delay);

      await this.db.client.emailQueue.update({
        where: { id: email.id },
        data: {
          status: EmailStatus.RETRYING,
          sendAt: retryAt
        }
      });
    }
  }

  private async handleEmailFailure(emailId: string, error: Error): Promise<void> {
    const email = await this.db.client.emailQueue.findUnique({
      where: { id: emailId }
    });

    if (!email) return;

    const newRetryCount = email.retryCount + 1;
    const maxRetries = 3;

    if (newRetryCount >= maxRetries) {
      await this.db.client.emailQueue.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error.message,
          retryCount: newRetryCount
        }
      });
    } else {
      // Schedule retry with exponential backoff
      const delay = Math.pow(2, newRetryCount) * 60000; // 1min, 2min, 4min
      const retryAt = new Date(Date.now() + delay);

      await this.db.client.emailQueue.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.RETRYING,
          sendAt: retryAt,
          errorMessage: error.message,
          retryCount: newRetryCount
        }
      });
    }
  }

  private getUserEmail(userId: string): string {
    // This would typically fetch from the database
    // For now, return a placeholder
    return `user-${userId}@example.com`;
  }

  private getTaskAssignmentTemplate(payload: TaskNotificationPayload): EmailTemplate {
    const dueDateText = payload.dueDate ? 
      `截止日期: ${payload.dueDate.toLocaleDateString('zh-CN')}` : 
      '无截止日期';

    return {
      subject: `新任务分配: ${payload.taskTitle}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">新任务分配</h2>
          <p>您好，<strong>${payload.assigneeName}</strong>：</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">${payload.taskTitle}</h3>
            <p><strong>案件:</strong> ${payload.caseTitle} (${payload.caseType})</p>
            <p><strong>分配人:</strong> ${payload.creatorName}</p>
            <p><strong>优先级:</strong> ${this.getPriorityLabel(payload.priority)}</p>
            <p><strong>状态:</strong> ${this.getStatusLabel(payload.status)}</p>
            <p><strong>${dueDateText}</strong></p>
          </div>
          
          <p>请登录系统查看详细信息并及时处理此任务。</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              此邮件由律师事务所管理系统自动发送，请勿回复。
            </p>
          </div>
        </div>
      `,
      textContent: `
新任务分配

您好，${payload.assigneeName}：

您被分配了一个新任务：${payload.taskTitle}

案件: ${payload.caseTitle} (${payload.caseType})
分配人: ${payload.creatorName}
优先级: ${this.getPriorityLabel(payload.priority)}
状态: ${this.getStatusLabel(payload.status)}
${dueDateText}

请登录系统查看详细信息并及时处理此任务。

此邮件由律师事务所管理系统自动发送，请勿回复。
      `
    };
  }

  private getTaskUpdateTemplate(payload: TaskNotificationPayload): EmailTemplate {
    let changesText = '';
    
    if (payload.oldStatus && payload.oldStatus !== payload.status) {
      changesText += `<li>状态: ${this.getStatusLabel(payload.oldStatus)} → ${this.getStatusLabel(payload.status)}</li>`;
    }
    
    if (payload.oldPriority && payload.oldPriority !== payload.priority) {
      changesText += `<li>优先级: ${this.getPriorityLabel(payload.oldPriority)} → ${this.getPriorityLabel(payload.priority)}</li>`;
    }

    return {
      subject: `任务更新: ${payload.taskTitle}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">任务更新</h2>
          <p>您好，<strong>${payload.assigneeName}</strong>：</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">${payload.taskTitle}</h3>
            <p><strong>案件:</strong> ${payload.caseTitle}</p>
            <p><strong>更新内容:</strong></p>
            <ul>
              ${changesText}
            </ul>
          </div>
          
          <p>请登录系统查看最新状态。</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              此邮件由律师事务所管理系统自动发送，请勿回复。
            </p>
          </div>
        </div>
      `,
      textContent: `
任务更新

您好，${payload.assigneeName}：

任务 ${payload.taskTitle} 已更新

案件: ${payload.caseTitle}
更新内容:
${changesText.replace(/<[^>]*>/g, '')}

请登录系统查看最新状态。

此邮件由律师事务所管理系统自动发送，请勿回复。
      `
    };
  }

  private getTaskCompletionTemplate(payload: TaskNotificationPayload): EmailTemplate {
    return {
      subject: `任务已完成: ${payload.taskTitle}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #27ae60;">任务已完成</h2>
          <p>您好，<strong>${payload.creatorName}</strong>：</p>
          
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <h3 style="color: #155724; margin-top: 0;">${payload.taskTitle}</h3>
            <p><strong>完成人:</strong> ${payload.assigneeName}</p>
            <p><strong>案件:</strong> ${payload.caseTitle}</p>
            <p><strong>完成时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
          </div>
          
          <p>请登录系统查看任务详情。</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              此邮件由律师事务所管理系统自动发送，请勿回复。
            </p>
          </div>
        </div>
      `,
      textContent: `
任务已完成

您好，${payload.creatorName}：

任务 ${payload.taskTitle} 已完成

完成人: ${payload.assigneeName}
案件: ${payload.caseTitle}
完成时间: ${new Date().toLocaleString('zh-CN')}

请登录系统查看任务详情。

此邮件由律师事务所管理系统自动发送，请勿回复。
      `
    };
  }

  private getDeadlineReminderTemplate(payload: TaskNotificationPayload, hoursUntilDeadline: number): EmailTemplate {
    const urgency = hoursUntilDeadline <= 24 ? '紧急' : hoursUntilDeadline <= 72 ? '即将到期' : '提醒';
    const urgencyColor = hoursUntilDeadline <= 24 ? '#e74c3c' : hoursUntilDeadline <= 72 ? '#f39c12' : '#3498db';

    return {
      subject: `${urgency}任务截止日期提醒: ${payload.taskTitle}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${urgencyColor};">${urgency}任务截止日期提醒</h2>
          <p>您好，<strong>${payload.assigneeName}</strong>：</p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
            <h3 style="color: #856404; margin-top: 0;">${payload.taskTitle}</h3>
            <p><strong>案件:</strong> ${payload.caseTitle}</p>
            <p><strong>截止日期:</strong> ${payload.dueDate?.toLocaleDateString('zh-CN')}</p>
            <p><strong>剩余时间:</strong> ${hoursUntilDeadline} 小时</p>
            <p><strong>优先级:</strong> ${this.getPriorityLabel(payload.priority)}</p>
          </div>
          
          <p>请尽快处理此任务以避免逾期。</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              此邮件由律师事务所管理系统自动发送，请勿回复。
            </p>
          </div>
        </div>
      `,
      textContent: `
${urgency}任务截止日期提醒

您好，${payload.assigneeName}：

任务 ${payload.taskTitle} 即将到期

案件: ${payload.caseTitle}
截止日期: ${payload.dueDate?.toLocaleDateString('zh-CN')}
剩余时间: ${hoursUntilDeadline} 小时
优先级: ${this.getPriorityLabel(payload.priority)}

请尽快处理此任务以避免逾期。

此邮件由律师事务所管理系统自动发送，请勿回复。
      `
    };
  }

  private getOverdueTaskTemplate(payload: TaskNotificationPayload, daysOverdue: number): EmailTemplate {
    const severity = daysOverdue >= 3 ? '严重' : '已';
    const severityColor = daysOverdue >= 3 ? '#e74c3c' : '#f39c12';

    return {
      subject: `${severity}逾期任务: ${payload.taskTitle}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${severityColor};">${severity}逾期任务提醒</h2>
          <p>您好，<strong>${payload.assigneeName}</strong>：</p>
          
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${severityColor};">
            <h3 style="color: #721c24; margin-top: 0;">${payload.taskTitle}</h3>
            <p><strong>案件:</strong> ${payload.caseTitle}</p>
            <p><strong>截止日期:</strong> ${payload.dueDate?.toLocaleDateString('zh-CN')}</p>
            <p><strong>逾期天数:</strong> ${daysOverdue} 天</p>
            <p><strong>优先级:</strong> ${this.getPriorityLabel(payload.priority)}</p>
          </div>
          
          <p>请立即处理此逾期任务。${daysOverdue >= 3 ? '此任务已升级给管理员关注。' : ''}</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              此邮件由律师事务所管理系统自动发送，请勿回复。
            </p>
          </div>
        </div>
      `,
      textContent: `
${severity}逾期任务提醒

您好，${payload.assigneeName}：

任务 ${payload.taskTitle} ${severity}逾期

案件: ${payload.caseTitle}
截止日期: ${payload.dueDate?.toLocaleDateString('zh-CN')}
逾期天数: ${daysOverdue} 天
优先级: ${this.getPriorityLabel(payload.priority)}

请立即处理此逾期任务。${daysOverdue >= 3 ? '此任务已升级给管理员关注。' : ''}

此邮件由律师事务所管理系统自动发送，请勿回复。
      `
    };
  }

  private getTaskEscalationTemplate(
    payload: TaskNotificationPayload, 
    escalationReason: string, 
    adminUser: any
  ): EmailTemplate {
    return {
      subject: `任务升级提醒: ${payload.taskTitle}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">任务升级提醒</h2>
          <p>您好，<strong>${adminUser.firstName} ${adminUser.lastName}</strong>：</p>
          
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <h3 style="color: #721c24; margin-top: 0;">${payload.taskTitle}</h3>
            <p><strong>案件:</strong> ${payload.caseTitle}</p>
            <p><strong>负责人:</strong> ${payload.assigneeName}</p>
            <p><strong>升级原因:</strong> ${escalationReason}</p>
            <p><strong>优先级:</strong> ${this.getPriorityLabel(payload.priority)}</p>
            ${payload.dueDate ? `<p><strong>截止日期:</strong> ${payload.dueDate.toLocaleDateString('zh-CN')}</p>` : ''}
          </div>
          
          <p>请立即关注此任务并采取相应措施。</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              此邮件由律师事务所管理系统自动发送，请勿回复。
            </p>
          </div>
        </div>
      `,
      textContent: `
任务升级提醒

您好，${adminUser.firstName} ${adminUser.lastName}：

以下任务需要您的关注：

任务: ${payload.taskTitle}
案件: ${payload.caseTitle}
负责人: ${payload.assigneeName}
升级原因: ${escalationReason}
优先级: ${this.getPriorityLabel(payload.priority)}
${payload.dueDate ? `截止日期: ${payload.dueDate.toLocaleDateString('zh-CN')}` : ''}

请立即关注此任务并采取相应措施。

此邮件由律师事务所管理系统自动发送，请勿回复。
      `
    };
  }

  private getDependencyBlockedTemplate(payload: TaskNotificationPayload, blockedByTaskTitle: string): EmailTemplate {
    return {
      subject: `任务被阻止: ${payload.taskTitle}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f39c12;">任务被阻止提醒</h2>
          <p>您好，<strong>${payload.assigneeName}</strong>：</p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12;">
            <h3 style="color: #856404; margin-top: 0;">${payload.taskTitle}</h3>
            <p><strong>案件:</strong> ${payload.caseTitle}</p>
            <p><strong>阻止任务:</strong> ${blockedByTaskTitle}</p>
            <p><strong>优先级:</strong> ${this.getPriorityLabel(payload.priority)}</p>
            ${payload.dueDate ? `<p><strong>截止日期:</strong> ${payload.dueDate.toLocaleDateString('zh-CN')}</p>` : ''}
          </div>
          
          <p>您的任务因依赖关系被阻止。请等待依赖任务完成后再开始此任务。</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              此邮件由律师事务所管理系统自动发送，请勿回复。
            </p>
          </div>
        </div>
      `,
      textContent: `
任务被阻止提醒

您好，${payload.assigneeName}：

您的任务 ${payload.taskTitle} 被阻止

案件: ${payload.caseTitle}
阻止任务: ${blockedByTaskTitle}
优先级: ${this.getPriorityLabel(payload.priority)}
${payload.dueDate ? `截止日期: ${payload.dueDate.toLocaleDateString('zh-CN')}` : ''}

您的任务因依赖关系被阻止。请等待依赖任务完成后再开始此任务。

此邮件由律师事务所管理系统自动发送，请勿回复。
      `
    };
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

  private getStatusLabel(status: TaskStatus): string {
    const labels = {
      [TaskStatus.PENDING]: '待处理',
      [TaskStatus.IN_PROGRESS]: '进行中',
      [TaskStatus.COMPLETED]: '已完成',
      [TaskStatus.CANCELLED]: '已取消'
    };
    return labels[status] || status;
  }
}