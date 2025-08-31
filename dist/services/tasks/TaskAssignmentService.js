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
exports.TaskAssignmentService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
let TaskAssignmentService = class TaskAssignmentService {
    constructor(db) {
        this.db = db;
    }
    async recommendAssignees(criteria) {
        const eligibleUsers = await this.getEligibleUsers(criteria);
        const candidates = [];
        for (const user of eligibleUsers) {
            const candidate = await this.evaluateCandidate(user, criteria);
            candidates.push(candidate);
        }
        candidates.sort((a, b) => b.score - a.score);
        const recommendations = [];
        for (const candidate of candidates.slice(0, 5)) {
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
    async autoAssignTask(taskId, criteria) {
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
        const recommendations = await this.recommendAssignees(criteria);
        if (recommendations.length === 0) {
            throw new Error('No suitable assignees found');
        }
        const bestCandidate = recommendations[0].candidate;
        await this.db.client.task.update({
            where: { id: taskId },
            data: { assignedTo: bestCandidate.user.id }
        });
        return bestCandidate.user.id;
    }
    async bulkAssignTasks(caseId, taskTemplates) {
        const caseRecord = await this.db.client.case.findUnique({
            where: { id: caseId },
            select: { caseType: true, attorneyId: true }
        });
        if (!caseRecord) {
            throw new Error('Case not found');
        }
        const assignedTaskIds = [];
        for (const template of taskTemplates) {
            const criteria = {
                caseType: caseRecord.caseType,
                priority: template.priority || client_1.TaskPriority.MEDIUM,
                deadline: template.dueDate ? new Date(template.dueDate) : undefined,
                preferredRole: template.preferredRole || this.determinePreferredRole(caseRecord.caseType, template.priority)
            };
            const task = await this.db.client.task.create({
                data: {
                    title: template.title,
                    description: template.description,
                    caseId,
                    assignedTo: '',
                    assignedBy: template.assignedBy || 'system',
                    dueDate: criteria.deadline,
                    priority: criteria.priority,
                    status: client_1.TaskStatus.PENDING
                }
            });
            const assignedUserId = await this.autoAssignTask(task.id, criteria);
            assignedTaskIds.push(task.id);
        }
        return assignedTaskIds;
    }
    async reassignTasks(userId, newUserId, reason) {
        const tasksToReassign = await this.db.client.task.findMany({
            where: {
                assignedTo: userId,
                status: {
                    in: [client_1.TaskStatus.PENDING, client_1.TaskStatus.IN_PROGRESS]
                }
            }
        });
        let reassignedCount = 0;
        for (const task of tasksToReassign) {
            try {
                const criteria = {
                    caseType: task.caseId,
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
                            description: task.description
                                ? `${task.description}\n\nReassigned from ${userId} to ${bestCandidate.user.id}. Reason: ${reason}`
                                : `Reassigned from ${userId} to ${bestCandidate.user.id}. Reason: ${reason}`
                        }
                    });
                    reassignedCount++;
                }
            }
            catch (error) {
                console.error(`Failed to reassign task ${task.id}:`, error);
            }
        }
        return reassignedCount;
    }
    async getUserWorkload(userId) {
        const tasks = await this.db.client.task.findMany({
            where: { assignedTo: userId }
        });
        const now = new Date();
        return {
            totalTasks: tasks.length,
            activeTasks: tasks.filter(t => t.status === client_1.TaskStatus.IN_PROGRESS).length,
            completedTasks: tasks.filter(t => t.status === client_1.TaskStatus.COMPLETED).length,
            overdueTasks: tasks.filter(t => t.dueDate &&
                t.dueDate < now &&
                t.status !== client_1.TaskStatus.COMPLETED &&
                t.status !== client_1.TaskStatus.CANCELLED).length,
            highPriorityTasks: tasks.filter(t => t.priority === client_1.TaskPriority.HIGH ||
                t.priority === client_1.TaskPriority.URGENT).length,
            estimatedHours: this.calculateEstimatedHours(tasks),
            capacityUtilization: this.calculateCapacityUtilization(tasks)
        };
    }
    async getTeamWorkloads() {
        const users = await this.db.client.user.findMany({
            where: {
                role: {
                    in: [client_1.UserRole.ATTORNEY, client_1.UserRole.ASSISTANT, client_1.UserRole.ADMIN]
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
    async getEligibleUsers(criteria) {
        const whereClause = {
            role: {
                in: [client_1.UserRole.ATTORNEY, client_1.UserRole.ASSISTANT, client_1.UserRole.ADMIN]
            }
        };
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
    async evaluateCandidate(user, criteria) {
        const currentTasks = await this.db.client.task.findMany({
            where: {
                assignedTo: user.id,
                status: {
                    in: [client_1.TaskStatus.PENDING, client_1.TaskStatus.IN_PROGRESS]
                }
            }
        });
        const currentWorkload = this.calculateWorkloadScore(currentTasks);
        const expertise = this.getUserExpertise(user);
        const availability = this.calculateAvailability(user, currentTasks);
        const score = this.calculateCandidateScore(user, criteria, currentWorkload, expertise, availability);
        return {
            user,
            score,
            currentWorkload,
            expertise,
            availability
        };
    }
    calculateWorkloadScore(tasks) {
        let score = 0;
        for (const task of tasks) {
            score += 10;
            switch (task.priority) {
                case client_1.TaskPriority.URGENT:
                    score += 20;
                    break;
                case client_1.TaskPriority.HIGH:
                    score += 15;
                    break;
                case client_1.TaskPriority.MEDIUM:
                    score += 10;
                    break;
                case client_1.TaskPriority.LOW:
                    score += 5;
                    break;
            }
            if (task.dueDate && task.dueDate < new Date() && task.status !== client_1.TaskStatus.COMPLETED) {
                score += 25;
            }
        }
        return score;
    }
    getUserExpertise(user) {
        const expertise = [];
        switch (user.role) {
            case client_1.UserRole.ATTORNEY:
                expertise.push('legal-research', 'client-consultation', 'court-proceedings');
                if (user.attorneyProfile?.specialization) {
                    expertise.push(user.attorneyProfile.specialization.toLowerCase());
                }
                break;
            case client_1.UserRole.ASSISTANT:
                expertise.push('document-preparation', 'administrative', 'client-communication');
                break;
            case client_1.UserRole.ADMIN:
                expertise.push('case-management', 'supervision', 'quality-control');
                break;
        }
        return expertise;
    }
    calculateAvailability(user, currentTasks) {
        const totalCapacity = this.getUserCapacity(user.role);
        const assignedTasks = currentTasks.length;
        const availableCapacity = Math.max(0, totalCapacity - assignedTasks);
        return {
            totalCapacity,
            assignedTasks,
            availableCapacity
        };
    }
    getUserCapacity(role) {
        switch (role) {
            case client_1.UserRole.ATTORNEY:
                return 15;
            case client_1.UserRole.ASSISTANT:
                return 20;
            case client_1.UserRole.ADMIN:
                return 25;
            default:
                return 10;
        }
    }
    calculateCandidateScore(user, criteria, workload, expertise, availability) {
        let score = 100;
        score -= workload * 0.5;
        if (availability.availableCapacity > 0) {
            score += availability.availableCapacity * 2;
        }
        if (criteria.preferredRole && user.role === criteria.preferredRole) {
            score += 20;
        }
        if (criteria.requiredSkills) {
            const matchingSkills = criteria.requiredSkills.filter(skill => expertise.some(exp => exp.includes(skill.toLowerCase()) || skill.toLowerCase().includes(exp)));
            score += matchingSkills.length * 10;
        }
        if (criteria.priority === client_1.TaskPriority.URGENT || criteria.priority === client_1.TaskPriority.HIGH) {
            score += availability.availableCapacity > 0 ? 15 : -10;
        }
        return Math.max(0, score);
    }
    generateReasoning(candidate, criteria) {
        const reasoning = [];
        if (candidate.availability.availableCapacity > 0) {
            reasoning.push(`Has capacity for ${candidate.availability.availableCapacity} more tasks`);
        }
        if (criteria.preferredRole && candidate.user.role === criteria.preferredRole) {
            reasoning.push(`Matches preferred role: ${criteria.preferredRole}`);
        }
        if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
            const matchingSkills = criteria.requiredSkills.filter(skill => candidate.expertise.some(exp => exp.includes(skill.toLowerCase()) || skill.toLowerCase().includes(exp)));
            if (matchingSkills.length > 0) {
                reasoning.push(`Has relevant expertise: ${matchingSkills.join(', ')}`);
            }
        }
        if (candidate.currentWorkload < 50) {
            reasoning.push('Low current workload');
        }
        return reasoning;
    }
    calculateConfidence(candidate, criteria) {
        let confidence = 0.5;
        if (candidate.availability.availableCapacity > 5) {
            confidence += 0.2;
        }
        if (criteria.preferredRole && candidate.user.role === criteria.preferredRole) {
            confidence += 0.2;
        }
        if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
            const matchingSkills = criteria.requiredSkills.filter(skill => candidate.expertise.some(exp => exp.includes(skill.toLowerCase()) || skill.toLowerCase().includes(exp)));
            if (matchingSkills.length > 0) {
                confidence += 0.1;
            }
        }
        return Math.min(1.0, confidence);
    }
    determinePreferredRole(caseType, priority) {
        if (priority === client_1.TaskPriority.URGENT || priority === client_1.TaskPriority.HIGH) {
            return client_1.UserRole.ATTORNEY;
        }
        switch (caseType) {
            case client_1.CaseType.MEDICAL_MALPRACTICE:
            case client_1.CaseType.CRIMINAL_DEFENSE:
                return client_1.UserRole.ATTORNEY;
            case client_1.CaseType.LABOR_DISPUTE:
            case client_1.CaseType.CONTRACT_DISPUTE:
                return client_1.UserRole.ATTORNEY;
            default:
                return client_1.UserRole.ASSISTANT;
        }
    }
    calculateEstimatedHours(tasks) {
        return tasks.length * 2;
    }
    calculateCapacityUtilization(tasks) {
        const activeTasks = tasks.filter(t => t.status === client_1.TaskStatus.IN_PROGRESS).length;
        const totalCapacity = 15;
        return Math.min(100, (activeTasks / totalCapacity) * 100);
    }
};
exports.TaskAssignmentService = TaskAssignmentService;
exports.TaskAssignmentService = TaskAssignmentService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], TaskAssignmentService);
//# sourceMappingURL=TaskAssignmentService.js.map