import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  Task, 
  TaskStatus, 
  TaskPriority,
  Case,
  CaseType,
  CaseStatus
} from '@prisma/client';

export interface PriorityScore {
  taskId: string;
  score: number;
  factors: {
    deadlineProximity: number;
    caseUrgency: number;
    clientImportance: number;
    dependencyBlockage: number;
    workloadPressure: number;
    age: number;
  };
  reasoning: string[];
}

export interface PriorityAdjustmentRequest {
  taskId: string;
  newPriority: TaskPriority;
  reason: string;
  adjustedBy: string;
}

export interface PriorityMatrix {
  caseType: CaseType;
  caseStatus: CaseStatus;
  basePriority: TaskPriority;
  modifiers: {
    overdue: number;
    dueSoon: number;
    highValueClient: number;
    blockingOthers: number;
    courtDeadline: number;
  };
}

export interface TaskPriorityResponse {
  id: string;
  title: string;
  currentPriority: TaskPriority;
  calculatedPriority: TaskPriority;
  priorityScore: number;
  isOverdue: boolean;
  dueInDays?: number;
  factors: PriorityScore['factors'];
  recommendations: string[];
}

@injectable()
export class TaskPriorityService {
  private priorityMatrix: PriorityMatrix[] = [
    {
      caseType: CaseType.CRIMINAL_DEFENSE,
      caseStatus: CaseStatus.ACTIVE,
      basePriority: TaskPriority.HIGH,
      modifiers: {
        overdue: 2,
        dueSoon: 1,
        highValueClient: 1,
        blockingOthers: 2,
        courtDeadline: 3
      }
    },
    {
      caseType: CaseType.MEDICAL_MALPRACTICE,
      caseStatus: CaseStatus.ACTIVE,
      basePriority: TaskPriority.HIGH,
      modifiers: {
        overdue: 2,
        dueSoon: 1,
        highValueClient: 1,
        blockingOthers: 1,
        courtDeadline: 3
      }
    },
    {
      caseType: CaseType.LABOR_DISPUTE,
      caseStatus: CaseStatus.ACTIVE,
      basePriority: TaskPriority.MEDIUM,
      modifiers: {
        overdue: 1,
        dueSoon: 1,
        highValueClient: 1,
        blockingOthers: 1,
        courtDeadline: 2
      }
    },
    {
      caseType: CaseType.CONTRACT_DISPUTE,
      caseStatus: CaseStatus.ACTIVE,
      basePriority: TaskPriority.MEDIUM,
      modifiers: {
        overdue: 1,
        dueSoon: 1,
        highValueClient: 1,
        blockingOthers: 1,
        courtDeadline: 2
      }
    }
  ];

  constructor(@inject(Database) private db: Database) {}

  async calculateTaskPriority(taskId: string): Promise<PriorityScore> {
    const task = await this.db.client.task.findUnique({
      where: { id: taskId },
      include: {
        case: {
          include: {
            client: {
              include: {
                user: true
              }
            }
          }
        },
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

    if (!task) {
      throw new Error('Task not found');
    }

    const factors = await this.calculatePriorityFactors(task);
    const score = this.calculateTotalScore(factors);
    const reasoning = this.generatePriorityReasoning(task, factors);

    return {
      taskId: task.id,
      score,
      factors,
      reasoning
    };
  }

  async prioritizeTasks(caseId?: string, userId?: string): Promise<TaskPriorityResponse[]> {
    const whereClause: any = {
      status: {
        in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
      }
    };

    if (caseId) {
      whereClause.caseId = caseId;
    }

    if (userId) {
      whereClause.assignedTo = userId;
    }

    const tasks = await this.db.client.task.findMany({
      where: whereClause,
      include: {
        case: {
          include: {
            client: {
              include: {
                user: true
              }
            }
          }
        },
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

    const priorityResponses: TaskPriorityResponse[] = [];

    for (const task of tasks) {
      const priorityScore = await this.calculateTaskPriority(task.id);
      const calculatedPriority = this.scoreToPriority(priorityScore.score);
      const isOverdue = this.isTaskOverdue(task);
      const dueInDays = task.dueDate ? this.getDaysUntilDue(task.dueDate) : undefined;
      const recommendations = this.generateRecommendations(task, priorityScore);

      priorityResponses.push({
        id: task.id,
        title: task.title,
        currentPriority: task.priority,
        calculatedPriority,
        priorityScore: priorityScore.score,
        isOverdue,
        dueInDays,
        factors: priorityScore.factors,
        recommendations
      });
    }

    // Sort by priority score
    priorityResponses.sort((a, b) => b.priorityScore - a.priorityScore);

    return priorityResponses;
  }

  async adjustTaskPriority(request: PriorityAdjustmentRequest): Promise<Task> {
    const task = await this.db.client.task.findUnique({
      where: { id: request.taskId }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Log priority adjustment (could be extended to audit log)
    console.log(`Priority adjusted for task ${request.taskId} from ${task.priority} to ${request.newPriority} by ${request.adjustedBy}. Reason: ${request.reason}`);

    const updatedTask = await this.db.client.task.update({
      where: { id: request.taskId },
      data: { priority: request.newPriority }
    });

    return updatedTask;
  }

  async getPriorityBasedTaskList(limit: number = 20): Promise<TaskPriorityResponse[]> {
    const prioritizedTasks = await this.prioritizeTasks();
    return prioritizedTasks.slice(0, limit);
  }

  async getOverdueTasks(caseId?: string): Promise<TaskPriorityResponse[]> {
    const whereClause: any = {
      dueDate: {
        lt: new Date()
      },
      status: {
        notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
      }
    };

    if (caseId) {
      whereClause.caseId = caseId;
    }

    const tasks = await this.db.client.task.findMany({
      where: whereClause,
      include: {
        case: {
          include: {
            client: {
              include: {
                user: true
              }
            }
          }
        },
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

    const overdueResponses: TaskPriorityResponse[] = [];

    for (const task of tasks) {
      const priorityScore = await this.calculateTaskPriority(task.id);
      const calculatedPriority = this.scoreToPriority(priorityScore.score);
      const recommendations = this.generateRecommendations(task, priorityScore);

      overdueResponses.push({
        id: task.id,
        title: task.title,
        currentPriority: task.priority,
        calculatedPriority,
        priorityScore: priorityScore.score,
        isOverdue: true,
        dueInDays: this.getDaysUntilDue(task.dueDate!),
        factors: priorityScore.factors,
        recommendations
      });
    }

    // Sort by how overdue they are
    overdueResponses.sort((a, b) => (a.dueInDays || 0) - (b.dueInDays || 0));

    return overdueResponses;
  }

  async getUrgentTasks(hoursThreshold: number = 24): Promise<TaskPriorityResponse[]> {
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() + hoursThreshold);

    const whereClause: any = {
      dueDate: {
        lte: thresholdDate
      },
      status: {
        in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
      }
    };

    const tasks = await this.db.client.task.findMany({
      where: whereClause,
      include: {
        case: {
          include: {
            client: {
              include: {
                user: true
              }
            }
          }
        },
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

    const urgentResponses: TaskPriorityResponse[] = [];

    for (const task of tasks) {
      const priorityScore = await this.calculateTaskPriority(task.id);
      const calculatedPriority = this.scoreToPriority(priorityScore.score);
      const isOverdue = this.isTaskOverdue(task);
      const dueInHours = task.dueDate ? this.getHoursUntilDue(task.dueDate) : undefined;
      const recommendations = this.generateRecommendations(task, priorityScore);

      urgentResponses.push({
        id: task.id,
        title: task.title,
        currentPriority: task.priority,
        calculatedPriority,
        priorityScore: priorityScore.score,
        isOverdue,
        dueInDays: dueInHours ? dueInHours / 24 : undefined,
        factors: priorityScore.factors,
        recommendations
      });
    }

    // Sort by urgency
    urgentResponses.sort((a, b) => (a.dueInDays || 0) - (b.dueInDays || 0));

    return urgentResponses;
  }

  async autoPrioritizeCaseTasks(caseId: string): Promise<number> {
    const tasks = await this.db.client.task.findMany({
      where: { 
        caseId,
        status: {
          in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
        }
      }
    });

    let updatedCount = 0;

    for (const task of tasks) {
      const priorityScore = await this.calculateTaskPriority(task.id);
      const calculatedPriority = this.scoreToPriority(priorityScore.score);

      if (calculatedPriority !== task.priority) {
        await this.db.client.task.update({
          where: { id: task.id },
          data: { priority: calculatedPriority }
        });
        updatedCount++;
      }
    }

    return updatedCount;
  }

  private async calculatePriorityFactors(task: any): Promise<PriorityScore['factors']> {
    const now = new Date();
    
    // Deadline proximity factor
    let deadlineProximity = 0;
    if (task.dueDate) {
      const daysUntilDue = this.getDaysUntilDue(task.dueDate);
      if (daysUntilDue < 0) {
        deadlineProximity = 30; // Overdue
      } else if (daysUntilDue <= 1) {
        deadlineProximity = 25;
      } else if (daysUntilDue <= 3) {
        deadlineProximity = 20;
      } else if (daysUntilDue <= 7) {
        deadlineProximity = 15;
      } else if (daysUntilDue <= 14) {
        deadlineProximity = 10;
      }
    }

    // Case urgency factor
    let caseUrgency = 0;
    const matrix = this.priorityMatrix.find(m => 
      m.caseType === task.case.caseType && m.caseStatus === task.case.status
    );
    
    if (matrix) {
      switch (matrix.basePriority) {
        case TaskPriority.URGENT:
          caseUrgency = 25;
          break;
        case TaskPriority.HIGH:
          caseUrgency = 20;
          break;
        case TaskPriority.MEDIUM:
          caseUrgency = 15;
          break;
        case TaskPriority.LOW:
          caseUrgency = 10;
          break;
      }
    }

    // Client importance factor (simplified - could be enhanced with client value metrics)
    let clientImportance = 10; // Base importance

    // Dependency blockage factor
    let dependencyBlockage = 0;
    const blockedDependents = task.dependents?.filter((d: any) => 
      d.task.status === TaskStatus.PENDING || d.task.status === TaskStatus.IN_PROGRESS
    ) || [];
    
    if (blockedDependents.length > 0) {
      dependencyBlockage = Math.min(20, blockedDependents.length * 5);
    }

    // Workload pressure factor
    let workloadPressure = 0;
    const userTasks = await this.db.client.task.findMany({
      where: {
        assignedTo: task.assignedTo,
        status: {
          in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
        }
      }
    });

    if (userTasks.length > 15) {
      workloadPressure = 15;
    } else if (userTasks.length > 10) {
      workloadPressure = 10;
    } else if (userTasks.length > 5) {
      workloadPressure = 5;
    }

    // Age factor (older tasks get higher priority)
    const ageInDays = (now.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    let age = Math.min(15, ageInDays * 0.5);

    return {
      deadlineProximity,
      caseUrgency,
      clientImportance,
      dependencyBlockage,
      workloadPressure,
      age
    };
  }

  private calculateTotalScore(factors: PriorityScore['factors']): number {
    return Object.values(factors).reduce((sum, factor) => sum + factor, 0);
  }

  private scoreToPriority(score: number): TaskPriority {
    if (score >= 80) return TaskPriority.URGENT;
    if (score >= 60) return TaskPriority.HIGH;
    if (score >= 40) return TaskPriority.MEDIUM;
    return TaskPriority.LOW;
  }

  private generatePriorityReasoning(task: any, factors: PriorityScore['factors']): string[] {
    const reasoning: string[] = [];

    if (factors.deadlineProximity >= 25) {
      reasoning.push('Very urgent deadline');
    } else if (factors.deadlineProximity >= 15) {
      reasoning.push('Approaching deadline');
    }

    if (factors.caseUrgency >= 20) {
      reasoning.push('High priority case type');
    }

    if (factors.dependencyBlockage >= 10) {
      reasoning.push('Blocking other tasks');
    }

    if (factors.workloadPressure >= 10) {
      reasoning.push('High workload pressure');
    }

    if (factors.age >= 10) {
      reasoning.push('Task has been pending for a long time');
    }

    return reasoning;
  }

  private generateRecommendations(task: any, priorityScore: PriorityScore): string[] {
    const recommendations: string[] = [];

    if (priorityScore.factors.deadlineProximity >= 25) {
      recommendations.push('Immediate attention required - deadline is very close or passed');
    }

    if (priorityScore.factors.dependencyBlockage >= 10) {
      recommendations.push('Complete this task to unblock dependent tasks');
    }

    if (priorityScore.factors.workloadPressure >= 15) {
      recommendations.push('Consider delegating or rescheduling due to high workload');
    }

    if (priorityScore.score >= 60 && task.priority === TaskPriority.LOW) {
      recommendations.push('Consider increasing priority - calculated score suggests higher importance');
    }

    if (priorityScore.score < 40 && task.priority === TaskPriority.HIGH) {
      recommendations.push('Consider decreasing priority - calculated score suggests lower importance');
    }

    return recommendations;
  }

  private isTaskOverdue(task: any): boolean {
    return task.dueDate ? new Date() > task.dueDate : false;
  }

  private getDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getHoursUntilDue(dueDate: Date): number {
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60));
  }
}