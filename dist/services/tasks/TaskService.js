"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
let TaskService = class TaskService {
    constructor(db) {
        this.db = db;
    }
    async createTask(taskRequest, createdBy) {
        const { title, description, caseId, assignedTo, dueDate, priority } = taskRequest;
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
        const assignee = await this.db.client.user.findUnique({
            where: { id: assignedTo }
        });
        if (!assignee) {
            throw new Error('Assignee not found');
        }
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
                status: client_1.TaskStatus.PENDING
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
    async getTaskById(taskId, userId, userRole) {
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
        this.validateTaskAccess(task, userId, userRole);
        return this.mapTaskToResponse(task);
    }
    async getTasks(filters, userId, userRole) {
        const whereClause = {};
        if (filters.status)
            whereClause.status = filters.status;
        if (filters.priority)
            whereClause.priority = filters.priority;
        if (filters.assignedTo)
            whereClause.assignedTo = filters.assignedTo;
        if (filters.caseId)
            whereClause.caseId = filters.caseId;
        if (filters.dueBefore || filters.dueAfter) {
            whereClause.dueDate = {};
            if (filters.dueBefore)
                whereClause.dueDate.lte = filters.dueBefore;
            if (filters.dueAfter)
                whereClause.dueDate.gte = filters.dueAfter;
        }
        if (userRole !== client_1.UserRole.ADMIN) {
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
    async updateTask(taskId, updateRequest, userId, userRole) {
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
        this.validateTaskAccess(existingTask, userId, userRole);
        if (updateRequest.assignedTo && updateRequest.assignedTo !== existingTask.assignedTo) {
            const newAssignee = await this.db.client.user.findUnique({
                where: { id: updateRequest.assignedTo }
            });
            if (!newAssignee) {
                throw new Error('New assignee not found');
            }
            this.validateRoleAssignment(newAssignee.role, existingTask.case.caseType);
        }
        const updateData = { ...updateRequest };
        if (updateRequest.status === client_1.TaskStatus.COMPLETED && existingTask.status !== client_1.TaskStatus.COMPLETED) {
            updateData.completedAt = new Date();
        }
        else if (updateRequest.status !== client_1.TaskStatus.COMPLETED && existingTask.status === client_1.TaskStatus.COMPLETED) {
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
    async deleteTask(taskId, userId, userRole) {
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
        const hasDeleteAccess = userRole === client_1.UserRole.ADMIN ||
            existingTask.assignedBy === userId ||
            (userRole === client_1.UserRole.ATTORNEY && existingTask.case.attorney.userId === userId);
        if (!hasDeleteAccess) {
            throw new Error('Access denied');
        }
        await this.db.client.task.delete({
            where: { id: taskId }
        });
    }
    async getTaskStats(userId, userRole) {
        const whereClause = {};
        if (userRole !== client_1.UserRole.ADMIN) {
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
            pending: tasks.filter(t => t.status === client_1.TaskStatus.PENDING).length,
            inProgress: tasks.filter(t => t.status === client_1.TaskStatus.IN_PROGRESS).length,
            completed: tasks.filter(t => t.status === client_1.TaskStatus.COMPLETED).length,
            cancelled: tasks.filter(t => t.status === client_1.TaskStatus.CANCELLED).length,
            overdue: tasks.filter(t => t.dueDate &&
                t.dueDate < now &&
                t.status !== client_1.TaskStatus.COMPLETED &&
                t.status !== client_1.TaskStatus.CANCELLED).length,
            dueToday: tasks.filter(t => t.dueDate &&
                t.dueDate >= today &&
                t.dueDate < tomorrow &&
                t.status !== client_1.TaskStatus.COMPLETED &&
                t.status !== client_1.TaskStatus.CANCELLED).length,
            highPriority: tasks.filter(t => t.priority === client_1.TaskPriority.HIGH ||
                t.priority === client_1.TaskPriority.URGENT).length
        };
    }
    async getTasksByCase(caseId, userId, userRole) {
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
        const hasCaseAccess = userRole === client_1.UserRole.ADMIN ||
            (userRole === client_1.UserRole.ATTORNEY && caseRecord.attorney.userId === userId) ||
            (userRole === client_1.UserRole.CLIENT && caseRecord.client.userId === userId);
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
    validateRoleAssignment(role, caseType) {
        const validRoles = [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN, client_1.UserRole.ASSISTANT];
        if (!validRoles.includes(role)) {
            throw new Error(`User role ${role} cannot be assigned tasks`);
        }
    }
    validateTaskAccess(task, userId, userRole) {
        const hasAccess = userRole === client_1.UserRole.ADMIN ||
            task.assignedTo === userId ||
            task.assignedBy === userId ||
            (userRole === client_1.UserRole.ATTORNEY && task.case.attorney.userId === userId) ||
            (userRole === client_1.UserRole.CLIENT && task.case.client.userId === userId);
        if (!hasAccess) {
            throw new Error('Access denied');
        }
    }
    mapTaskToResponse(task) {
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
};
exports.TaskService = TaskService;
exports.TaskService = TaskService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], TaskService);
//# sourceMappingURL=TaskService.js.map