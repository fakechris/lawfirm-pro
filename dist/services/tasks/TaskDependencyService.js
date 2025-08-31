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
exports.TaskDependencyService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
let TaskDependencyService = class TaskDependencyService {
    constructor(db) {
        this.db = db;
    }
    async createDependency(request) {
        const task = await this.db.client.task.findUnique({
            where: { id: request.taskId }
        });
        const dependsOnTask = await this.db.client.task.findUnique({
            where: { id: request.dependsOnTaskId }
        });
        if (!task || !dependsOnTask) {
            throw new Error('One or both tasks not found');
        }
        if (request.taskId === request.dependsOnTaskId) {
            throw new Error('Task cannot depend on itself');
        }
        const circularCheck = await this.checkCircularDependency(request.taskId, request.dependsOnTaskId);
        if (circularCheck.hasCircularDependency) {
            throw new Error('Circular dependency detected');
        }
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
    async getDependenciesByTask(taskId) {
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
    async getDependentsByTask(taskId) {
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
    async getDependencyGraph(caseId) {
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
        const edges = [];
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
    async validateDependencies(taskId) {
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
        const errors = [];
        const warnings = [];
        const blockedTasks = [];
        for (const dependency of task.dependencies) {
            if (dependency.dependencyType === client_1.DependencyType.BLOCKING) {
                if (dependency.dependsOnTask.status !== client_1.TaskStatus.COMPLETED) {
                    errors.push(`Task is blocked by incomplete dependency: ${dependency.dependsOnTask.title}`);
                    blockedTasks.push(dependency.dependsOnTaskId);
                }
            }
            else if (dependency.dependencyType === client_1.DependencyType.SEQUENTIAL) {
                if (dependency.dependsOnTask.status === client_1.TaskStatus.PENDING) {
                    warnings.push(`Sequential dependency not started: ${dependency.dependsOnTask.title}`);
                }
            }
        }
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
    async getBlockedTasks(caseId) {
        const whereClause = {
            dependencies: {
                some: {
                    dependencyType: client_1.DependencyType.BLOCKING,
                    dependsOnTask: {
                        status: {
                            not: client_1.TaskStatus.COMPLETED
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
            const blockingDependencies = task.dependencies.filter(dep => dep.dependencyType === client_1.DependencyType.BLOCKING &&
                dep.dependsOnTask.status !== client_1.TaskStatus.COMPLETED);
            result.push({
                task,
                blockingTasks: blockingDependencies.map(dep => dep.dependsOnTask),
                dependencyType: client_1.DependencyType.BLOCKING
            });
        }
        return result;
    }
    async canStartTask(taskId) {
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
    async autoResolveDependencies(taskId) {
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
        for (const dependency of task.dependencies) {
            if (dependency.dependsOnTask.status === client_1.TaskStatus.COMPLETED) {
                await this.db.client.taskDependency.delete({
                    where: { id: dependency.id }
                });
                resolvedCount++;
            }
        }
        return resolvedCount;
    }
    async bulkCreateDependencies(taskId, dependencyTaskIds, dependencyType = client_1.DependencyType.BLOCKING) {
        const results = [];
        for (const dependsOnTaskId of dependencyTaskIds) {
            try {
                const dependency = await this.createDependency({
                    taskId,
                    dependsOnTaskId,
                    dependencyType
                });
                results.push(dependency);
            }
            catch (error) {
                console.error(`Failed to create dependency from ${taskId} to ${dependsOnTaskId}:`, error);
            }
        }
        return results;
    }
    async deleteDependency(dependencyId) {
        await this.db.client.taskDependency.delete({
            where: { id: dependencyId }
        });
    }
    async updateDependencyType(dependencyId, dependencyType) {
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
    async checkCircularDependency(taskId, dependsOnTaskId) {
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        const dfs = async (currentId) => {
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
                }
                else if (recursionStack.has(dep.dependsOnTaskId)) {
                    return true;
                }
            }
            recursionStack.delete(currentId);
            path.pop();
            return false;
        };
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
    async checkAllCircularDependencies(taskId) {
        const dependencies = await this.db.client.taskDependency.findMany({
            where: { taskId }
        });
        const circularPaths = [];
        for (const dep of dependencies) {
            const check = await this.checkCircularDependency(taskId, dep.dependsOnTaskId);
            if (check.hasCircularDependency && check.path) {
                circularPaths.push(check.path);
            }
        }
        return circularPaths;
    }
    isTaskBlocked(task) {
        return task.dependencies.some((dep) => dep.dependencyType === client_1.DependencyType.BLOCKING &&
            dep.dependsOnTask.status !== client_1.TaskStatus.COMPLETED);
    }
    async getBlockingTasks(taskId) {
        const dependencies = await this.db.client.taskDependency.findMany({
            where: {
                taskId,
                dependencyType: client_1.DependencyType.BLOCKING,
                dependsOnTask: {
                    status: {
                        not: client_1.TaskStatus.COMPLETED
                    }
                }
            },
            include: {
                dependsOnTask: true
            }
        });
        return dependencies.map(dep => dep.dependsOnTask);
    }
    mapDependencyToResponse(dependency) {
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
};
exports.TaskDependencyService = TaskDependencyService;
exports.TaskDependencyService = TaskDependencyService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], TaskDependencyService);
//# sourceMappingURL=TaskDependencyService.js.map