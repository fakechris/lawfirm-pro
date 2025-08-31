import { EmailNotificationService } from '../../src/services/tasks/EmailNotificationService';
import { Database } from '../../src/utils/database';
import { 
  EmailStatus, 
  EmailPriority, 
  EmailFrequency,
  TaskStatus, 
  TaskPriority,
  CaseType
} from '@prisma/client';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('../../src/utils/database');
jest.mock('nodemailer');

const MockDatabase = Database as jest.MockedClass<typeof Database>;
const MockNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('EmailNotificationService', () => {
  let emailService: EmailNotificationService;
  let mockDb: any;
  let mockTransporter: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock database instance
    mockDb = {
      client: {
        emailQueue: {
          create: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn()
        }
      }
    };

    // Create mock transporter
    mockTransporter = {
      sendMail: jest.fn()
    };

    // Mock the Database constructor to return our mock
    MockDatabase.mockImplementation(() => mockDb);
    
    // Mock nodemailer.createTransporter
    MockNodemailer.createTransporter.mockReturnValue(mockTransporter);

    // Create email service instance
    emailService = new EmailNotificationService(mockDb);
  });

  describe('sendTaskAssignmentEmail', () => {
    const mockPayload = {
      taskId: 'task-123',
      taskTitle: 'Review Contract',
      caseId: 'case-123',
      caseTitle: 'Smith vs Johnson',
      assignedTo: 'user-123',
      assignedBy: 'user-456',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      caseType: CaseType.CONTRACT_DISPUTE
    };

    const mockPreferences = {
      emailEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should queue task assignment email successfully', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '新任务分配: Review Contract',
        status: EmailStatus.PENDING,
        sendAt: new Date()
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);

      // Execute
      const result = await emailService.sendTaskAssignmentEmail(mockPayload, mockPreferences);

      // Verify email was queued with correct data
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '新任务分配: Review Contract',
        htmlContent: expect.stringContaining('新任务分配'),
        textContent: expect.stringContaining('新任务分配'),
        priority: EmailPriority.HIGH,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'task_assignment',
          taskId: 'task-123',
          caseId: 'case-123'
        }
      });

      // Verify email was processed immediately
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'user-123@example.com',
        subject: '新任务分配: Review Contract',
        html: expect.stringContaining('Review Contract'),
        text: expect.stringContaining('Review Contract'),
        priority: EmailPriority.HIGH
      });

      // Verify email was marked as sent
      expect(mockDb.client.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: {
          status: EmailStatus.SENT,
          sentAt: expect.any(Date)
        }
      });

      expect(result).toBe('email-123');
    });

    it('should handle email sending failure', async () => {
      // Setup mocks
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '新任务分配: Review Contract',
        status: EmailStatus.PENDING,
        sendAt: new Date()
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      // Execute
      const result = await emailService.sendTaskAssignmentEmail(mockPayload, mockPreferences);

      // Verify email was marked as failed
      expect(mockDb.client.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: {
          status: EmailStatus.FAILED,
          failedAt: expect.any(Date),
          errorMessage: 'SMTP connection failed',
          retryCount: 1
        }
      });

      expect(result).toBe('email-123');
    });

    it('should handle retry logic', async () => {
      // Setup mocks for email with existing retries
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '新任务分配: Review Contract',
        status: EmailStatus.PENDING,
        sendAt: new Date(),
        retryCount: 2
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      // Execute
      await emailService.sendTaskAssignmentEmail(mockPayload, mockPreferences);

      // Verify email was marked as failed with increased retry count
      expect(mockDb.client.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: {
          status: EmailStatus.FAILED,
          failedAt: expect.any(Date),
          errorMessage: 'SMTP connection failed',
          retryCount: 3 // This should trigger max retries
        }
      });
    });
  });

  describe('sendTaskUpdateEmail', () => {
    const mockPayload = {
      taskId: 'task-123',
      taskTitle: 'Review Contract',
      caseId: 'case-123',
      caseTitle: 'Smith vs Johnson',
      assignedTo: 'user-123',
      assignedBy: 'user-456',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      oldStatus: TaskStatus.PENDING,
      oldPriority: TaskPriority.MEDIUM,
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      caseType: CaseType.CONTRACT_DISPUTE
    };

    const mockPreferences = {
      emailEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should queue task update email with status change', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '任务更新: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendTaskUpdateEmail(mockPayload, mockPreferences);

      // Verify email was queued with correct data including changes
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '任务更新: Review Contract',
        htmlContent: expect.stringContaining('任务更新'),
        textContent: expect.stringContaining('任务更新'),
        priority: EmailPriority.MEDIUM,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'task_update',
          taskId: 'task-123',
          caseId: 'case-123',
          changes: {
            status: true,
            priority: true
          }
        }
      });

      expect(result).toBe('email-123');
    });

    it('should queue task update email with priority change only', async () => {
      // Setup payload with only priority change
      const priorityChangePayload = {
        ...mockPayload,
        oldStatus: undefined,
        priority: TaskPriority.URGENT,
        oldPriority: TaskPriority.HIGH
      };

      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '任务更新: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendTaskUpdateEmail(priorityChangePayload, mockPreferences);

      // Verify email was queued with correct metadata
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '任务更新: Review Contract',
        htmlContent: expect.stringContaining('任务更新'),
        textContent: expect.stringContaining('任务更新'),
        priority: EmailPriority.MEDIUM,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'task_update',
          taskId: 'task-123',
          caseId: 'case-123',
          changes: {
            status: false,
            priority: true
          }
        }
      });

      expect(result).toBe('email-123');
    });
  });

  describe('sendTaskCompletionEmail', () => {
    const mockPayload = {
      taskId: 'task-123',
      taskTitle: 'Review Contract',
      caseId: 'case-123',
      caseTitle: 'Smith vs Johnson',
      assignedTo: 'user-123',
      assignedBy: 'user-456',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      caseType: CaseType.CONTRACT_DISPUTE
    };

    const mockPreferences = {
      emailEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should queue task completion email to creator', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-456',
        to: 'user-456@example.com',
        subject: '任务已完成: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendTaskCompletionEmail(mockPayload, mockPreferences);

      // Verify email was queued to creator (assignedBy)
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-456',
        to: 'user-456@example.com',
        subject: '任务已完成: Review Contract',
        htmlContent: expect.stringContaining('任务已完成'),
        textContent: expect.stringContaining('任务已完成'),
        priority: EmailPriority.MEDIUM,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'task_completion',
          taskId: 'task-123',
          caseId: 'case-123',
          completedBy: 'user-123'
        }
      });

      expect(result).toBe('email-123');
    });
  });

  describe('sendDeadlineReminderEmail', () => {
    const mockPayload = {
      taskId: 'task-123',
      taskTitle: 'Review Contract',
      caseId: 'case-123',
      caseTitle: 'Smith vs Johnson',
      assignedTo: 'user-123',
      assignedBy: 'user-456',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      caseType: CaseType.CONTRACT_DISPUTE
    };

    const mockPreferences = {
      emailEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send urgent reminder for 24 hours', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '紧急任务截止日期提醒: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendDeadlineReminderEmail(mockPayload, 24, mockPreferences);

      // Verify urgent email was queued
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '紧急任务截止日期提醒: Review Contract',
        htmlContent: expect.stringContaining('紧急'),
        textContent: expect.stringContaining('紧急'),
        priority: EmailPriority.URGENT,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'deadline_reminder',
          taskId: 'task-123',
          caseId: 'case-123',
          hoursUntilDeadline: 24
        }
      });

      expect(result).toBe('email-123');
    });

    it('should send high priority reminder for 72 hours', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '即将到期任务截止日期提醒: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendDeadlineReminderEmail(mockPayload, 72, mockPreferences);

      // Verify high priority email was queued
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '即将到期任务截止日期提醒: Review Contract',
        htmlContent: expect.stringContaining('即将到期'),
        textContent: expect.stringContaining('即将到期'),
        priority: EmailPriority.HIGH,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'deadline_reminder',
          taskId: 'task-123',
          caseId: 'case-123',
          hoursUntilDeadline: 72
        }
      });

      expect(result).toBe('email-123');
    });
  });

  describe('sendOverdueTaskEmail', () => {
    const mockPayload = {
      taskId: 'task-123',
      taskTitle: 'Review Contract',
      caseId: 'case-123',
      caseTitle: 'Smith vs Johnson',
      assignedTo: 'user-123',
      assignedBy: 'user-456',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      caseType: CaseType.CONTRACT_DISPUTE
    };

    const mockPreferences = {
      emailEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send high priority overdue email for 1 day', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '已逾期任务: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendOverdueTaskEmail(mockPayload, 1, mockPreferences);

      // Verify high priority email was queued
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '已逾期任务: Review Contract',
        htmlContent: expect.stringContaining('已逾期'),
        textContent: expect.stringContaining('已逾期'),
        priority: EmailPriority.HIGH,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'overdue_task',
          taskId: 'task-123',
          caseId: 'case-123',
          daysOverdue: 1
        }
      });

      expect(result).toBe('email-123');
    });

    it('should send urgent overdue email for 5 days', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '严重逾期任务: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendOverdueTaskEmail(mockPayload, 5, mockPreferences);

      // Verify urgent email was queued
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '严重逾期任务: Review Contract',
        htmlContent: expect.stringContaining('严重逾期'),
        textContent: expect.stringContaining('严重逾期'),
        priority: EmailPriority.URGENT,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'overdue_task',
          taskId: 'task-123',
          caseId: 'case-123',
          daysOverdue: 5
        }
      });

      expect(result).toBe('email-123');
    });
  });

  describe('sendTaskEscalationEmail', () => {
    const mockPayload = {
      taskId: 'task-123',
      taskTitle: 'Review Contract',
      caseId: 'case-123',
      caseTitle: 'Smith vs Johnson',
      assignedTo: 'user-123',
      assignedBy: 'user-456',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      caseType: CaseType.CONTRACT_DISPUTE
    };

    const mockAdminUser = {
      id: 'admin-1',
      email: 'admin1@example.com',
      firstName: 'Admin',
      lastName: 'One'
    };

    const mockPreferences = {
      emailEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send escalation email to admin user', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'admin-1',
        to: 'admin1@example.com',
        subject: '任务升级提醒: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendTaskEscalationEmail(
        mockPayload, 
        'Task is severely overdue', 
        mockAdminUser, 
        mockPreferences
      );

      // Verify urgent escalation email was queued
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'admin-1',
        to: 'admin1@example.com',
        subject: '任务升级提醒: Review Contract',
        htmlContent: expect.stringContaining('任务升级提醒'),
        textContent: expect.stringContaining('任务升级提醒'),
        priority: EmailPriority.URGENT,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'task_escalation',
          taskId: 'task-123',
          caseId: 'case-123',
          assignedTo: 'user-123',
          escalationReason: 'Task is severely overdue'
        }
      });

      expect(result).toBe('email-123');
    });
  });

  describe('sendDependencyBlockedEmail', () => {
    const mockPayload = {
      taskId: 'task-123',
      taskTitle: 'Review Contract',
      caseId: 'case-123',
      caseTitle: 'Smith vs Johnson',
      assignedTo: 'user-123',
      assignedBy: 'user-456',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      caseType: CaseType.CONTRACT_DISPUTE
    };

    const mockPreferences = {
      emailEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send dependency blocked email', async () => {
      // Setup mock
      const mockEmailQueue = {
        id: 'email-123',
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '任务被阻止: Review Contract',
        status: EmailStatus.PENDING
      };
      
      mockDb.client.emailQueue.create.mockResolvedValue(mockEmailQueue);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      const result = await emailService.sendDependencyBlockedEmail(
        mockPayload, 
        'Prepare Documents', 
        mockPreferences
      );

      // Verify high priority blocked email was queued
      expect(mockDb.client.emailQueue.create).toHaveBeenCalledWith({
        userId: 'user-123',
        to: 'user-123@example.com',
        subject: '任务被阻止: Review Contract',
        htmlContent: expect.stringContaining('任务被阻止'),
        textContent: expect.stringContaining('任务被阻止'),
        priority: EmailPriority.HIGH,
        status: EmailStatus.PENDING,
        sendAt: expect.any(Date),
        retryCount: 0,
        metadata: {
          type: 'dependency_blocked',
          taskId: 'task-123',
          caseId: 'case-123',
          blockedByTaskTitle: 'Prepare Documents'
        }
      });

      expect(result).toBe('email-123');
    });
  });

  describe('processEmailQueue', () => {
    it('should process pending emails in priority order', async () => {
      // Setup mock emails with different priorities
      const mockEmails = [
        {
          id: 'email-1',
          userId: 'user-1',
          to: 'user1@example.com',
          subject: 'Low Priority',
          status: EmailStatus.PENDING,
          priority: EmailPriority.LOW,
          sendAt: new Date()
        },
        {
          id: 'email-2',
          userId: 'user-2',
          to: 'user2@example.com',
          subject: 'Urgent Priority',
          status: EmailStatus.PENDING,
          priority: EmailPriority.URGENT,
          sendAt: new Date()
        },
        {
          id: 'email-3',
          userId: 'user-3',
          to: 'user3@example.com',
          subject: 'High Priority',
          status: EmailStatus.PENDING,
          priority: EmailPriority.HIGH,
          sendAt: new Date()
        }
      ];

      mockDb.client.emailQueue.findMany.mockResolvedValue(mockEmails);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      await emailService.processEmailQueue(10);

      // Verify emails were processed in priority order
      expect(mockDb.client.emailQueue.findMany).toHaveBeenCalledWith({
        where: {
          status: EmailStatus.PENDING,
          sendAt: { lte: expect.any(Date) }
        },
        orderBy: [
          { priority: 'desc' },
          { sendAt: 'asc' }
        ],
        take: 10
      });

      // Verify all emails were processed
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      expect(mockDb.client.emailQueue.update).toHaveBeenCalledTimes(3);
    });

    it('should skip non-pending emails', async () => {
      // Setup mock emails with mixed statuses
      const mockEmails = [
        {
          id: 'email-1',
          userId: 'user-1',
          to: 'user1@example.com',
          subject: 'Pending Email',
          status: EmailStatus.PENDING,
          priority: EmailPriority.MEDIUM,
          sendAt: new Date()
        },
        {
          id: 'email-2',
          userId: 'user-2',
          to: 'user2@example.com',
          subject: 'Sent Email',
          status: EmailStatus.SENT,
          priority: EmailPriority.HIGH,
          sendAt: new Date()
        },
        {
          id: 'email-3',
          userId: 'user-3',
          to: 'user3@example.com',
          subject: 'Failed Email',
          status: EmailStatus.FAILED,
          priority: EmailPriority.URGENT,
          sendAt: new Date()
        }
      ];

      mockDb.client.emailQueue.findMany.mockResolvedValue(mockEmails);
      mockTransporter.sendMail.mockResolvedValue({});

      // Execute
      await emailService.processEmailQueue(10);

      // Verify only pending emails were processed
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockDb.client.emailQueue.update).toHaveBeenCalledTimes(1);
    });

    it('should respect future sendAt dates', async () => {
      // Setup mock emails with future send dates
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const mockEmails = [
        {
          id: 'email-1',
          userId: 'user-1',
          to: 'user1@example.com',
          subject: 'Future Email',
          status: EmailStatus.PENDING,
          priority: EmailPriority.HIGH,
          sendAt: futureDate
        }
      ];

      mockDb.client.emailQueue.findMany.mockResolvedValue(mockEmails);

      // Execute
      await emailService.processEmailQueue(10);

      // Verify future emails were not processed
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      expect(mockDb.client.emailQueue.update).not.toHaveBeenCalled();
    });
  });

  describe('retryFailedEmails', () => {
    it('should retry failed emails with exponential backoff', async () => {
      // Setup mock failed emails
      const mockEmails = [
        {
          id: 'email-1',
          userId: 'user-1',
          to: 'user1@example.com',
          subject: 'Failed Email 1',
          status: EmailStatus.FAILED,
          priority: EmailPriority.HIGH,
          retryCount: 0,
          errorMessage: 'Connection failed'
        },
        {
          id: 'email-2',
          userId: 'user-2',
          to: 'user2@example.com',
          subject: 'Failed Email 2',
          status: EmailStatus.FAILED,
          priority: EmailPriority.MEDIUM,
          retryCount: 2,
          errorMessage: 'SMTP error'
        }
      ];

      mockDb.client.emailQueue.findMany.mockResolvedValue(mockEmails);

      // Execute
      await emailService.retryFailedEmails(3);

      // Verify failed emails were scheduled for retry
      expect(mockDb.client.emailQueue.update).toHaveBeenCalledTimes(2);

      // Check first email (retry count 0 -> 1, 1 minute delay)
      const firstCall = mockDb.client.emailQueue.update.mock.calls[0];
      expect(firstCall[0].where.id).toBe('email-1');
      expect(firstCall[0].data.status).toBe(EmailStatus.RETRYING);
      expect(firstCall[0].data.retryCount).toBe(1);

      // Check second email (retry count 2 -> 3, 4 minute delay)
      const secondCall = mockDb.client.emailQueue.update.mock.calls[1];
      expect(secondCall[0].where.id).toBe('email-2');
      expect(secondCall[0].data.status).toBe(EmailStatus.RETRYING);
      expect(secondCall[0].data.retryCount).toBe(3);
    });

    it('should not retry emails that have reached max retries', async () => {
      // Setup mock failed email at max retries
      const mockEmails = [
        {
          id: 'email-1',
          userId: 'user-1',
          to: 'user1@example.com',
          subject: 'Max Retries Email',
          status: EmailStatus.FAILED,
          priority: EmailPriority.HIGH,
          retryCount: 3,
          errorMessage: 'Connection failed'
        }
      ];

      mockDb.client.emailQueue.findMany.mockResolvedValue(mockEmails);

      // Execute
      await emailService.retryFailedEmails(3);

      // Verify no retry was attempted
      expect(mockDb.client.emailQueue.update).not.toHaveBeenCalled();
    });
  });

  describe('email templates', () => {
    it('should generate correct task assignment template', () => {
      const mockPayload = {
        taskId: 'task-123',
        taskTitle: 'Review Contract',
        caseId: 'case-123',
        caseTitle: 'Smith vs Johnson',
        assignedTo: 'user-123',
        assignedBy: 'user-456',
        dueDate: new Date('2024-12-31'),
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        assigneeName: 'John Doe',
        creatorName: 'Jane Smith',
        caseType: CaseType.CONTRACT_DISPUTE
      };

      // Access private method for testing
      const template = (emailService as any).getTaskAssignmentTemplate(mockPayload);

      expect(template.subject).toBe('新任务分配: Review Contract');
      expect(template.htmlContent).toContain('Review Contract');
      expect(template.htmlContent).toContain('Smith vs Johnson');
      expect(template.htmlContent).toContain('John Doe');
      expect(template.htmlContent).toContain('Jane Smith');
      expect(template.htmlContent).toContain('高');
      expect(template.htmlContent).toContain('待处理');
      expect(template.htmlContent).toContain('2024-12-31');
    });

    it('should generate correct task completion template', () => {
      const mockPayload = {
        taskId: 'task-123',
        taskTitle: 'Review Contract',
        caseId: 'case-123',
        caseTitle: 'Smith vs Johnson',
        assignedTo: 'user-123',
        assignedBy: 'user-456',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.HIGH,
        assigneeName: 'John Doe',
        creatorName: 'Jane Smith',
        caseType: CaseType.CONTRACT_DISPUTE
      };

      // Access private method for testing
      const template = (emailService as any).getTaskCompletionTemplate(mockPayload);

      expect(template.subject).toBe('任务已完成: Review Contract');
      expect(template.htmlContent).toContain('已完成');
      expect(template.htmlContent).toContain('John Doe');
      expect(template.htmlContent).toContain('Jane Smith');
    });

    it('should generate correct deadline reminder template', () => {
      const mockPayload = {
        taskId: 'task-123',
        taskTitle: 'Review Contract',
        caseId: 'case-123',
        caseTitle: 'Smith vs Johnson',
        assignedTo: 'user-123',
        assignedBy: 'user-456',
        dueDate: new Date('2024-12-31'),
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assigneeName: 'John Doe',
        creatorName: 'Jane Smith',
        caseType: CaseType.CONTRACT_DISPUTE
      };

      // Access private method for testing
      const urgentTemplate = (emailService as any).getDeadlineReminderTemplate(mockPayload, 24);
      const normalTemplate = (emailService as any).getDeadlineReminderTemplate(mockPayload, 120);

      expect(urgentTemplate.subject).toBe('紧急任务截止日期提醒: Review Contract');
      expect(urgentTemplate.htmlContent).toContain('紧急');
      expect(urgentTemplate.htmlContent).toContain('24 小时');

      expect(normalTemplate.subject).toBe('提醒任务截止日期: Review Contract');
      expect(normalTemplate.htmlContent).toContain('提醒');
      expect(normalTemplate.htmlContent).toContain('120 小时');
    });

    it('should generate correct overdue task template', () => {
      const mockPayload = {
        taskId: 'task-123',
        taskTitle: 'Review Contract',
        caseId: 'case-123',
        caseTitle: 'Smith vs Johnson',
        assignedTo: 'user-123',
        assignedBy: 'user-456',
        dueDate: new Date('2024-12-31'),
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assigneeName: 'John Doe',
        creatorName: 'Jane Smith',
        caseType: CaseType.CONTRACT_DISPUTE
      };

      // Access private method for testing
      const severeTemplate = (emailService as any).getOverdueTaskTemplate(mockPayload, 5);
      const normalTemplate = (emailService as any).getOverdueTaskTemplate(mockPayload, 1);

      expect(severeTemplate.subject).toBe('严重逾期任务: Review Contract');
      expect(severeTemplate.htmlContent).toContain('严重逾期');
      expect(severeTemplate.htmlContent).toContain('5 天');
      expect(severeTemplate.htmlContent).toContain('此任务已升级给管理员关注');

      expect(normalTemplate.subject).toBe('已逾期任务: Review Contract');
      expect(normalTemplate.htmlContent).toContain('已逾期');
      expect(normalTemplate.htmlContent).toContain('1 天');
      expect(normalTemplate.htmlContent).not.toContain('此任务已升级给管理员关注');
    });
  });

  describe('priority and status labels', () => {
    it('should return correct priority labels', () => {
      const service = emailService as any;
      
      expect(service.getPriorityLabel(TaskPriority.LOW)).toBe('低');
      expect(service.getPriorityLabel(TaskPriority.MEDIUM)).toBe('中');
      expect(service.getPriorityLabel(TaskPriority.HIGH)).toBe('高');
      expect(service.getPriorityLabel(TaskPriority.URGENT)).toBe('紧急');
    });

    it('should return correct status labels', () => {
      const service = emailService as any;
      
      expect(service.getStatusLabel(TaskStatus.PENDING)).toBe('待处理');
      expect(service.getStatusLabel(TaskStatus.IN_PROGRESS)).toBe('进行中');
      expect(service.getStatusLabel(TaskStatus.COMPLETED)).toBe('已完成');
      expect(service.getStatusLabel(TaskStatus.CANCELLED)).toBe('已取消');
    });
  });
});