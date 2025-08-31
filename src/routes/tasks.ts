import { Router } from 'express';
import { container } from 'tsyringe';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { TaskController } from '../controllers/tasks/TaskController';

const router = Router();
const taskController = container.resolve(TaskController);

// Task CRUD Operations
router.get('/', authenticate, asyncHandler(taskController.getTasks.bind(taskController)));
router.get('/stats', authenticate, asyncHandler(taskController.getTaskStats.bind(taskController)));
router.get('/case/:caseId', authenticate, asyncHandler(taskController.getTasksByCase.bind(taskController)));
router.get('/:id', authenticate, asyncHandler(taskController.getTask.bind(taskController)));
router.post('/', authenticate, asyncHandler(taskController.createTask.bind(taskController)));
router.put('/:id', authenticate, asyncHandler(taskController.updateTask.bind(taskController)));
router.delete('/:id', authenticate, asyncHandler(taskController.deleteTask.bind(taskController)));

// Assignment Operations
router.post('/assignment/recommend', authenticate, asyncHandler(taskController.recommendAssignees.bind(taskController)));
router.post('/:id/auto-assign', authenticate, asyncHandler(taskController.autoAssignTask.bind(taskController)));
router.get('/workload/user/:userId', authenticate, asyncHandler(taskController.getUserWorkload.bind(taskController)));
router.get('/workload/team', authenticate, asyncHandler(taskController.getTeamWorkloads.bind(taskController)));
router.post('/reassign', authenticate, asyncHandler(taskController.reassignTasks.bind(taskController)));

// Dependency Operations
router.post('/dependencies', authenticate, asyncHandler(taskController.createDependency.bind(taskController)));
router.get('/dependencies/task/:taskId', authenticate, asyncHandler(taskController.getTaskDependencies.bind(taskController)));
router.get('/dependents/task/:taskId', authenticate, asyncHandler(taskController.getTaskDependents.bind(taskController)));
router.get('/dependencies/graph/:caseId', authenticate, asyncHandler(taskController.getDependencyGraph.bind(taskController)));
router.get('/dependencies/validate/:taskId', authenticate, asyncHandler(taskController.validateDependencies.bind(taskController)));
router.get('/dependencies/blocked', authenticate, asyncHandler(taskController.getBlockedTasks.bind(taskController)));
router.get('/dependencies/can-start/:taskId', authenticate, asyncHandler(taskController.canStartTask.bind(taskController)));
router.delete('/dependencies/:dependencyId', authenticate, asyncHandler(taskController.deleteDependency.bind(taskController)));

// Priority Operations
router.get('/priority/list', authenticate, asyncHandler(taskController.prioritizeTasks.bind(taskController)));
router.get('/priority/based', authenticate, asyncHandler(taskController.getPriorityBasedTasks.bind(taskController)));
router.get('/priority/overdue', authenticate, asyncHandler(taskController.getOverdueTasks.bind(taskController)));
router.get('/priority/urgent', authenticate, asyncHandler(taskController.getUrgentTasks.bind(taskController)));
router.post('/priority/adjust/:taskId', authenticate, asyncHandler(taskController.adjustTaskPriority.bind(taskController)));
router.post('/priority/auto-prioritize/:caseId', authenticate, asyncHandler(taskController.autoPrioritizeCaseTasks.bind(taskController)));
router.get('/priority/calculate/:taskId', authenticate, asyncHandler(taskController.calculateTaskPriority.bind(taskController)));

// Bulk Operations
router.post('/bulk/assign', authenticate, asyncHandler(taskController.bulkAssignTasks.bind(taskController)));
router.post('/bulk/dependencies', authenticate, asyncHandler(taskController.bulkCreateDependencies.bind(taskController)));

export default router;