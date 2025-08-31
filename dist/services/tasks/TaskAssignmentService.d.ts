import { Database } from '../../utils/database';
import { User, UserRole, TaskPriority, CaseType } from '@prisma/client';
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
export declare class TaskAssignmentService {
    private db;
    constructor(db: Database);
    recommendAssignees(criteria: AssignmentCriteria): Promise<AssignmentRecommendation[]>;
    autoAssignTask(taskId: string, criteria?: AssignmentCriteria): Promise<string>;
    bulkAssignTasks(caseId: string, taskTemplates: any[]): Promise<string[]>;
    reassignTasks(userId: string, newUserId: string, reason: string): Promise<number>;
    getUserWorkload(userId: string): Promise<{
        totalTasks: number;
        activeTasks: number;
        completedTasks: number;
        overdueTasks: number;
        highPriorityTasks: number;
        estimatedHours: number;
        capacityUtilization: number;
    }>;
    getTeamWorkloads(): Promise<Array<{
        user: User;
        workload: ReturnType<typeof this.getUserWorkload>;
    }>>;
    private getEligibleUsers;
    private evaluateCandidate;
    private calculateWorkloadScore;
    private getUserExpertise;
    private calculateAvailability;
    private getUserCapacity;
    private calculateCandidateScore;
    private generateReasoning;
    private calculateConfidence;
    private determinePreferredRole;
    private calculateEstimatedHours;
    private calculateCapacityUtilization;
}
//# sourceMappingURL=TaskAssignmentService.d.ts.map