import { Database } from '../../utils/database';
import { Task, TaskPriority, CaseType, CaseStatus } from '@prisma/client';
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
export declare class TaskPriorityService {
    private db;
    private priorityMatrix;
    constructor(db: Database);
    calculateTaskPriority(taskId: string): Promise<PriorityScore>;
    prioritizeTasks(caseId?: string, userId?: string): Promise<TaskPriorityResponse[]>;
    adjustTaskPriority(request: PriorityAdjustmentRequest): Promise<Task>;
    getPriorityBasedTaskList(limit?: number): Promise<TaskPriorityResponse[]>;
    getOverdueTasks(caseId?: string): Promise<TaskPriorityResponse[]>;
    getUrgentTasks(hoursThreshold?: number): Promise<TaskPriorityResponse[]>;
    autoPrioritizeCaseTasks(caseId: string): Promise<number>;
    private calculatePriorityFactors;
    private calculateTotalScore;
    private scoreToPriority;
    private generatePriorityReasoning;
    private generateRecommendations;
    private isTaskOverdue;
    private getDaysUntilDue;
    private getHoursUntilDue;
}
//# sourceMappingURL=TaskPriorityService.d.ts.map