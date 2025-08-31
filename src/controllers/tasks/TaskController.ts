import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { TaskService } from '../services/tasks/TaskService';
import { TaskAssignmentService } from '../services/tasks/TaskAssignmentService';
import { TaskDependencyService } from '../services/tasks/TaskDependencyService';
import { TaskPriorityService } from '../services/tasks/TaskPriorityService';
import { Database } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { 
  TaskStatus, 
  TaskPriority, 
  UserRole,
  DependencyType,
  CaseType
} from '@prisma/client';

@injectable()
export class TaskController {
  constructor(
    @inject(TaskService) private taskService: TaskService,
    @inject(TaskAssignmentService) private assignmentService: TaskAssignmentService,
    @inject(TaskDependencyService) private dependencyService: TaskDependencyService,
    @inject(TaskPriorityService) private priorityService: TaskPriorityService,
    @inject(Database) private db: Database
  ) {}

  // Validation schemas
  private createTaskSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    caseId: z.string().min(1, 'Case ID is required'),
    assignedTo: z.string().min(1, 'Assigned to is required'),
    dueDate: z.string().datetime().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM')
  });

  private updateTaskSchema = z.object({
    title: z.string().min(1, 'Title is required').optional(),
    description: z.string().optional(),
    assignedTo: z.string().min(1, 'Assigned to is required').optional(),
    dueDate: z.string().datetime().optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional()
  });

  private createDependencySchema = z.object({
    taskId: z.string().min(1, 'Task ID is required'),
    dependsOnTaskId: z.string().min(1, 'Dependency task ID is required'),
    dependencyType: z.enum(['BLOCKING', 'SEQUENTIAL', 'PARALLEL', 'SUGGESTED']).optional().default('BLOCKING')
  });

  private assignmentCriteriaSchema = z.object({
    caseType: z.nativeEnum(CaseType),
    requiredSkills: z.array(z.string()).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    estimatedHours: z.number().optional(),
    deadline: z.string().datetime().optional(),
    preferredRole: z.nativeEnum(UserRole).optional()
  });

  // Task CRUD Operations
  createTask = asyncHandler(async (req: AuthRequest, res: Response) => {
    const validatedData = this.createTaskSchema.parse(req.body);
    
    const task = await this.taskService.createTask(
      {
        ...validatedData,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        priority: validatedData.priority as TaskPriority
      },
      req.user!.id
    );

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: { task }
    });
  });

  getTask = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    
    const task = await this.taskService.getTaskById(
      id, 
      req.user!.id, 
      req.user!.role as UserRole
    );

    res.json({
      success: true,
      data: { task }
    });
  });

  getTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      status: req.query.status as TaskStatus,
      priority: req.query.priority as TaskPriority,
      assignedTo: req.query.assignedTo as string,
      caseId: req.query.caseId as string,
      dueBefore: req.query.dueBefore ? new Date(req.query.dueBefore as string) : undefined,
      dueAfter: req.query.dueAfter ? new Date(req.query.dueAfter as string) : undefined
    };

    const tasks = await this.taskService.getTasks(
      filters, 
      req.user!.id, 
      req.user!.role as UserRole
    );

    res.json({
      success: true,
      data: { tasks }
    });
  });

  updateTask = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = this.updateTaskSchema.parse(req.body);

    const task = await this.taskService.updateTask(
      id,
      {
        ...validatedData,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        status: validatedData.status as TaskStatus,
        priority: validatedData.priority as TaskPriority
      },
      req.user!.id,
      req.user!.role as UserRole
    );

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: { task }
    });
  });

  deleteTask = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    await this.taskService.deleteTask(id, req.user!.id, req.user!.role as UserRole);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  });

  getTaskStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await this.taskService.getTaskStats(
      req.user!.id, 
      req.user!.role as UserRole
    );

    res.json({
      success: true,
      data: { stats }
    });
  });

  getTasksByCase = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseId } = req.params;

    const tasks = await this.taskService.getTasksByCase(
      caseId, 
      req.user!.id, 
      req.user!.role as UserRole
    );

    res.json({
      success: true,
      data: { tasks }
    });
  });

  // Assignment Operations
  recommendAssignees = asyncHandler(async (req: AuthRequest, res: Response) => {
    const criteria = this.assignmentCriteriaSchema.parse(req.body);

    const recommendations = await this.assignmentService.recommendAssignees({
      ...criteria,
      deadline: criteria.deadline ? new Date(criteria.deadline) : undefined
    });

    res.json({
      success: true,
      data: { recommendations }
    });
  });

  autoAssignTask = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const criteria = req.body ? this.assignmentCriteriaSchema.parse(req.body) : undefined;

    const assignedUserId = await this.assignmentService.autoAssignTask(
      id,
      criteria ? {
        ...criteria,
        deadline: criteria.deadline ? new Date(criteria.deadline) : undefined
      } : undefined
    );

    res.json({
      success: true,
      message: 'Task auto-assigned successfully',
      data: { assignedUserId }
    });
  });

  getUserWorkload = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    
    // Check if user has permission to view this workload
    if (req.user!.role !== UserRole.ADMIN && userId !== req.user!.id) {
      throw createError('Access denied', 403);
    }

    const workload = await this.assignmentService.getUserWorkload(userId);

    res.json({
      success: true,
      data: { workload }
    });
  });

  getTeamWorkloads = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const workloads = await this.assignmentService.getTeamWorkloads();

    res.json({
      success: true,
      data: { workloads }
    });
  });

  reassignTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, newUserId, reason } = req.body;

    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const reassignedCount = await this.assignmentService.reassignTasks(
      userId, 
      newUserId, 
      reason
    );

    res.json({
      success: true,
      message: `Reassigned ${reassignedCount} tasks successfully`,
      data: { reassignedCount }
    });
  });

  // Dependency Operations
  createDependency = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dependencyData = this.createDependencySchema.parse(req.body);

    const dependency = await this.dependencyService.createDependency(dependencyData);

    res.status(201).json({
      success: true,
      message: 'Dependency created successfully',
      data: { dependency }
    });
  });

  getTaskDependencies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;

    const dependencies = await this.dependencyService.getDependenciesByTask(taskId);

    res.json({
      success: true,
      data: { dependencies }
    });
  });

  getTaskDependents = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;

    const dependents = await this.dependencyService.getDependentsByTask(taskId);

    res.json({
      success: true,
      data: { dependents }
    });
  });

  getDependencyGraph = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseId } = req.params;

    const graph = await this.dependencyService.getDependencyGraph(caseId);

    res.json({
      success: true,
      data: { graph }
    });
  });

  validateDependencies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;

    const validation = await this.dependencyService.validateDependencies(taskId);

    res.json({
      success: true,
      data: { validation }
    });
  });

  getBlockedTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseId } = req.query;

    const blockedTasks = await this.dependencyService.getBlockedTasks(
      caseId as string
    );

    res.json({
      success: true,
      data: { blockedTasks }
    });
  });

  canStartTask = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;

    const canStart = await this.dependencyService.canStartTask(taskId);

    res.json({
      success: true,
      data: { canStart }
    });
  });

  deleteDependency = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { dependencyId } = req.params;

    await this.dependencyService.deleteDependency(dependencyId);

    res.json({
      success: true,
      message: 'Dependency deleted successfully'
    });
  });

  // Priority Operations
  prioritizeTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseId, userId } = req.query;

    const prioritizedTasks = await this.priorityService.prioritizeTasks(
      caseId as string,
      userId as string
    );

    res.json({
      success: true,
      data: { prioritizedTasks }
    });
  });

  getPriorityBasedTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { limit } = req.query;

    const tasks = await this.priorityService.getPriorityBasedTaskList(
      limit ? parseInt(limit as string) : 20
    );

    res.json({
      success: true,
      data: { tasks }
    });
  });

  getOverdueTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseId } = req.query;

    const overdueTasks = await this.priorityService.getOverdueTasks(
      caseId as string
    );

    res.json({
      success: true,
      data: { overdueTasks }
    });
  });

  getUrgentTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { hoursThreshold } = req.query;

    const urgentTasks = await this.priorityService.getUrgentTasks(
      hoursThreshold ? parseInt(hoursThreshold as string) : 24
    );

    res.json({
      success: true,
      data: { urgentTasks }
    });
  });

  adjustTaskPriority = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;
    const { newPriority, reason } = req.body;

    const task = await this.priorityService.adjustTaskPriority({
      taskId,
      newPriority: newPriority as TaskPriority,
      reason,
      adjustedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Task priority adjusted successfully',
      data: { task }
    });
  });

  autoPrioritizeCaseTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseId } = req.params;

    const updatedCount = await this.priorityService.autoPrioritizeCaseTasks(caseId);

    res.json({
      success: true,
      message: `Auto-prioritized ${updatedCount} tasks successfully`,
      data: { updatedCount }
    });
  });

  calculateTaskPriority = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId } = req.params;

    const priorityScore = await this.priorityService.calculateTaskPriority(taskId);

    res.json({
      success: true,
      data: { priorityScore }
    });
  });

  // Bulk Operations
  bulkAssignTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseId, taskTemplates } = req.body;

    if (req.user!.role !== UserRole.ADMIN) {
      throw createError('Access denied', 403);
    }

    const assignedTaskIds = await this.assignmentService.bulkAssignTasks(
      caseId, 
      taskTemplates
    );

    res.json({
      success: true,
      message: `Bulk assigned ${assignedTaskIds.length} tasks successfully`,
      data: { assignedTaskIds }
    });
  });

  bulkCreateDependencies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { taskId, dependencyTaskIds, dependencyType } = req.body;

    const dependencies = await this.dependencyService.bulkCreateDependencies(
      taskId,
      dependencyTaskIds,
      dependencyType as DependencyType
    );

    res.json({
      success: true,
      message: `Created ${dependencies.length} dependencies successfully`,
      data: { dependencies }
    });
  });
}