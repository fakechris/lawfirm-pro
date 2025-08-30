"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    caseId: zod_1.z.string().min(1, 'Case ID is required'),
    assignedTo: zod_1.z.string().min(1, 'Assigned to is required'),
    dueDate: zod_1.z.string().datetime().optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').optional(),
    description: zod_1.z.string().optional(),
    assignedTo: zod_1.z.string().min(1, 'Assigned to is required').optional(),
    dueDate: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});
router.get('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = new database_1.Database();
    await db.connect();
    let tasks;
    if (req.user.role === 'ADMIN') {
        tasks = await db.client.task.findMany({
            include: {
                case: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                creator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    else {
        tasks = await db.client.task.findMany({
            where: {
                OR: [
                    { assignedTo: req.user.id },
                    { assignedBy: req.user.id },
                ],
            },
            include: {
                case: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                creator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    await db.disconnect();
    res.json({
        success: true,
        data: { tasks },
    });
}));
router.get('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const task = await db.client.task.findUnique({
        where: { id },
        include: {
            case: {
                include: {
                    attorney: {
                        select: { userId: true },
                    },
                    client: {
                        select: { userId: true },
                    },
                },
            },
            assignee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            creator: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
        },
    });
    await db.disconnect();
    if (!task) {
        throw (0, errorHandler_1.createError)('Task not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        task.assignedTo === req.user.id ||
        task.assignedBy === req.user.id ||
        (req.user.role === 'ATTORNEY' && task.case.attorney.userId === req.user.id) ||
        (req.user.role === 'CLIENT' && task.case.client.userId === req.user.id);
    if (!hasAccess) {
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    res.json({
        success: true,
        data: { task },
    });
}));
router.post('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const validatedData = createTaskSchema.parse(req.body);
    const db = new database_1.Database();
    await db.connect();
    const caseRecord = await db.client.case.findUnique({
        where: { id: validatedData.caseId },
        include: {
            attorney: {
                select: { userId: true },
            },
            client: {
                select: { userId: true },
            },
        },
    });
    if (!caseRecord) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Case not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        (req.user.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user.id) ||
        (req.user.role === 'CLIENT' && caseRecord.client.userId === req.user.id);
    if (!hasAccess) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    const assignee = await db.client.user.findUnique({
        where: { id: validatedData.assignedTo },
    });
    if (!assignee) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Assignee not found', 404);
    }
    const task = await db.client.task.create({
        data: {
            ...validatedData,
            assignedBy: req.user.id,
            dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        },
        include: {
            case: {
                select: {
                    id: true,
                    title: true,
                },
            },
            assignee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
            creator: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });
    await db.disconnect();
    res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: { task },
    });
}));
router.put('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const validatedData = updateTaskSchema.parse(req.body);
    const db = new database_1.Database();
    await db.connect();
    const existingTask = await db.client.task.findUnique({
        where: { id },
        include: {
            case: {
                include: {
                    attorney: {
                        select: { userId: true },
                    },
                    client: {
                        select: { userId: true },
                    },
                },
            },
        },
    });
    if (!existingTask) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Task not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        existingTask.assignedTo === req.user.id ||
        existingTask.assignedBy === req.user.id ||
        (req.user.role === 'ATTORNEY' && existingTask.case.attorney.userId === req.user.id) ||
        (req.user.role === 'CLIENT' && existingTask.case.client.userId === req.user.id);
    if (!hasAccess) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    if (validatedData.assignedTo) {
        const assignee = await db.client.user.findUnique({
            where: { id: validatedData.assignedTo },
        });
        if (!assignee) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Assignee not found', 404);
        }
    }
    const updateData = { ...validatedData };
    if (validatedData.dueDate) {
        updateData.dueDate = new Date(validatedData.dueDate);
    }
    if (validatedData.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        updateData.completedAt = new Date();
    }
    const task = await db.client.task.update({
        where: { id },
        data: updateData,
        include: {
            case: {
                select: {
                    id: true,
                    title: true,
                },
            },
            assignee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
            creator: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'Task updated successfully',
        data: { task },
    });
}));
router.delete('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const existingTask = await db.client.task.findUnique({
        where: { id },
        include: {
            case: {
                include: {
                    attorney: {
                        select: { userId: true },
                    },
                },
            },
        },
    });
    if (!existingTask) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Task not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        existingTask.assignedBy === req.user.id ||
        (req.user.role === 'ATTORNEY' && existingTask.case.attorney.userId === req.user.id);
    if (!hasAccess) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    await db.client.task.delete({
        where: { id },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'Task deleted successfully',
    });
}));
exports.default = router;
//# sourceMappingURL=tasks.js.map