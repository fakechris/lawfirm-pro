import { Database } from '../../utils/database';
import { TaskStatus, TaskPriority, UserRole } from '@prisma/client';
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
export declare class TaskService {
    private db;
    constructor(db: Database);
    createTask(taskRequest: CreateTaskRequest, createdBy: string): Promise<TaskResponse>;
    getTaskById(taskId: string, userId: string, userRole: UserRole): Promise<TaskResponse>;
    getTasks(filters: TaskFilters, userId: string, userRole: UserRole): Promise<TaskResponse[]>;
    updateTask(taskId: string, updateRequest: UpdateTaskRequest, userId: string, userRole: UserRole): Promise<TaskResponse>;
    deleteTask(taskId: string, userId: string, userRole: UserRole): Promise<void>;
    getTaskStats(userId: string, userRole: UserRole): Promise<TaskStats>;
    getTasksByCase(caseId: string, userId: string, userRole: UserRole): Promise<TaskResponse[]>;
    private validateRoleAssignment;
    private validateTaskAccess;
    private mapTaskToResponse;
}
//# sourceMappingURL=TaskService.d.ts.map