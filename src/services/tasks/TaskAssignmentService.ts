import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  User, 
  UserRole, 
  Task, 
  TaskStatus,
  TaskPriority,
  Case,
  CaseType
} from '@prisma/client';

export interface AssignmentCriteria {
  caseType: CaseType;
  requiredSkills?: string[];
  priority: TaskPriority;
  estimatedHours?: number;
  deadline?: Date;
  preferredRole?: UserRole;
}

export interface AssignmentCandidate {
  user: User;
  score: number;
  currentWorkload: number;
  expertise: string[];
  availability: {
    totalCapacity: number;
    assignedTasks: number;
    availableCapacity: number;
  };
}

export interface AssignmentRecommendation {
  candidate: AssignmentCandidate;
  confidence: number;
  reasoning: string[];
}

@injectable()
export class TaskAssignmentService {
  constructor(@inject(Database) private db: Database) {}

  async recommendAssignees(criteria: AssignmentCriteria): Promise<AssignmentRecommendation[]> {
    // Get all eligible users based on role requirements
    const eligibleUsers = await this.getEligibleUsers(criteria);
    
    // Calculate scores for each user
    const candidates: AssignmentCandidate[] = [];
    
    for (const user of eligibleUsers) {
      const candidate = await this.evaluateCandidate(user, criteria);
      candidates.push(candidate);
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    // Generate recommendations
    const recommendations: AssignmentRecommendation[] = [];
    
    for (const candidate of candidates.slice(0, 5)) { // Top 5 recommendations
      const reasoning = this.generateReasoning(candidate, criteria);
      const confidence = this.calculateConfidence(candidate, criteria);
      
      recommendations.push({
        candidate,
        confidence,
        reasoning
      });
    }

    return recommendations;
  }

  async autoAssignTask(taskId: string, criteria?: AssignmentCriteria): Promise<string> {
    // Get task details if criteria not provided
    if (!criteria) {
      const task = await this.db.client.task.findUnique({
        where: { id: taskId },
        include: {
          case: {
            select: {
              caseType: true,
              attorneyId: true
            }
          }
        }
      });

      if (!task) {
        throw new Error('Task not found');
      }

      criteria = {
        caseType: task.case.caseType,
        priority: task.priority,
        deadline: task.dueDate || undefined,
        preferredRole: this.determinePreferredRole(task.case.caseType, task.priority)
      };
    }

    // Get recommendations
    const recommendations = await this.recommendAssignees(criteria);
    
    if (recommendations.length === 0) {
      throw new Error('No suitable assignees found');
    }

    // Assign to the best candidate
    const bestCandidate = recommendations[0].candidate;
    
    await this.db.client.task.update({
      where: { id: taskId },
      data: { assignedTo: bestCandidate.user.id }
    });

    return bestCandidate.user.id;
  }

  async bulkAssignTasks(caseId: string, taskTemplates: any[]): Promise<string[]> {
    const caseRecord = await this.db.client.case.findUnique({
      where: { id: caseId },
      select: { caseType: true, attorneyId: true }
    });

    if (!caseRecord) {
      throw new Error('Case not found');
    }

    const assignedTaskIds: string[] = [];

    for (const template of taskTemplates) {
      const criteria: AssignmentCriteria = {
        caseType: caseRecord.caseType,
        priority: template.priority || TaskPriority.MEDIUM,
        deadline: template.dueDate ? new Date(template.dueDate) : undefined,
        preferredRole: template.preferredRole || this.determinePreferredRole(caseRecord.caseType, template.priority)
      };

      // Create task
      const task = await this.db.client.task.create({
        data: {
          title: template.title,
          description: template.description,
          caseId,
          assignedTo: '', // Will be assigned by autoAssignTask
          assignedBy: template.assignedBy || 'system',
          dueDate: criteria.deadline,
          priority: criteria.priority,
          status: TaskStatus.PENDING
        }
      });

      // Auto-assign the task
      const assignedUserId = await this.autoAssignTask(task.id, criteria);
      assignedTaskIds.push(task.id);
    }

    return assignedTaskIds;
  }

  async reassignTasks(userId: string, newUserId: string, reason: string): Promise<number> {
    // Get all active tasks assigned to the user
    const tasksToReassign = await this.db.client.task.findMany({
      where: {
        assignedTo: userId,
        status: {
          in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
        }
      }
    });

    let reassignedCount = 0;

    for (const task of tasksToReassign) {
      try {
        // Find suitable replacement
        const criteria: AssignmentCriteria = {
          caseType: task.caseId as any, // Will be resolved in recommendAssignees
          priority: task.priority,
          deadline: task.dueDate || undefined
        };

        const recommendations = await this.recommendAssignees(criteria);
        
        if (recommendations.length > 0) {
          const bestCandidate = recommendations[0].candidate;
          
          await this.db.client.task.update({
            where: { id: task.id },
            data: { 
              assignedTo: bestCandidate.user.id,
              // Add note about reassignment in description
              description: task.description 
                ? `${task.description}\n\nReassigned from ${userId} to ${bestCandidate.user.id}. Reason: ${reason}`
                : `Reassigned from ${userId} to ${bestCandidate.user.id}. Reason: ${reason}`
            }
          });
          
          reassignedCount++;
        }
      } catch (error) {
        console.error(`Failed to reassign task ${task.id}:`, error);
      }
    }

    return reassignedCount;
  }

  async getUserWorkload(userId: string): Promise<{
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    highPriorityTasks: number;
    estimatedHours: number;
    capacityUtilization: number;
  }> {
    const tasks = await this.db.client.task.findMany({
      where: { assignedTo: userId }
    });

    const now = new Date();
    
    return {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completedTasks: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      overdueTasks: tasks.filter(t => 
        t.dueDate && 
        t.dueDate < now && 
        t.status !== TaskStatus.COMPLETED &&
        t.status !== TaskStatus.CANCELLED
      ).length,
      highPriorityTasks: tasks.filter(t => 
        t.priority === TaskPriority.HIGH || 
        t.priority === TaskPriority.URGENT
      ).length,
      estimatedHours: this.calculateEstimatedHours(tasks),
      capacityUtilization: this.calculateCapacityUtilization(tasks)
    };
  }

  async getTeamWorkloads(): Promise<Array<{
    user: User;
    workload: ReturnType<typeof this.getUserWorkload>;
  }>> {
    const users = await this.db.client.user.findMany({
      where: {
        role: {
          in: [UserRole.ATTORNEY, UserRole.ASSISTANT, UserRole.ADMIN]
        }
      }
    });

    const workloads = [];

    for (const user of users) {
      const workload = await this.getUserWorkload(user.id);
      workloads.push({
        user,
        workload
      });
    }

    return workloads;
  }

  private async getEligibleUsers(criteria: AssignmentCriteria): Promise<User[]> {
    const whereClause: any = {
      role: {
        in: [UserRole.ATTORNEY, UserRole.ASSISTANT, UserRole.ADMIN]
      }
    };

    // Filter by preferred role if specified
    if (criteria.preferredRole) {
      whereClause.role = criteria.preferredRole;
    }

    return await this.db.client.user.findMany({
      where: whereClause,
      include: {
        attorneyProfile: true
      }
    });
  }

  private async evaluateCandidate(user: User, criteria: AssignmentCriteria): Promise<AssignmentCandidate> {
    // Get user's current tasks
    const currentTasks = await this.db.client.task.findMany({
      where: {
        assignedTo: user.id,
        status: {
          in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
        }
      }
    });

    // Calculate workload
    const currentWorkload = this.calculateWorkloadScore(currentTasks);
    
    // Get expertise based on role and profile
    const expertise = this.getUserExpertise(user);
    
    // Calculate availability
    const availability = this.calculateAvailability(user, currentTasks);
    
    // Calculate overall score
    const score = this.calculateCandidateScore(user, criteria, currentWorkload, expertise, availability);

    return {
      user,
      score,
      currentWorkload,
      expertise,
      availability
    };
  }

  private calculateWorkloadScore(tasks: Task[]): number {
    let score = 0;
    
    for (const task of tasks) {
      // Base score per task
      score += 10;
      
      // Priority multiplier
      switch (task.priority) {
        case TaskPriority.URGENT:
          score += 20;
          break;
        case TaskPriority.HIGH:
          score += 15;
          break;
        case TaskPriority.MEDIUM:
          score += 10;
          break;
        case TaskPriority.LOW:
          score += 5;
          break;
      }
      
      // Overdue penalty
      if (task.dueDate && task.dueDate < new Date() && task.status !== TaskStatus.COMPLETED) {
        score += 25;
      }
    }
    
    return score;
  }

  private getUserExpertise(user: User): string[] {
    const expertise: string[] = [];
    
    switch (user.role) {
      case UserRole.ATTORNEY:
        expertise.push('legal-research', 'client-consultation', 'court-proceedings');
        if (user.attorneyProfile?.specialization) {
          expertise.push(user.attorneyProfile.specialization.toLowerCase());
        }
        break;
      case UserRole.ASSISTANT:
        expertise.push('document-preparation', 'administrative', 'client-communication');
        break;
      case UserRole.ADMIN:
        expertise.push('case-management', 'supervision', 'quality-control');
        break;
    }
    
    return expertise;
  }

  private calculateAvailability(user: User, currentTasks: Task[]) {
    const totalCapacity = this.getUserCapacity(user.role);
    const assignedTasks = currentTasks.length;
    const availableCapacity = Math.max(0, totalCapacity - assignedTasks);
    
    return {
      totalCapacity,
      assignedTasks,
      availableCapacity
    };
  }

  private getUserCapacity(role: UserRole): number {
    switch (role) {
      case UserRole.ATTORNEY:
        return 15; // Max 15 active tasks
      case UserRole.ASSISTANT:
        return 20; // Max 20 active tasks
      case UserRole.ADMIN:
        return 25; // Max 25 active tasks
      default:
        return 10;
    }
  }

  private calculateCandidateScore(
    user: User, 
    criteria: AssignmentCriteria, 
    workload: number, 
    expertise: string[], 
    availability: any
  ): number {
    let score = 100; // Base score
    
    // Workload penalty (higher workload = lower score)
    score -= workload * 0.5;
    
    // Availability bonus
    if (availability.availableCapacity > 0) {
      score += availability.availableCapacity * 2;
    }
    
    // Role match bonus
    if (criteria.preferredRole && user.role === criteria.preferredRole) {
      score += 20;
    }
    
    // Expertise match bonus
    if (criteria.requiredSkills) {
      const matchingSkills = criteria.requiredSkills.filter(skill => 
        expertise.some(exp => exp.includes(skill.toLowerCase()) || skill.toLowerCase().includes(exp))
      );
      score += matchingSkills.length * 10;
    }
    
    // Priority urgency bonus for high-priority tasks
    if (criteria.priority === TaskPriority.URGENT || criteria.priority === TaskPriority.HIGH) {
      score += availability.availableCapacity > 0 ? 15 : -10;
    }
    
    return Math.max(0, score);
  }

  private generateReasoning(candidate: AssignmentCandidate, criteria: AssignmentCriteria): string[] {
    const reasoning: string[] = [];
    
    if (candidate.availability.availableCapacity > 0) {
      reasoning.push(`Has capacity for ${candidate.availability.availableCapacity} more tasks`);
    }
    
    if (criteria.preferredRole && candidate.user.role === criteria.preferredRole) {
      reasoning.push(`Matches preferred role: ${criteria.preferredRole}`);
    }
    
    if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
      const matchingSkills = criteria.requiredSkills.filter(skill => 
        candidate.expertise.some(exp => exp.includes(skill.toLowerCase()) || skill.toLowerCase().includes(exp))
      );
      if (matchingSkills.length > 0) {
        reasoning.push(`Has relevant expertise: ${matchingSkills.join(', ')}`);
      }
    }
    
    if (candidate.currentWorkload < 50) {
      reasoning.push('Low current workload');
    }
    
    return reasoning;
  }

  private calculateConfidence(candidate: AssignmentCandidate, criteria: AssignmentCriteria): number {
    let confidence = 0.5; // Base confidence
    
    // High confidence if good availability
    if (candidate.availability.availableCapacity > 5) {
      confidence += 0.2;
    }
    
    // High confidence if role matches
    if (criteria.preferredRole && candidate.user.role === criteria.preferredRole) {
      confidence += 0.2;
    }
    
    // High confidence if expertise matches
    if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
      const matchingSkills = criteria.requiredSkills.filter(skill => 
        candidate.expertise.some(exp => exp.includes(skill.toLowerCase()) || skill.toLowerCase().includes(exp))
      );
      if (matchingSkills.length > 0) {
        confidence += 0.1;
      }
    }
    
    return Math.min(1.0, confidence);
  }

  private determinePreferredRole(caseType: CaseType, priority: TaskPriority): UserRole {
    // Simple logic - can be enhanced based on firm-specific rules
    if (priority === TaskPriority.URGENT || priority === TaskPriority.HIGH) {
      return UserRole.ATTORNEY;
    }
    
    switch (caseType) {
      case CaseType.MEDICAL_MALPRACTICE:
      case CaseType.CRIMINAL_DEFENSE:
        return UserRole.ATTORNEY;
      case CaseType.LABOR_DISPUTE:
      case CaseType.CONTRACT_DISPUTE:
        return UserRole.ATTORNEY;
      default:
        return UserRole.ASSISTANT;
    }
  }

  private calculateEstimatedHours(tasks: Task[]): number {
    // Simple estimation - can be enhanced with actual time tracking
    return tasks.length * 2; // Assume 2 hours per task average
  }

  private calculateCapacityUtilization(tasks: Task[]): number {
    const activeTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const totalCapacity = 15; // Default capacity
    return Math.min(100, (activeTasks / totalCapacity) * 100);
  }
}