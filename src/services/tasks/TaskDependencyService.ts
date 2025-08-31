import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  Task, 
  TaskStatus, 
  TaskDependency,
  DependencyType
} from '@prisma/client';

export interface TaskDependencyResponse {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: DependencyType;
  createdAt: Date;
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: string;
    dueDate?: Date;
  };
  dependsOnTask: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: string;
    dueDate?: Date;
  };
}

export interface CreateDependencyRequest {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: DependencyType;
}

export interface DependencyGraph {
  nodes: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: string;
    dueDate?: Date;
    isBlocked: boolean;
    blockingCount: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: DependencyType;
  }>;
}

export interface DependencyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  circularDependencies: string[][];
  blockedTasks: string[];
}

@injectable()
export class TaskDependencyService {
  constructor(@inject(Database) private db: Database) {}

  async createDependency(request: CreateDependencyRequest): Promise<TaskDependencyResponse> {
    // Validate tasks exist
    const task = await this.db.client.task.findUnique({
      where: { id: request.taskId }
    });

    const dependsOnTask = await this.db.client.task.findUnique({
      where: { id: request.dependsOnTaskId }
    });

    if (!task || !dependsOnTask) {
      throw new Error('One or both tasks not found');
    }

    // Prevent self-dependency
    if (request.taskId === request.dependsOnTaskId) {
      throw new Error('Task cannot depend on itself');
    }

    // Check for circular dependencies
    const circularCheck = await this.checkCircularDependency(request.taskId, request.dependsOnTaskId);
    if (circularCheck.hasCircularDependency) {
      throw new Error('Circular dependency detected');
    }

    // Create dependency
    const dependency = await this.db.client.taskDependency.create({
      data: {
        taskId: request.taskId,
        dependsOnTaskId: request.dependsOnTaskId,
        dependencyType: request.dependencyType
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        },
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        }
      }
    });

    return this.mapDependencyToResponse(dependency);
  }

  async getDependenciesByTask(taskId: string): Promise<TaskDependencyResponse[]> {
    const dependencies = await this.db.client.taskDependency.findMany({
      where: { taskId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        },
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return dependencies.map(dep => this.mapDependencyToResponse(dep));
  }

  async getDependentsByTask(taskId: string): Promise<TaskDependencyResponse[]> {
    const dependents = await this.db.client.taskDependency.findMany({
      where: { dependsOnTaskId: taskId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        },
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return dependents.map(dep => this.mapDependencyToResponse(dep));
  }

  async getDependencyGraph(caseId: string): Promise<DependencyGraph> {
    const tasks = await this.db.client.task.findMany({
      where: { caseId },
      include: {
        dependencies: {
          include: {
            dependsOnTask: true
          }
        },
        dependents: {
          include: {
            task: true
          }
        }
      }
    });

    const nodes = tasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      isBlocked: this.isTaskBlocked(task),
      blockingCount: task.dependents.length
    }));

    const edges: Array<{ from: string; to: string; type: DependencyType }> = [];
    
    for (const task of tasks) {
      for (const dependency of task.dependencies) {
        edges.push({
          from: dependency.dependsOnTaskId,
          to: task.id,
          type: dependency.dependencyType
        });
      }
    }

    return { nodes, edges };
  }

  async validateDependencies(taskId: string): Promise<DependencyValidationResult> {
    const task = await this.db.client.task.findUnique({
      where: { id: taskId },
      include: {
        dependencies: {
          include: {
            dependsOnTask: true
          }
        }
      }
    });

    if (!task) {
      return {
        isValid: false,
        errors: ['Task not found'],
        warnings: [],
        circularDependencies: [],
        blockedTasks: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const blockedTasks: string[] = [];

    // Check if dependencies are satisfied
    for (const dependency of task.dependencies) {
      if (dependency.dependencyType === DependencyType.BLOCKING) {
        if (dependency.dependsOnTask.status !== TaskStatus.COMPLETED) {
          errors.push(`Task is blocked by incomplete dependency: ${dependency.dependsOnTask.title}`);
          blockedTasks.push(dependency.dependsOnTaskId);
        }
      } else if (dependency.dependencyType === DependencyType.SEQUENTIAL) {
        if (dependency.dependsOnTask.status === TaskStatus.PENDING) {
          warnings.push(`Sequential dependency not started: ${dependency.dependsOnTask.title}`);
        }
      }
    }

    // Check for circular dependencies
    const circularCheck = await this.checkAllCircularDependencies(taskId);
    if (circularCheck.length > 0) {
      errors.push(`Circular dependencies detected: ${circularCheck.map(c => c.join(' -> ')).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      circularDependencies: circularCheck,
      blockedTasks
    };
  }

  async getBlockedTasks(caseId?: string): Promise<Array<{
    task: Task;
    blockingTasks: Task[];
    dependencyType: DependencyType;
  }>> {
    const whereClause: any = {
      dependencies: {
        some: {
          dependencyType: DependencyType.BLOCKING,
          dependsOnTask: {
            status: {
              not: TaskStatus.COMPLETED
            }
          }
        }
      }
    };

    if (caseId) {
      whereClause.caseId = caseId;
    }

    const blockedTasks = await this.db.client.task.findMany({
      where: whereClause,
      include: {
        dependencies: {
          include: {
            dependsOnTask: true
          }
        }
      }
    });

    const result = [];

    for (const task of blockedTasks) {
      const blockingDependencies = task.dependencies.filter(dep => 
        dep.dependencyType === DependencyType.BLOCKING &&
        dep.dependsOnTask.status !== TaskStatus.COMPLETED
      );

      result.push({
        task,
        blockingTasks: blockingDependencies.map(dep => dep.dependsOnTask),
        dependencyType: DependencyType.BLOCKING
      });
    }

    return result;
  }

  async canStartTask(taskId: string): Promise<{
    canStart: boolean;
    blockingTasks: Task[];
    reasons: string[];
  }> {
    const validation = await this.validateDependencies(taskId);
    
    if (!validation.isValid) {
      return {
        canStart: false,
        blockingTasks: await this.getBlockingTasks(taskId),
        reasons: validation.errors
      };
    }

    return {
      canStart: true,
      blockingTasks: [],
      reasons: []
    };
  }

  async autoResolveDependencies(taskId: string): Promise<number> {
    const task = await this.db.client.task.findUnique({
      where: { id: taskId },
      include: {
        dependencies: {
          include: {
            dependsOnTask: true
          }
        }
      }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    let resolvedCount = 0;

    // Auto-resolve completed dependencies
    for (const dependency of task.dependencies) {
      if (dependency.dependsOnTask.status === TaskStatus.COMPLETED) {
        // Remove the dependency as it's no longer needed
        await this.db.client.taskDependency.delete({
          where: { id: dependency.id }
        });
        resolvedCount++;
      }
    }

    return resolvedCount;
  }

  async bulkCreateDependencies(taskId: string, dependencyTaskIds: string[], dependencyType: DependencyType = DependencyType.BLOCKING): Promise<TaskDependencyResponse[]> {
    const results: TaskDependencyResponse[] = [];

    for (const dependsOnTaskId of dependencyTaskIds) {
      try {
        const dependency = await this.createDependency({
          taskId,
          dependsOnTaskId,
          dependencyType
        });
        results.push(dependency);
      } catch (error) {
        console.error(`Failed to create dependency from ${taskId} to ${dependsOnTaskId}:`, error);
      }
    }

    return results;
  }

  async deleteDependency(dependencyId: string): Promise<void> {
    await this.db.client.taskDependency.delete({
      where: { id: dependencyId }
    });
  }

  async updateDependencyType(dependencyId: string, dependencyType: DependencyType): Promise<TaskDependencyResponse> {
    const dependency = await this.db.client.taskDependency.update({
      where: { id: dependencyId },
      data: { dependencyType },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        },
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true
          }
        }
      }
    });

    return this.mapDependencyToResponse(dependency);
  }

  private async checkCircularDependency(taskId: string, dependsOnTaskId: string): Promise<{ hasCircularDependency: boolean; path?: string[] }> {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = async (currentId: string): Promise<boolean> => {
      visited.add(currentId);
      recursionStack.add(currentId);
      path.push(currentId);

      const dependencies = await this.db.client.taskDependency.findMany({
        where: { taskId: currentId },
        select: { dependsOnTaskId: true }
      });

      for (const dep of dependencies) {
        if (!visited.has(dep.dependsOnTaskId)) {
          if (await dfs(dep.dependsOnTaskId)) {
            return true;
          }
        } else if (recursionStack.has(dep.dependsOnTaskId)) {
          return true;
        }
      }

      recursionStack.delete(currentId);
      path.pop();
      return false;
    };

    // Check if adding this dependency creates a cycle
    const hasCycle = await dfs(dependsOnTaskId);
    
    if (hasCycle) {
      const cycleStart = path.indexOf(taskId);
      if (cycleStart !== -1) {
        return {
          hasCircularDependency: true,
          path: [...path.slice(cycleStart), taskId]
        };
      }
    }

    return { hasCircularDependency: false };
  }

  private async checkAllCircularDependencies(taskId: string): Promise<string[][]> {
    const dependencies = await this.db.client.taskDependency.findMany({
      where: { taskId }
    });

    const circularPaths: string[][] = [];

    for (const dep of dependencies) {
      const check = await this.checkCircularDependency(taskId, dep.dependsOnTaskId);
      if (check.hasCircularDependency && check.path) {
        circularPaths.push(check.path);
      }
    }

    return circularPaths;
  }

  private isTaskBlocked(task: any): boolean {
    return task.dependencies.some((dep: any) => 
      dep.dependencyType === DependencyType.BLOCKING &&
      dep.dependsOnTask.status !== TaskStatus.COMPLETED
    );
  }

  private async getBlockingTasks(taskId: string): Promise<Task[]> {
    const dependencies = await this.db.client.taskDependency.findMany({
      where: { 
        taskId,
        dependencyType: DependencyType.BLOCKING,
        dependsOnTask: {
          status: {
            not: TaskStatus.COMPLETED
          }
        }
      },
      include: {
        dependsOnTask: true
      }
    });

    return dependencies.map(dep => dep.dependsOnTask);
  }

  private mapDependencyToResponse(dependency: any): TaskDependencyResponse {
    return {
      id: dependency.id,
      taskId: dependency.taskId,
      dependsOnTaskId: dependency.dependsOnTaskId,
      dependencyType: dependency.dependencyType,
      createdAt: dependency.createdAt,
      task: {
        id: dependency.task.id,
        title: dependency.task.title,
        status: dependency.task.status,
        priority: dependency.task.priority,
        dueDate: dependency.task.dueDate
      },
      dependsOnTask: {
        id: dependency.dependsOnTask.id,
        title: dependency.dependsOnTask.title,
        status: dependency.dependsOnTask.status,
        priority: dependency.dependsOnTask.priority,
        dueDate: dependency.dependsOnTask.dueDate
      }
    };
  }
}