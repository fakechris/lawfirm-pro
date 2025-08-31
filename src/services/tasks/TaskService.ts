import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { Utils } from '../../utils';
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  User, 
  UserRole,
  Case,
  ClientProfile,
  AttorneyProfile
} from '@prisma/client';

export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  caseId: string;
  assignedTo: string;
  assignedBy: string;
  dueDate?: Date;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  case: {
    id: string;
    title: string;
    caseType: string;
    status: string;
  };
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  caseId: string;
  assignedTo: string;
  dueDate?: Date;
  priority: TaskPriority;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: Date;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  caseId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  dueToday: number;
  highPriority: number;
}

@injectable()
export class TaskService {
  constructor(@inject(Database) private db: Database) {}

  async createTask(taskRequest: CreateTaskRequest, createdBy: string): Promise<TaskResponse> {
    const { title, description, caseId, assignedTo, dueDate, priority } = taskRequest;

    // Verify case exists and user has access
    const caseRecord = await this.db.client.case.findUnique({
      where: { id: caseId },
      include: {
        attorney: {
          include: { user: true }
        },
        client: {
          include: { user: true }
        }
      }
    });

    if (!caseRecord) {
      throw new Error('Case not found');
    }

    // Verify assignee exists
    const assignee = await this.db.client.user.findUnique({
      where: { id: assignedTo }
    });

    if (!assignee) {
      throw new Error('Assignee not found');
    }

    // Validate role-based assignment
    this.validateRoleAssignment(assignee.role, caseRecord.caseType);

    const task = await this.db.client.task.create({
      data: {
        title,
        description,
        caseId,
        assignedTo,
        assignedBy: createdBy,
        dueDate,
        priority,
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

    return this.mapTaskToResponse(task);
  }

  async getTaskById(taskId: string, userId: string, userRole: UserRole): Promise<TaskResponse> {
    const task = await this.db.client.task.findUnique({
      where: { id: taskId },
      include: {
        case: {
          include: {
            attorney: {
              include: { user: true }
            },
            client: {
              include: { user: true }
            }
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

    if (!task) {
      throw new Error('Task not found');
    }

    // Check if user has permission to view this task
    this.validateTaskAccess(task, userId, userRole);

    return this.mapTaskToResponse(task);
  }

  async getTasks(filters: TaskFilters, userId: string, userRole: UserRole): Promise<TaskResponse[]> {
    const whereClause: any = {};

    // Apply filters
    if (filters.status) whereClause.status = filters.status;
    if (filters.priority) whereClause.priority = filters.priority;
    if (filters.assignedTo) whereClause.assignedTo = filters.assignedTo;
    if (filters.caseId) whereClause.caseId = filters.caseId;
    if (filters.dueBefore || filters.dueAfter) {
      whereClause.dueDate = {};
      if (filters.dueBefore) whereClause.dueDate.lte = filters.dueBefore;
      if (filters.dueAfter) whereClause.dueDate.gte = filters.dueAfter;
    }

    // Apply role-based access control
    if (userRole !== UserRole.ADMIN) {
      whereClause.OR = [
        { assignedTo: userId },
        { assignedBy: userId }
      ];
    }

    const tasks = await this.db.client.task.findMany({
      where: whereClause,
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

    return tasks.map(task => this.mapTaskToResponse(task));
  }

  async updateTask(taskId: string, updateRequest: UpdateTaskRequest, userId: string, userRole: UserRole): Promise<TaskResponse> {
    const existingTask = await this.db.client.task.findUnique({
      where: { id: taskId },
      include: {
        case: {
          include: {
            attorney: {
              include: { user: true }
            },
            client: {
              include: { user: true }
            }
          }
        }
      }
    });

    if (!existingTask) {
      throw new Error('Task not found');
    }

    // Check if user has permission to update this task
    this.validateTaskAccess(existingTask, userId, userRole);

    // Validate role-based assignment if changing assignee
    if (updateRequest.assignedTo && updateRequest.assignedTo !== existingTask.assignedTo) {
      const newAssignee = await this.db.client.user.findUnique({
        where: { id: updateRequest.assignedTo }
      });

      if (!newAssignee) {
        throw new Error('New assignee not found');
      }

      this.validateRoleAssignment(newAssignee.role, existingTask.case.caseType);
    }

    const updateData: any = { ...updateRequest };

    // Handle status change to completed
    if (updateRequest.status === TaskStatus.COMPLETED && existingTask.status !== TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (updateRequest.status !== TaskStatus.COMPLETED && existingTask.status === TaskStatus.COMPLETED) {
      updateData.completedAt = null;
    }

    const updatedTask = await this.db.client.task.update({
      where: { id: taskId },
      data: updateData,
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

    return this.mapTaskToResponse(updatedTask);
  }

  async deleteTask(taskId: string, userId: string, userRole: UserRole): Promise<void> {
    const existingTask = await this.db.client.task.findUnique({
      where: { id: taskId },
      include: {
        case: {
          include: {
            attorney: {
              include: { user: true }
            }
          }
        }
      }
    });

    if (!existingTask) {
      throw new Error('Task not found');
    }

    // Check if user has permission to delete this task
    const hasDeleteAccess = 
      userRole === UserRole.ADMIN ||
      existingTask.assignedBy === userId ||
      (userRole === UserRole.ATTORNEY && existingTask.case.attorney.userId === userId);

    if (!hasDeleteAccess) {
      throw new Error('Access denied');
    }

    await this.db.client.task.delete({
      where: { id: taskId }
    });
  }

  async getTaskStats(userId: string, userRole: UserRole): Promise<TaskStats> {
    const whereClause: any = {};

    // Apply role-based access control
    if (userRole !== UserRole.ADMIN) {
      whereClause.OR = [
        { assignedTo: userId },
        { assignedBy: userId }
      ];
    }

    const tasks = await this.db.client.task.findMany({
      where: whereClause
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
      inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      cancelled: tasks.filter(t => t.status === TaskStatus.CANCELLED).length,
      overdue: tasks.filter(t => 
        t.dueDate && 
        t.dueDate < now && 
        t.status !== TaskStatus.COMPLETED && 
        t.status !== TaskStatus.CANCELLED
      ).length,
      dueToday: tasks.filter(t => 
        t.dueDate && 
        t.dueDate >= today && 
        t.dueDate < tomorrow &&
        t.status !== TaskStatus.COMPLETED &&
        t.status !== TaskStatus.CANCELLED
      ).length,
      highPriority: tasks.filter(t => 
        t.priority === TaskPriority.HIGH || 
        t.priority === TaskPriority.URGENT
      ).length
    };
  }

  async getTasksByCase(caseId: string, userId: string, userRole: UserRole): Promise<TaskResponse[]> {
    const caseRecord = await this.db.client.case.findUnique({
      where: { id: caseId },
      include: {
        attorney: {
          include: { user: true }
        },
        client: {
          include: { user: true }
        }
      }
    });

    if (!caseRecord) {
      throw new Error('Case not found');
    }

    // Check if user has access to this case
    const hasCaseAccess = 
      userRole === UserRole.ADMIN ||
      (userRole === UserRole.ATTORNEY && caseRecord.attorney.userId === userId) ||
      (userRole === UserRole.CLIENT && caseRecord.client.userId === userId);

    if (!hasCaseAccess) {
      throw new Error('Access denied');
    }

    const tasks = await this.db.client.task.findMany({
      where: { caseId },
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

    return tasks.map(task => this.mapTaskToResponse(task));
  }

  private validateRoleAssignment(role: UserRole, caseType: string): void {
    // Basic validation - can be extended based on firm-specific rules
    const validRoles = [UserRole.ATTORNEY, UserRole.ADMIN, UserRole.ASSISTANT];
    
    if (!validRoles.includes(role)) {
      throw new Error(`User role ${role} cannot be assigned tasks`);
    }
  }

  private validateTaskAccess(task: any, userId: string, userRole: UserRole): void {
    const hasAccess = 
      userRole === UserRole.ADMIN ||
      task.assignedTo === userId ||
      task.assignedBy === userId ||
      (userRole === UserRole.ATTORNEY && task.case.attorney.userId === userId) ||
      (userRole === UserRole.CLIENT && task.case.client.userId === userId);

    if (!hasAccess) {
      throw new Error('Access denied');
    }
  }

  private mapTaskToResponse(task: any): TaskResponse {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      caseId: task.caseId,
      assignedTo: task.assignedTo,
      assignedBy: task.assignedBy,
      dueDate: task.dueDate,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      case: {
        id: task.case.id,
        title: task.case.title,
        caseType: task.case.caseType,
        status: task.case.status
      },
      assignee: {
        id: task.assignee.id,
        firstName: task.assignee.firstName,
        lastName: task.assignee.lastName,
        email: task.assignee.email,
        role: task.assignee.role
      },
      creator: {
        id: task.creator.id,
        firstName: task.creator.firstName,
        lastName: task.creator.lastName,
        email: task.creator.email,
        role: task.creator.role
      }
    };
  }
}