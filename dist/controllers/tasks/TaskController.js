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
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskController = void 0;
const tsyringe_1 = require("tsyringe");
const zod_1 = require("zod");
const TaskService_1 = require("../services/tasks/TaskService");
const TaskAssignmentService_1 = require("../services/tasks/TaskAssignmentService");
const TaskDependencyService_1 = require("../services/tasks/TaskDependencyService");
const TaskPriorityService_1 = require("../services/tasks/TaskPriorityService");
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const client_1 = require("@prisma/client");
let TaskController = class TaskController {
    constructor(taskService, assignmentService, dependencyService, priorityService, db) {
        this.taskService = taskService;
        this.assignmentService = assignmentService;
        this.dependencyService = dependencyService;
        this.priorityService = priorityService;
        this.db = db;
        this.createTaskSchema = zod_1.z.object({
            title: zod_1.z.string().min(1, 'Title is required'),
            description: zod_1.z.string().optional(),
            caseId: zod_1.z.string().min(1, 'Case ID is required'),
            assignedTo: zod_1.z.string().min(1, 'Assigned to is required'),
            dueDate: zod_1.z.string().datetime().optional(),
            priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM')
        });
        this.updateTaskSchema = zod_1.z.object({
            title: zod_1.z.string().min(1, 'Title is required').optional(),
            description: zod_1.z.string().optional(),
            assignedTo: zod_1.z.string().min(1, 'Assigned to is required').optional(),
            dueDate: zod_1.z.string().datetime().optional(),
            status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
            priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional()
        });
        this.createDependencySchema = zod_1.z.object({
            taskId: zod_1.z.string().min(1, 'Task ID is required'),
            dependsOnTaskId: zod_1.z.string().min(1, 'Dependency task ID is required'),
            dependencyType: zod_1.z.enum(['BLOCKING', 'SEQUENTIAL', 'PARALLEL', 'SUGGESTED']).optional().default('BLOCKING')
        });
        this.assignmentCriteriaSchema = zod_1.z.object({
            caseType: zod_1.z.nativeEnum(client_1.CaseType),
            requiredSkills: zod_1.z.array(zod_1.z.string()).optional(),
            priority: zod_1.z.nativeEnum(client_1.TaskPriority).optional(),
            estimatedHours: zod_1.z.number().optional(),
            deadline: zod_1.z.string().datetime().optional(),
            preferredRole: zod_1.z.nativeEnum(client_1.UserRole).optional()
        });
        this.createTask = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const validatedData = this.createTaskSchema.parse(req.body);
            const task = await this.taskService.createTask({
                ...validatedData,
                dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
                priority: validatedData.priority
            }, req.user.id);
            res.status(201).json({
                success: true,
                message: 'Task created successfully',
                data: { task }
            });
        });
        this.getTask = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const task = await this.taskService.getTaskById(id, req.user.id, req.user.role);
            res.json({
                success: true,
                data: { task }
            });
        });
        this.getTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const filters = {
                status: req.query.status,
                priority: req.query.priority,
                assignedTo: req.query.assignedTo,
                caseId: req.query.caseId,
                dueBefore: req.query.dueBefore ? new Date(req.query.dueBefore) : undefined,
                dueAfter: req.query.dueAfter ? new Date(req.query.dueAfter) : undefined
            };
            const tasks = await this.taskService.getTasks(filters, req.user.id, req.user.role);
            res.json({
                success: true,
                data: { tasks }
            });
        });
        this.updateTask = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const validatedData = this.updateTaskSchema.parse(req.body);
            const task = await this.taskService.updateTask(id, {
                ...validatedData,
                dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
                status: validatedData.status,
                priority: validatedData.priority
            }, req.user.id, req.user.role);
            res.json({
                success: true,
                message: 'Task updated successfully',
                data: { task }
            });
        });
        this.deleteTask = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.taskService.deleteTask(id, req.user.id, req.user.role);
            res.json({
                success: true,
                message: 'Task deleted successfully'
            });
        });
        this.getTaskStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const stats = await this.taskService.getTaskStats(req.user.id, req.user.role);
            res.json({
                success: true,
                data: { stats }
            });
        });
        this.getTasksByCase = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { caseId } = req.params;
            const tasks = await this.taskService.getTasksByCase(caseId, req.user.id, req.user.role);
            res.json({
                success: true,
                data: { tasks }
            });
        });
        this.recommendAssignees = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const criteria = this.assignmentCriteriaSchema.parse(req.body);
            const recommendations = await this.assignmentService.recommendAssignees({
                ...criteria,
                deadline: criteria.deadline ? new Date(criteria.deadline) : undefined
            });
            res.json({
                success: true,
                data: { recommendations }
            });
        });
        this.autoAssignTask = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const criteria = req.body ? this.assignmentCriteriaSchema.parse(req.body) : undefined;
            const assignedUserId = await this.assignmentService.autoAssignTask(id, criteria ? {
                ...criteria,
                deadline: criteria.deadline ? new Date(criteria.deadline) : undefined
            } : undefined);
            res.json({
                success: true,
                message: 'Task auto-assigned successfully',
                data: { assignedUserId }
            });
        });
        this.getUserWorkload = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { userId } = req.params;
            if (req.user.role !== client_1.UserRole.ADMIN && userId !== req.user.id) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const workload = await this.assignmentService.getUserWorkload(userId);
            res.json({
                success: true,
                data: { workload }
            });
        });
        this.getTeamWorkloads = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const workloads = await this.assignmentService.getTeamWorkloads();
            res.json({
                success: true,
                data: { workloads }
            });
        });
        this.reassignTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { userId, newUserId, reason } = req.body;
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const reassignedCount = await this.assignmentService.reassignTasks(userId, newUserId, reason);
            res.json({
                success: true,
                message: `Reassigned ${reassignedCount} tasks successfully`,
                data: { reassignedCount }
            });
        });
        this.createDependency = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const dependencyData = this.createDependencySchema.parse(req.body);
            const dependency = await this.dependencyService.createDependency(dependencyData);
            res.status(201).json({
                success: true,
                message: 'Dependency created successfully',
                data: { dependency }
            });
        });
        this.getTaskDependencies = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { taskId } = req.params;
            const dependencies = await this.dependencyService.getDependenciesByTask(taskId);
            res.json({
                success: true,
                data: { dependencies }
            });
        });
        this.getTaskDependents = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { taskId } = req.params;
            const dependents = await this.dependencyService.getDependentsByTask(taskId);
            res.json({
                success: true,
                data: { dependents }
            });
        });
        this.getDependencyGraph = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { caseId } = req.params;
            const graph = await this.dependencyService.getDependencyGraph(caseId);
            res.json({
                success: true,
                data: { graph }
            });
        });
        this.validateDependencies = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { taskId } = req.params;
            const validation = await this.dependencyService.validateDependencies(taskId);
            res.json({
                success: true,
                data: { validation }
            });
        });
        this.getBlockedTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { caseId } = req.query;
            const blockedTasks = await this.dependencyService.getBlockedTasks(caseId);
            res.json({
                success: true,
                data: { blockedTasks }
            });
        });
        this.canStartTask = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { taskId } = req.params;
            const canStart = await this.dependencyService.canStartTask(taskId);
            res.json({
                success: true,
                data: { canStart }
            });
        });
        this.deleteDependency = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { dependencyId } = req.params;
            await this.dependencyService.deleteDependency(dependencyId);
            res.json({
                success: true,
                message: 'Dependency deleted successfully'
            });
        });
        this.prioritizeTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { caseId, userId } = req.query;
            const prioritizedTasks = await this.priorityService.prioritizeTasks(caseId, userId);
            res.json({
                success: true,
                data: { prioritizedTasks }
            });
        });
        this.getPriorityBasedTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { limit } = req.query;
            const tasks = await this.priorityService.getPriorityBasedTaskList(limit ? parseInt(limit) : 20);
            res.json({
                success: true,
                data: { tasks }
            });
        });
        this.getOverdueTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { caseId } = req.query;
            const overdueTasks = await this.priorityService.getOverdueTasks(caseId);
            res.json({
                success: true,
                data: { overdueTasks }
            });
        });
        this.getUrgentTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { hoursThreshold } = req.query;
            const urgentTasks = await this.priorityService.getUrgentTasks(hoursThreshold ? parseInt(hoursThreshold) : 24);
            res.json({
                success: true,
                data: { urgentTasks }
            });
        });
        this.adjustTaskPriority = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { taskId } = req.params;
            const { newPriority, reason } = req.body;
            const task = await this.priorityService.adjustTaskPriority({
                taskId,
                newPriority: newPriority,
                reason,
                adjustedBy: req.user.id
            });
            res.json({
                success: true,
                message: 'Task priority adjusted successfully',
                data: { task }
            });
        });
        this.autoPrioritizeCaseTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { caseId } = req.params;
            const updatedCount = await this.priorityService.autoPrioritizeCaseTasks(caseId);
            res.json({
                success: true,
                message: `Auto-prioritized ${updatedCount} tasks successfully`,
                data: { updatedCount }
            });
        });
        this.calculateTaskPriority = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { taskId } = req.params;
            const priorityScore = await this.priorityService.calculateTaskPriority(taskId);
            res.json({
                success: true,
                data: { priorityScore }
            });
        });
        this.bulkAssignTasks = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { caseId, taskTemplates } = req.body;
            if (req.user.role !== client_1.UserRole.ADMIN) {
                throw (0, errorHandler_1.createError)('Access denied', 403);
            }
            const assignedTaskIds = await this.assignmentService.bulkAssignTasks(caseId, taskTemplates);
            res.json({
                success: true,
                message: `Bulk assigned ${assignedTaskIds.length} tasks successfully`,
                data: { assignedTaskIds }
            });
        });
        this.bulkCreateDependencies = (0, errorHandler_1.asyncHandler)(async (req, res) => {
            const { taskId, dependencyTaskIds, dependencyType } = req.body;
            const dependencies = await this.dependencyService.bulkCreateDependencies(taskId, dependencyTaskIds, dependencyType);
            res.json({
                success: true,
                message: `Created ${dependencies.length} dependencies successfully`,
                data: { dependencies }
            });
        });
    }
};
exports.TaskController = TaskController;
exports.TaskController = TaskController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(TaskService_1.TaskService)),
    __param(1, (0, tsyringe_1.inject)(TaskAssignmentService_1.TaskAssignmentService)),
    __param(2, (0, tsyringe_1.inject)(TaskDependencyService_1.TaskDependencyService)),
    __param(3, (0, tsyringe_1.inject)(TaskPriorityService_1.TaskPriorityService)),
    __param(4, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [typeof (_a = typeof TaskService_1.TaskService !== "undefined" && TaskService_1.TaskService) === "function" ? _a : Object, typeof (_b = typeof TaskAssignmentService_1.TaskAssignmentService !== "undefined" && TaskAssignmentService_1.TaskAssignmentService) === "function" ? _b : Object, typeof (_c = typeof TaskDependencyService_1.TaskDependencyService !== "undefined" && TaskDependencyService_1.TaskDependencyService) === "function" ? _c : Object, typeof (_d = typeof TaskPriorityService_1.TaskPriorityService !== "undefined" && TaskPriorityService_1.TaskPriorityService) === "function" ? _d : Object, typeof (_e = typeof database_1.Database !== "undefined" && database_1.Database) === "function" ? _e : Object])
], TaskController);
//# sourceMappingURL=TaskController.js.map