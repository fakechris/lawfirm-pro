import { Database } from '../../utils/database';
import { Task, TaskStatus, DependencyType } from '@prisma/client';
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
export declare class TaskDependencyService {
    private db;
    constructor(db: Database);
    createDependency(request: CreateDependencyRequest): Promise<TaskDependencyResponse>;
    getDependenciesByTask(taskId: string): Promise<TaskDependencyResponse[]>;
    getDependentsByTask(taskId: string): Promise<TaskDependencyResponse[]>;
    getDependencyGraph(caseId: string): Promise<DependencyGraph>;
    validateDependencies(taskId: string): Promise<DependencyValidationResult>;
    getBlockedTasks(caseId?: string): Promise<Array<{
        task: Task;
        blockingTasks: Task[];
        dependencyType: DependencyType;
    }>>;
    canStartTask(taskId: string): Promise<{
        canStart: boolean;
        blockingTasks: Task[];
        reasons: string[];
    }>;
    autoResolveDependencies(taskId: string): Promise<number>;
    bulkCreateDependencies(taskId: string, dependencyTaskIds: string[], dependencyType?: DependencyType): Promise<TaskDependencyResponse[]>;
    deleteDependency(dependencyId: string): Promise<void>;
    updateDependencyType(dependencyId: string, dependencyType: DependencyType): Promise<TaskDependencyResponse>;
    private checkCircularDependency;
    private checkAllCircularDependencies;
    private isTaskBlocked;
    private getBlockingTasks;
    private mapDependencyToResponse;
}
//# sourceMappingURL=TaskDependencyService.d.ts.map