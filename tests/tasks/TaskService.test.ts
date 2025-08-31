import { TaskService } from '../../src/services/tasks/TaskService';
import { Database } from '../../src/utils/database';
import { TaskStatus, TaskPriority, UserRole, CaseType, CaseStatus } from '@prisma/client';

// Mock Database
jest.mock('../../src/utils/database');

const MockDatabase = Database as jest.MockedClass<typeof Database>;

describe('TaskService', () => {
  let taskService: TaskService;
  let mockDb: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock database instance
    mockDb = {
      client: {
        task: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        },
        user: {
          findUnique: jest.fn()
        },
        case: {
          findUnique: jest.fn()
        }
      },
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    // Mock the Database constructor to return our mock
    MockDatabase.mockImplementation(() => mockDb);

    // Create task service instance
    taskService = new TaskService(mockDb);
  });

  describe('createTask', () => {
    const mockTaskRequest = {
      title: 'Test Task',
      description: 'Test Description',
      caseId: 'case-123',
      assignedTo: 'user-123',
      dueDate: new Date('2024-12-31'),
      priority: TaskPriority.HIGH
    };

    const mockCase = {
      id: 'case-123',
      caseType: CaseType.CONTRACT_DISPUTE,
      attorney: { user: { id: 'attorney-123' } },
      client: { user: { id: 'client-123' } }
    };

    const mockAssignee = {
      id: 'user-123',
      role: UserRole.ATTORNEY
    };

    const mockCreatedTask = {
      id: 'task-123',
      ...mockTaskRequest,
      assignedBy: 'creator-123',
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      case: {
        id: 'case-123',
        title: 'Test Case',
        caseType: CaseType.CONTRACT_DISPUTE,
        status: CaseStatus.ACTIVE
      },
      assignee: {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: UserRole.ATTORNEY
      },
      creator: {
        id: 'creator-123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: UserRole.ADMIN
      }
    };

    it('should create a task successfully', async () => {
      // Setup mocks
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.user.findUnique.mockResolvedValue(mockAssignee);
      mockDb.client.task.create.mockResolvedValue(mockCreatedTask);

      // Execute
      const result = await taskService.createTask(mockTaskRequest, 'creator-123');

      // Verify
      expect(mockDb.client.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        include: {
          attorney: { include: { user: true } },
          client: { include: { user: true } }
        }
      });

      expect(mockDb.client.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      });

      expect(mockDb.client.task.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Task',
          description: 'Test Description',
          caseId: 'case-123',
          assignedTo: 'user-123',
          assignedBy: 'creator-123',
          dueDate: mockTaskRequest.dueDate,
          priority: TaskPriority.HIGH,
          status: TaskStatus.PENDING
        },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseType: true,
              status: true
            }
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        }
      });

      expect(result).toEqual({
        id: 'task-123',
        title: 'Test Task',
        description: 'Test Description',
        caseId: 'case-123',
        assignedTo: 'user-123',
        assignedBy: 'creator-123',
        dueDate: mockTaskRequest.dueDate,
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        completedAt: undefined,
        case: {
          id: 'case-123',
          title: 'Test Case',
          caseType: 'CONTRACT_DISPUTE',
          status: 'ACTIVE'
        },
        assignee: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'ATTORNEY'
        },
        creator: {
          id: 'creator-123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          role: 'ADMIN'
        }
      });
    });

    it('should throw error when case is not found', async () => {
      // Setup mocks
      mockDb.client.case.findUnique.mockResolvedValue(null);

      // Execute & Verify
      await expect(taskService.createTask(mockTaskRequest, 'creator-123'))
        .rejects.toThrow('Case not found');
    });

    it('should throw error when assignee is not found', async () => {
      // Setup mocks
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.user.findUnique.mockResolvedValue(null);

      // Execute & Verify
      await expect(taskService.createTask(mockTaskRequest, 'creator-123'))
        .rejects.toThrow('Assignee not found');
    });

    it('should throw error when user role cannot be assigned tasks', async () => {
      // Setup mocks
      const invalidAssignee = { ...mockAssignee, role: UserRole.CLIENT };
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.user.findUnique.mockResolvedValue(invalidAssignee);

      // Execute & Verify
      await expect(taskService.createTask(mockTaskRequest, 'creator-123'))
        .rejects.toThrow('User role CLIENT cannot be assigned tasks');
    });

    it('should create task without due date', async () => {
      // Setup
      const taskWithoutDueDate = { ...mockTaskRequest, dueDate: undefined };
      const createdTaskWithoutDue = { ...mockCreatedTask, dueDate: null };

      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.user.findUnique.mockResolvedValue(mockAssignee);
      mockDb.client.task.create.mockResolvedValue(createdTaskWithoutDue);

      // Execute
      const result = await taskService.createTask(taskWithoutDueDate, 'creator-123');

      // Verify
      expect(mockDb.client.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dueDate: null
        }),
        include: expect.any(Object)
      });

      expect(result.dueDate).toBeUndefined();
    });
  });

  describe('getTaskById', () => {
    const mockTask = {
      id: 'task-123',
      title: 'Test Task',
      description: 'Test Description',
      caseId: 'case-123',
      assignedTo: 'user-123',
      assignedBy: 'creator-123',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      case: {
        id: 'case-123',
        title: 'Test Case',
        caseType: CaseType.CONTRACT_DISPUTE,
        status: CaseStatus.ACTIVE,
        attorney: { user: { id: 'attorney-123' } },
        client: { user: { id: 'client-123' } }
      },
      assignee: {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: UserRole.ATTORNEY
      },
      creator: {
        id: 'creator-123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: UserRole.ADMIN
      }
    };

    it('should get task by ID successfully', async () => {
      // Setup
      mockDb.client.task.findUnique.mockResolvedValue(mockTask);

      // Execute
      const result = await taskService.getTaskById('task-123', 'user-123', UserRole.ATTORNEY);

      // Verify
      expect(mockDb.client.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        include: {
          case: {
            include: {
              attorney: { include: { user: true } },
              client: { include: { user: true } }
            }
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        }
      });

      expect(result.id).toBe('task-123');
      expect(result.title).toBe('Test Task');
    });

    it('should throw error when task is not found', async () => {
      // Setup
      mockDb.client.task.findUnique.mockResolvedValue(null);

      // Execute & Verify
      await expect(taskService.getTaskById('non-existent', 'user-123', UserRole.ATTORNEY))
        .rejects.toThrow('Task not found');
    });

    it('should throw error when user lacks access to task', async () => {
      // Setup
      mockDb.client.task.findUnique.mockResolvedValue(mockTask);

      // Execute & Verify - user with no access
      await expect(taskService.getTaskById('task-123', 'unauthorized-user', UserRole.CLIENT))
        .rejects.toThrow('Access denied');
    });
  });

  describe('getTasks', () => {
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Task 1',
        caseId: 'case-123',
        assignedTo: 'user-123',
        assignedBy: 'creator-123',
        dueDate: new Date('2024-12-31'),
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'case-123',
          title: 'Test Case',
          caseType: CaseType.CONTRACT_DISPUTE,
          status: CaseStatus.ACTIVE
        },
        assignee: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: UserRole.ATTORNEY
        },
        creator: {
          id: 'creator-123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          role: UserRole.ADMIN
        }
      }
    ];

    it('should get tasks with filters for admin user', async () => {
      // Setup
      const filters = {
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        caseId: 'case-123'
      };

      mockDb.client.task.findMany.mockResolvedValue(mockTasks);

      // Execute
      const result = await taskService.getTasks(filters, 'admin-user', UserRole.ADMIN);

      // Verify
      expect(mockDb.client.task.findMany).toHaveBeenCalledWith({
        where: {
          status: TaskStatus.PENDING,
          priority: TaskPriority.HIGH,
          caseId: 'case-123'
        },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseType: true,
              status: true
            }
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' }
        ]
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('should get tasks with user access restrictions for non-admin', async () => {
      // Setup
      const filters = { status: TaskStatus.PENDING };
      mockDb.client.task.findMany.mockResolvedValue(mockTasks);

      // Execute
      const result = await taskService.getTasks(filters, 'user-123', UserRole.ATTORNEY);

      // Verify
      expect(mockDb.client.task.findMany).toHaveBeenCalledWith({
        where: {
          status: TaskStatus.PENDING,
          OR: [
            { assignedTo: 'user-123' },
            { assignedBy: 'user-123' }
          ]
        },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      });
    });

    it('should handle date range filters', async () => {
      // Setup
      const filters = {
        dueBefore: new Date('2024-12-31'),
        dueAfter: new Date('2024-12-01')
      };

      mockDb.client.task.findMany.mockResolvedValue(mockTasks);

      // Execute
      await taskService.getTasks(filters, 'admin-user', UserRole.ADMIN);

      // Verify
      expect(mockDb.client.task.findMany).toHaveBeenCalledWith({
        where: {
          dueDate: {
            lte: filters.dueBefore,
            gte: filters.dueAfter
          }
        },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      });
    });
  });

  describe('updateTask', () => {
    const mockExistingTask = {
      id: 'task-123',
      title: 'Original Task',
      description: 'Original Description',
      caseId: 'case-123',
      assignedTo: 'user-123',
      assignedBy: 'creator-123',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      case: {
        attorney: { user: { id: 'attorney-123' } },
        client: { user: { id: 'client-123' } }
      }
    };

    const mockUpdatedTask = {
      id: 'task-123',
      title: 'Updated Task',
      description: 'Updated Description',
      caseId: 'case-123',
      assignedTo: 'user-123',
      assignedBy: 'creator-123',
      dueDate: new Date('2024-12-31'),
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      case: {
        id: 'case-123',
        title: 'Test Case',
        caseType: CaseType.CONTRACT_DISPUTE,
        status: CaseStatus.ACTIVE
      },
      assignee: {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: UserRole.ATTORNEY
      },
      creator: {
        id: 'creator-123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: UserRole.ADMIN
      }
    };

    it('should update task successfully', async () => {
      // Setup
      const updateRequest = {
        title: 'Updated Task',
        description: 'Updated Description',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH
      };

      mockDb.client.task.findUnique.mockResolvedValue(mockExistingTask);
      mockDb.client.task.update.mockResolvedValue(mockUpdatedTask);

      // Execute
      const result = await taskService.updateTask(
        'task-123', 
        updateRequest, 
        'user-123', 
        UserRole.ATTORNEY
      );

      // Verify
      expect(mockDb.client.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: updateRequest,
        include: expect.any(Object)
      });

      expect(result.title).toBe('Updated Task');
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should set completedAt when status changes to COMPLETED', async () => {
      // Setup
      const updateRequest = { status: TaskStatus.COMPLETED };
      const completedTask = { ...mockUpdatedTask, completedAt: new Date() };

      mockDb.client.task.findUnique.mockResolvedValue(mockExistingTask);
      mockDb.client.task.update.mockResolvedValue(completedTask);

      // Execute
      const result = await taskService.updateTask(
        'task-123', 
        updateRequest, 
        'user-123', 
        UserRole.ATTORNEY
      );

      // Verify
      expect(mockDb.client.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: expect.any(Date)
        },
        include: expect.any(Object)
      });

      expect(result.completedAt).toBeDefined();
    });

    it('should clear completedAt when status changes from COMPLETED', async () => {
      // Setup
      const completedExistingTask = { ...mockExistingTask, status: TaskStatus.COMPLETED };
      const updateRequest = { status: TaskStatus.IN_PROGRESS };

      mockDb.client.task.findUnique.mockResolvedValue(completedExistingTask);
      mockDb.client.task.update.mockResolvedValue(mockUpdatedTask);

      // Execute
      const result = await taskService.updateTask(
        'task-123', 
        updateRequest, 
        'user-123', 
        UserRole.ATTORNEY
      );

      // Verify
      expect(mockDb.client.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          status: TaskStatus.IN_PROGRESS,
          completedAt: null
        },
        include: expect.any(Object)
      });
    });

    it('should throw error when task is not found', async () => {
      // Setup
      mockDb.client.task.findUnique.mockResolvedValue(null);

      // Execute & Verify
      await expect(taskService.updateTask(
        'non-existent', 
        { title: 'Updated' }, 
        'user-123', 
        UserRole.ATTORNEY
      )).rejects.toThrow('Task not found');
    });
  });

  describe('deleteTask', () => {
    const mockExistingTask = {
      id: 'task-123',
      assignedBy: 'creator-123',
      case: {
        attorney: { user: { id: 'attorney-123' } }
      }
    };

    it('should delete task successfully when user has permission', async () => {
      // Setup
      mockDb.client.task.findUnique.mockResolvedValue(mockExistingTask);
      mockDb.client.task.delete.mockResolvedValue({});

      // Execute
      await taskService.deleteTask('task-123', 'creator-123', UserRole.ADMIN);

      // Verify
      expect(mockDb.client.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-123' }
      });
    });

    it('should throw error when task is not found', async () => {
      // Setup
      mockDb.client.task.findUnique.mockResolvedValue(null);

      // Execute & Verify
      await expect(taskService.deleteTask('non-existent', 'user-123', UserRole.ATTORNEY))
        .rejects.toThrow('Task not found');
    });

    it('should throw error when user lacks delete permission', async () => {
      // Setup
      mockDb.client.task.findUnique.mockResolvedValue(mockExistingTask);

      // Execute & Verify - user who didn't create task and is not admin or attorney
      await expect(taskService.deleteTask('task-123', 'unauthorized-user', UserRole.ASSISTANT))
        .rejects.toThrow('Access denied');
    });
  });

  describe('getTaskStats', () => {
    const mockTasks = [
      { status: TaskStatus.PENDING, priority: TaskPriority.HIGH, dueDate: new Date('2024-12-31') },
      { status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, dueDate: new Date() },
      { status: TaskStatus.COMPLETED, priority: TaskPriority.MEDIUM, dueDate: new Date('2024-12-31') },
      { status: TaskStatus.CANCELLED, priority: TaskPriority.LOW, dueDate: new Date('2024-12-31') },
      { status: TaskStatus.PENDING, priority: TaskPriority.HIGH, dueDate: new Date('2024-11-01') } // Overdue
    ];

    it('should calculate task statistics correctly', async () => {
      // Setup
      mockDb.client.task.findMany.mockResolvedValue(mockTasks);

      // Execute
      const result = await taskService.getTaskStats('user-123', UserRole.ADMIN);

      // Verify
      expect(result).toEqual({
        total: 5,
        pending: 2,
        inProgress: 1,
        completed: 1,
        cancelled: 1,
        overdue: 1,
        dueToday: expect.any(Number),
        highPriority: 2
      });
    });

    it('should apply user access restrictions for non-admin users', async () => {
      // Setup
      mockDb.client.task.findMany.mockResolvedValue(mockTasks);

      // Execute
      await taskService.getTaskStats('user-123', UserRole.ATTORNEY);

      // Verify
      expect(mockDb.client.task.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { assignedTo: 'user-123' },
            { assignedBy: 'user-123' }
          ]
        }
      });
    });
  });

  describe('getTasksByCase', () => {
    const mockCase = {
      id: 'case-123',
      attorney: { user: { id: 'attorney-123' } },
      client: { user: { id: 'client-123' } }
    };

    const mockCaseTasks = [
      {
        id: 'task-1',
        title: 'Case Task 1',
        caseId: 'case-123',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        assignee: { id: 'user-123', firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: UserRole.ATTORNEY },
        creator: { id: 'creator-123', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: UserRole.ADMIN }
      }
    ];

    it('should get tasks by case successfully', async () => {
      // Setup
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.task.findMany.mockResolvedValue(mockCaseTasks);

      // Execute
      const result = await taskService.getTasksByCase('case-123', 'attorney-123', UserRole.ATTORNEY);

      // Verify
      expect(mockDb.client.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        include: {
          attorney: { include: { user: true } },
          client: { include: { user: true } }
        }
      });

      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe('case-123');
    });

    it('should throw error when case is not found', async () => {
      // Setup
      mockDb.client.case.findUnique.mockResolvedValue(null);

      // Execute & Verify
      await expect(taskService.getTasksByCase('non-existent', 'user-123', UserRole.ATTORNEY))
        .rejects.toThrow('Case not found');
    });

    it('should throw error when user lacks access to case', async () => {
      // Setup
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);

      // Execute & Verify - unauthorized user
      await expect(taskService.getTasksByCase('case-123', 'unauthorized-user', UserRole.CLIENT))
        .rejects.toThrow('Access denied');
    });
  });
});