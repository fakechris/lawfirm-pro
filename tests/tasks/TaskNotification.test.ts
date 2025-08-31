import { TaskNotificationService } from '../../src/services/tasks/TaskNotificationService';
import { NotificationPreferenceService } from '../../src/services/tasks/NotificationPreferenceService';
import { EmailNotificationService } from '../../src/services/tasks/EmailNotificationService';
import { InAppNotificationService } from '../../src/services/tasks/InAppNotificationService';
import { WebSocketService } from '../../src/services/websocket';
import { Database } from '../../src/utils/database';
import { 
  TaskStatus, 
  TaskPriority, 
  UserRole, 
  NotificationType, 
  NotificationPriority,
  EmailFrequency,
  CaseType
} from '@prisma/client';

// Mock all dependencies
jest.mock('../../src/utils/database');
jest.mock('../../src/services/tasks/NotificationPreferenceService');
jest.mock('../../src/services/tasks/EmailNotificationService');
jest.mock('../../src/services/tasks/InAppNotificationService');
jest.mock('../../src/services/websocket');

const MockDatabase = Database as jest.MockedClass<typeof Database>;
const MockNotificationPreferenceService = NotificationPreferenceService as jest.MockedClass<typeof NotificationPreferenceService>;
const MockEmailNotificationService = EmailNotificationService as jest.MockedClass<typeof EmailNotificationService>;
const MockInAppNotificationService = InAppNotificationService as jest.MockedClass<typeof InAppNotificationService>;
const MockWebSocketService = WebSocketService as jest.MockedClass<typeof WebSocketService>;

describe('TaskNotificationService', () => {
  let taskNotificationService: TaskNotificationService;
  let mockDb: any;
  let mockPreferenceService: any;
  let mockEmailService: any;
  let mockInAppService: any;
  let mockWsService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock database instance
    mockDb = {
      client: {
        user: {
          findMany: jest.fn(),
          findUnique: jest.fn()
        }
      }
    };

    // Mock the Database constructor to return our mock
    MockDatabase.mockImplementation(() => mockDb);

    // Create mock service instances
    mockPreferenceService = {
      getUserPreferences: jest.fn()
    };

    mockEmailService = {
      sendTaskAssignmentEmail: jest.fn(),
      sendTaskUpdateEmail: jest.fn(),
      sendTaskCompletionEmail: jest.fn(),
      sendDeadlineReminderEmail: jest.fn(),
      sendOverdueTaskEmail: jest.fn(),
      sendTaskEscalationEmail: jest.fn(),
      sendDependencyBlockedEmail: jest.fn()
    };

    mockInAppService = {
      createNotification: jest.fn()
    };

    mockWsService = {
      broadcastToUser: jest.fn()
    };

    // Mock the service constructors to return our mocks
    MockNotificationPreferenceService.mockImplementation(() => mockPreferenceService);
    MockEmailNotificationService.mockImplementation(() => mockEmailService);
    MockInAppNotificationService.mockImplementation(() => mockInAppService);
    MockWebSocketService.mockImplementation(() => mockWsService);

    // Create task notification service instance
    taskNotificationService = new TaskNotificationService(
      mockDb,
      mockPreferenceService,
      mockEmailService,
      mockInAppService,
      mockWsService
    );
  });

  describe('notifyTaskAssigned', () => {
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
      inAppEnabled: true,
      taskAssignment: true,
      emailFrequency: EmailFrequency.IMMEDIATE,
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      timezone: 'Asia/Shanghai'
    };

    it('should send task assignment notifications successfully', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      
      // Mock current time outside quiet hours
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskAssigned(mockPayload);

      // Verify preference service was called
      expect(mockPreferenceService.getUserPreferences).toHaveBeenCalledWith('user-123');

      // Verify in-app notification was created
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_ASSIGNED,
        title: '新任务分配: Review Contract',
        message: '您被分配了一个新任务 "Review Contract" 在案件 "Smith vs Johnson" 中',
        priority: NotificationPriority.HIGH,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          assignedBy: 'user-456',
          dueDate: mockPayload.dueDate
        }
      });

      // Verify WebSocket notification was sent
      expect(mockWsService.broadcastToUser).toHaveBeenCalledWith('user-123', {
        type: 'task_assigned',
        data: {
          taskId: 'task-123',
          taskTitle: 'Review Contract',
          caseTitle: 'Smith vs Johnson',
          assignedBy: 'Jane Smith',
          dueDate: mockPayload.dueDate,
          priority: TaskPriority.HIGH
        }
      });

      // Verify email was sent
      expect(mockEmailService.sendTaskAssignmentEmail).toHaveBeenCalledWith(mockPayload, mockPreferences);
    });

    it('should not send notifications during quiet hours', async () => {
      // Setup mocks
      const quietHoursPreferences = {
        ...mockPreferences,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00'
      };
      mockPreferenceService.getUserPreferences.mockResolvedValue(quietHoursPreferences);
      
      // Mock current time during quiet hours
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('23:30:00');

      // Execute
      await taskNotificationService.notifyTaskAssigned(mockPayload);

      // Verify no notifications were sent
      expect(mockInAppService.createNotification).not.toHaveBeenCalled();
      expect(mockWsService.broadcastToUser).not.toHaveBeenCalled();
      expect(mockEmailService.sendTaskAssignmentEmail).not.toHaveBeenCalled();
    });

    it('should handle disabled email notifications', async () => {
      // Setup mocks
      const disabledEmailPreferences = {
        ...mockPreferences,
        emailEnabled: false
      };
      mockPreferenceService.getUserPreferences.mockResolvedValue(disabledEmailPreferences);
      
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskAssigned(mockPayload);

      // Verify in-app notification was sent but email was not
      expect(mockInAppService.createNotification).toHaveBeenCalled();
      expect(mockWsService.broadcastToUser).toHaveBeenCalled();
      expect(mockEmailService.sendTaskAssignmentEmail).not.toHaveBeenCalled();
    });

    it('should handle disabled in-app notifications', async () => {
      // Setup mocks
      const disabledInAppPreferences = {
        ...mockPreferences,
        inAppEnabled: false
      };
      mockPreferenceService.getUserPreferences.mockResolvedValue(disabledInAppPreferences);
      
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskAssigned(mockPayload);

      // Verify email was sent but in-app notifications were not
      expect(mockInAppService.createNotification).not.toHaveBeenCalled();
      expect(mockWsService.broadcastToUser).not.toHaveBeenCalled();
      expect(mockEmailService.sendTaskAssignmentEmail).toHaveBeenCalled();
    });

    it('should handle disabled task assignment notifications', async () => {
      // Setup mocks
      const disabledTaskPreferences = {
        ...mockPreferences,
        taskAssignment: false
      };
      mockPreferenceService.getUserPreferences.mockResolvedValue(disabledTaskPreferences);
      
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskAssigned(mockPayload);

      // Verify no notifications were sent
      expect(mockInAppService.createNotification).not.toHaveBeenCalled();
      expect(mockWsService.broadcastToUser).not.toHaveBeenCalled();
      expect(mockEmailService.sendTaskAssignmentEmail).not.toHaveBeenCalled();
    });
  });

  describe('notifyTaskUpdated', () => {
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
      inAppEnabled: true,
      taskAssignment: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send task update notifications for status change', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskUpdated(mockPayload);

      // Verify in-app notification was created with status change message
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_UPDATED,
        title: '任务状态更新: Review Contract',
        message: '任务 "Review Contract" 的状态已从 待处理 更改为 进行中',
        priority: NotificationPriority.HIGH,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          oldStatus: TaskStatus.PENDING,
          newStatus: TaskStatus.IN_PROGRESS,
          oldPriority: TaskPriority.MEDIUM,
          newPriority: TaskPriority.HIGH
        }
      });

      // Verify WebSocket notification was sent
      expect(mockWsService.broadcastToUser).toHaveBeenCalledWith('user-123', {
        type: 'task_updated',
        data: {
          taskId: 'task-123',
          taskTitle: 'Review Contract',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          changes: {
            status: true,
            priority: true
          }
        }
      });
    });

    it('should send task update notifications for priority change', async () => {
      // Setup mocks with only priority change
      const priorityChangePayload = {
        ...mockPayload,
        oldStatus: undefined,
        priority: TaskPriority.URGENT,
        oldPriority: TaskPriority.HIGH
      };
      
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskUpdated(priorityChangePayload);

      // Verify in-app notification was created with priority change message
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_UPDATED,
        title: '任务优先级更新: Review Contract',
        message: '任务 "Review Contract" 的优先级已更改为 紧急',
        priority: NotificationPriority.URGENT,
        data: expect.any(Object)
      });
    });

    it('should send generic update notification for other changes', async () => {
      // Setup mocks with no specific changes
      const genericUpdatePayload = {
        ...mockPayload,
        oldStatus: undefined,
        oldPriority: undefined
      };
      
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskUpdated(genericUpdatePayload);

      // Verify generic update notification was created
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_UPDATED,
        title: '任务更新: Review Contract',
        message: '任务 "Review Contract" 已更新',
        priority: NotificationPriority.HIGH,
        data: expect.any(Object)
      });
    });
  });

  describe('notifyTaskCompleted', () => {
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
      inAppEnabled: true,
      taskCompletion: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send task completion notifications to both assignee and creator', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskCompleted(mockPayload);

      // Verify assignee received notification
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_COMPLETED,
        title: '任务完成: Review Contract',
        message: '您已完成任务 "Review Contract"',
        priority: NotificationPriority.MEDIUM,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          completedAt: expect.any(Date)
        }
      });

      // Verify creator received email notification (since they are different from assignee)
      expect(mockEmailService.sendTaskCompletionEmail).toHaveBeenCalledWith(mockPayload, mockPreferences);
      expect(mockWsService.broadcastToUser).toHaveBeenCalledWith('user-456', {
        type: 'task_completed',
        data: {
          taskId: 'task-123',
          taskTitle: 'Review Contract',
          completedBy: 'John Doe',
          caseTitle: 'Smith vs Johnson'
        }
      });
    });

    it('should not send duplicate notifications when assignee is also creator', async () => {
      // Setup mocks with same user
      const sameUserPayload = {
        ...mockPayload,
        assignedTo: 'user-123',
        assignedBy: 'user-123'
      };
      
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskCompleted(sameUserPayload);

      // Verify only one notification was sent to the user
      expect(mockInAppService.createNotification).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendTaskCompletionEmail).not.toHaveBeenCalled();
    });
  });

  describe('notifyTaskDeadlineReminder', () => {
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
      inAppEnabled: true,
      taskDeadline: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send urgent deadline reminder for 24 hours', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskDeadlineReminder(mockPayload, 24);

      // Verify urgent notification was created
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_DEADLINE_REMINDER,
        title: '紧急任务截止日期: Review Contract',
        message: '任务 "Review Contract" 将在 24 小时后到期',
        priority: NotificationPriority.URGENT,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          dueDate: mockPayload.dueDate,
          hoursUntilDeadline: 24
        }
      });

      // Verify email was sent with urgent priority
      expect(mockEmailService.sendDeadlineReminderEmail).toHaveBeenCalledWith(mockPayload, 24, mockPreferences);
    });

    it('should send high priority reminder for 72 hours', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskDeadlineReminder(mockPayload, 72);

      // Verify high priority notification was created
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_DEADLINE_REMINDER,
        title: '即将到期任务截止日期: Review Contract',
        message: '任务 "Review Contract" 将在 72 小时后到期',
        priority: NotificationPriority.HIGH,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          dueDate: mockPayload.dueDate,
          hoursUntilDeadline: 72
        }
      });
    });

    it('should send medium priority reminder for more than 72 hours', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskDeadlineReminder(mockPayload, 120);

      // Verify medium priority notification was created
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.TASK_DEADLINE_REMINDER,
        title: '提醒任务截止日期: Review Contract',
        message: '任务 "Review Contract" 将在 120 小时后到期',
        priority: NotificationPriority.MEDIUM,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          dueDate: mockPayload.dueDate,
          hoursUntilDeadline: 120
        }
      });
    });
  });

  describe('notifyTaskOverdue', () => {
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
      inAppEnabled: true,
      taskDeadline: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send overdue notification and escalate for severe overdue', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockDb.client.user.findMany.mockResolvedValue([
        { id: 'admin-1', email: 'admin1@example.com', firstName: 'Admin', lastName: 'One' }
      ]);
      
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskOverdue(mockPayload, 5, { isEscalation: true });

      // Verify overdue notification was sent to assignee
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.OVERDUE_TASK,
        title: '任务逾期: Review Contract',
        message: '任务 "Review Contract" 已逾期 5 天',
        priority: NotificationPriority.HIGH,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          dueDate: mockPayload.dueDate,
          daysOverdue: 5
        }
      });

      // Verify escalation notification was sent to admin
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'admin-1',
        type: NotificationType.TASK_ESCALATION,
        title: '严重逾期任务: Review Contract',
        message: '任务 "Review Contract" 已逾期 5 天，需要立即关注',
        priority: NotificationPriority.URGENT,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          assignedTo: 'user-123',
          daysOverdue: 5,
          escalationReason: '任务逾期 5 天'
        }
      });

      // Verify email was sent
      expect(mockEmailService.sendOverdueTaskEmail).toHaveBeenCalledWith(mockPayload, 5, mockPreferences);
    });

    it('should not escalate for minor overdue', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskOverdue(mockPayload, 1, { isEscalation: true });

      // Verify overdue notification was sent but no escalation
      expect(mockInAppService.createNotification).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendOverdueTaskEmail).toHaveBeenCalledWith(mockPayload, 1, mockPreferences);
    });
  });

  describe('notifyTaskEscalation', () => {
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
      inAppEnabled: true,
      taskEscalation: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send escalation notifications to all admin users', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockDb.client.user.findMany.mockResolvedValue([mockAdminUser]);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskEscalation(mockPayload, 'Task is severely overdue');

      // Verify escalation notification was sent to admin
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'admin-1',
        type: NotificationType.TASK_ESCALATION,
        title: '任务升级: Review Contract',
        message: '任务 "Review Contract" 需要关注: Task is severely overdue',
        priority: NotificationPriority.URGENT,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          assignedTo: 'user-123',
          escalationReason: 'Task is severely overdue'
        }
      });

      // Verify WebSocket notification was sent
      expect(mockWsService.broadcastToUser).toHaveBeenCalledWith('admin-1', {
        type: 'task_escalation',
        data: {
          taskId: 'task-123',
          taskTitle: 'Review Contract',
          caseTitle: 'Smith vs Johnson',
          assignedTo: 'John Doe',
          escalationReason: 'Task is severely overdue'
        }
      });

      // Verify email was sent
      expect(mockEmailService.sendTaskEscalationEmail).toHaveBeenCalledWith(
        mockPayload, 
        'Task is severely overdue', 
        mockAdminUser, 
        mockPreferences
      );
    });

    it('should handle multiple admin users', async () => {
      // Setup mocks
      const multipleAdmins = [
        mockAdminUser,
        { id: 'admin-2', email: 'admin2@example.com', firstName: 'Admin', lastName: 'Two' }
      ];
      
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockDb.client.user.findMany.mockResolvedValue(multipleAdmins);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyTaskEscalation(mockPayload, 'Multiple issues detected');

      // Verify notifications were sent to all admins
      expect(mockInAppService.createNotification).toHaveBeenCalledTimes(2);
      expect(mockWsService.broadcastToUser).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendTaskEscalationEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifyDependencyBlocked', () => {
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
      inAppEnabled: true,
      emailFrequency: EmailFrequency.IMMEDIATE
    };

    it('should send dependency blocked notification', async () => {
      // Setup mocks
      mockPreferenceService.getUserPreferences.mockResolvedValue(mockPreferences);
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('14:30:00');

      // Execute
      await taskNotificationService.notifyDependencyBlocked(mockPayload, 'Prepare Documents');

      // Verify blocked notification was sent
      expect(mockInAppService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: NotificationType.DEPENDENCY_BLOCKED,
        title: '任务被阻止: Review Contract',
        message: '任务 "Review Contract" 被依赖任务 "Prepare Documents" 阻止',
        priority: NotificationPriority.HIGH,
        data: {
          taskId: 'task-123',
          caseId: 'case-123',
          blockedByTaskTitle: 'Prepare Documents'
        }
      });

      // Verify WebSocket notification was sent
      expect(mockWsService.broadcastToUser).toHaveBeenCalledWith('user-123', {
        type: 'dependency_blocked',
        data: {
          taskId: 'task-123',
          taskTitle: 'Review Contract',
          blockedByTaskTitle: 'Prepare Documents'
        }
      });

      // Verify email was sent
      expect(mockEmailService.sendDependencyBlockedEmail).toHaveBeenCalledWith(
        mockPayload, 
        'Prepare Documents', 
        mockPreferences
      );
    });
  });

  describe('priority mapping', () => {
    it('should correctly map task priorities to notification priorities', () => {
      const testCases = [
        { taskPriority: TaskPriority.URGENT, expected: NotificationPriority.URGENT },
        { taskPriority: TaskPriority.HIGH, expected: NotificationPriority.HIGH },
        { taskPriority: TaskPriority.MEDIUM, expected: NotificationPriority.MEDIUM },
        { taskPriority: TaskPriority.LOW, expected: NotificationPriority.LOW }
      ];

      testCases.forEach(({ taskPriority, expected }) => {
        // Access private method for testing
        const result = (taskNotificationService as any).mapTaskPriorityToNotificationPriority(taskPriority);
        expect(result).toBe(expected);
      });
    });
  });

  describe('quiet hours checking', () => {
    const mockPreferences = {
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      timezone: 'Asia/Shanghai'
    };

    it('should detect active quiet hours correctly', () => {
      const testCases = [
        { currentTime: '23:30', expected: true },   // During quiet hours
        { currentTime: '03:00', expected: true },   // During quiet hours (overnight)
        { currentTime: '14:30', expected: false },  // Outside quiet hours
        { currentTime: '06:30', expected: false },  // Outside quiet hours
        { currentTime: '21:59', expected: false },  // Just before quiet hours
        { currentTime: '22:00', expected: true },   // At quiet hours start
        { currentTime: '06:00', expected: true }    // At quiet hours end
      ];

      testCases.forEach(({ currentTime, expected }) => {
        jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue(`${currentTime}:00`);
        
        const result = (taskNotificationService as any).checkQuietHours('user-123', mockPreferences, false);
        expect(result).toBe(expected);
      });
    });

    it('should override quiet hours when specified', () => {
      jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('23:30:00');
      
      const result = (taskNotificationService as any).checkQuietHours('user-123', mockPreferences, true);
      expect(result).toBe(true);
    });

    it('should allow notifications when no quiet hours are set', () => {
      const noQuietHoursPreferences = { ...mockPreferences, quietHoursStart: null, quietHoursEnd: null };
      
      const result = (taskNotificationService as any).checkQuietHours('user-123', noQuietHoursPreferences, false);
      expect(result).toBe(true);
    });
  });
});