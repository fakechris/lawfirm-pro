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
exports.TaskPriorityService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
let TaskPriorityService = class TaskPriorityService {
    constructor(db) {
        this.db = db;
        this.priorityMatrix = [
            {
                caseType: client_1.CaseType.CRIMINAL_DEFENSE,
                caseStatus: client_1.CaseStatus.ACTIVE,
                basePriority: client_1.TaskPriority.HIGH,
                modifiers: {
                    overdue: 2,
                    dueSoon: 1,
                    highValueClient: 1,
                    blockingOthers: 2,
                    courtDeadline: 3
                }
            },
            {
                caseType: client_1.CaseType.MEDICAL_MALPRACTICE,
                caseStatus: client_1.CaseStatus.ACTIVE,
                basePriority: client_1.TaskPriority.HIGH,
                modifiers: {
                    overdue: 2,
                    dueSoon: 1,
                    highValueClient: 1,
                    blockingOthers: 1,
                    courtDeadline: 3
                }
            },
            {
                caseType: client_1.CaseType.LABOR_DISPUTE,
                caseStatus: client_1.CaseStatus.ACTIVE,
                basePriority: client_1.TaskPriority.MEDIUM,
                modifiers: {
                    overdue: 1,
                    dueSoon: 1,
                    highValueClient: 1,
                    blockingOthers: 1,
                    courtDeadline: 2
                }
            },
            {
                caseType: client_1.CaseType.CONTRACT_DISPUTE,
                caseStatus: client_1.CaseStatus.ACTIVE,
                basePriority: client_1.TaskPriority.MEDIUM,
                modifiers: {
                    overdue: 1,
                    dueSoon: 1,
                    highValueClient: 1,
                    blockingOthers: 1,
                    courtDeadline: 2
                }
            }
        ];
    }
    async calculateTaskPriority(taskId) {
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
    async prioritizeTasks(caseId, userId) {
        const whereClause = {
            status: {
                in: [client_1.TaskStatus.PENDING, client_1.TaskStatus.IN_PROGRESS]
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
        const priorityResponses = [];
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
        priorityResponses.sort((a, b) => b.priorityScore - a.priorityScore);
        return priorityResponses;
    }
    async adjustTaskPriority(request) {
        const task = await this.db.client.task.findUnique({
            where: { id: request.taskId }
        });
        if (!task) {
            throw new Error('Task not found');
        }
        console.log(`Priority adjusted for task ${request.taskId} from ${task.priority} to ${request.newPriority} by ${request.adjustedBy}. Reason: ${request.reason}`);
        const updatedTask = await this.db.client.task.update({
            where: { id: request.taskId },
            data: { priority: request.newPriority }
        });
        return updatedTask;
    }
    async getPriorityBasedTaskList(limit = 20) {
        const prioritizedTasks = await this.prioritizeTasks();
        return prioritizedTasks.slice(0, limit);
    }
    async getOverdueTasks(caseId) {
        const whereClause = {
            dueDate: {
                lt: new Date()
            },
            status: {
                notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED]
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
        const overdueResponses = [];
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
                dueInDays: this.getDaysUntilDue(task.dueDate),
                factors: priorityScore.factors,
                recommendations
            });
        }
        overdueResponses.sort((a, b) => (a.dueInDays || 0) - (b.dueInDays || 0));
        return overdueResponses;
    }
    async getUrgentTasks(hoursThreshold = 24) {
        const thresholdDate = new Date();
        thresholdDate.setHours(thresholdDate.getHours() + hoursThreshold);
        const whereClause = {
            dueDate: {
                lte: thresholdDate
            },
            status: {
                in: [client_1.TaskStatus.PENDING, client_1.TaskStatus.IN_PROGRESS]
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
        const urgentResponses = [];
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
        urgentResponses.sort((a, b) => (a.dueInDays || 0) - (b.dueInDays || 0));
        return urgentResponses;
    }
    async autoPrioritizeCaseTasks(caseId) {
        const tasks = await this.db.client.task.findMany({
            where: {
                caseId,
                status: {
                    in: [client_1.TaskStatus.PENDING, client_1.TaskStatus.IN_PROGRESS]
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
    async calculatePriorityFactors(task) {
        const now = new Date();
        let deadlineProximity = 0;
        if (task.dueDate) {
            const daysUntilDue = this.getDaysUntilDue(task.dueDate);
            if (daysUntilDue < 0) {
                deadlineProximity = 30;
            }
            else if (daysUntilDue <= 1) {
                deadlineProximity = 25;
            }
            else if (daysUntilDue <= 3) {
                deadlineProximity = 20;
            }
            else if (daysUntilDue <= 7) {
                deadlineProximity = 15;
            }
            else if (daysUntilDue <= 14) {
                deadlineProximity = 10;
            }
        }
        let caseUrgency = 0;
        const matrix = this.priorityMatrix.find(m => m.caseType === task.case.caseType && m.caseStatus === task.case.status);
        if (matrix) {
            switch (matrix.basePriority) {
                case client_1.TaskPriority.URGENT:
                    caseUrgency = 25;
                    break;
                case client_1.TaskPriority.HIGH:
                    caseUrgency = 20;
                    break;
                case client_1.TaskPriority.MEDIUM:
                    caseUrgency = 15;
                    break;
                case client_1.TaskPriority.LOW:
                    caseUrgency = 10;
                    break;
            }
        }
        let clientImportance = 10;
        let dependencyBlockage = 0;
        const blockedDependents = task.dependents?.filter((d) => d.task.status === client_1.TaskStatus.PENDING || d.task.status === client_1.TaskStatus.IN_PROGRESS) || [];
        if (blockedDependents.length > 0) {
            dependencyBlockage = Math.min(20, blockedDependents.length * 5);
        }
        let workloadPressure = 0;
        const userTasks = await this.db.client.task.findMany({
            where: {
                assignedTo: task.assignedTo,
                status: {
                    in: [client_1.TaskStatus.PENDING, client_1.TaskStatus.IN_PROGRESS]
                }
            }
        });
        if (userTasks.length > 15) {
            workloadPressure = 15;
        }
        else if (userTasks.length > 10) {
            workloadPressure = 10;
        }
        else if (userTasks.length > 5) {
            workloadPressure = 5;
        }
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
    calculateTotalScore(factors) {
        return Object.values(factors).reduce((sum, factor) => sum + factor, 0);
    }
    scoreToPriority(score) {
        if (score >= 80)
            return client_1.TaskPriority.URGENT;
        if (score >= 60)
            return client_1.TaskPriority.HIGH;
        if (score >= 40)
            return client_1.TaskPriority.MEDIUM;
        return client_1.TaskPriority.LOW;
    }
    generatePriorityReasoning(task, factors) {
        const reasoning = [];
        if (factors.deadlineProximity >= 25) {
            reasoning.push('Very urgent deadline');
        }
        else if (factors.deadlineProximity >= 15) {
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
    generateRecommendations(task, priorityScore) {
        const recommendations = [];
        if (priorityScore.factors.deadlineProximity >= 25) {
            recommendations.push('Immediate attention required - deadline is very close or passed');
        }
        if (priorityScore.factors.dependencyBlockage >= 10) {
            recommendations.push('Complete this task to unblock dependent tasks');
        }
        if (priorityScore.factors.workloadPressure >= 15) {
            recommendations.push('Consider delegating or rescheduling due to high workload');
        }
        if (priorityScore.score >= 60 && task.priority === client_1.TaskPriority.LOW) {
            recommendations.push('Consider increasing priority - calculated score suggests higher importance');
        }
        if (priorityScore.score < 40 && task.priority === client_1.TaskPriority.HIGH) {
            recommendations.push('Consider decreasing priority - calculated score suggests lower importance');
        }
        return recommendations;
    }
    isTaskOverdue(task) {
        return task.dueDate ? new Date() > task.dueDate : false;
    }
    getDaysUntilDue(dueDate) {
        const now = new Date();
        const diffTime = dueDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    getHoursUntilDue(dueDate) {
        const now = new Date();
        const diffTime = dueDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60));
    }
};
exports.TaskPriorityService = TaskPriorityService;
exports.TaskPriorityService = TaskPriorityService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], TaskPriorityService);
//# sourceMappingURL=TaskPriorityService.js.map