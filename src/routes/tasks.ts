import { Router } from 'express';
import { z } from 'zod';
import { Database } from '../utils/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  caseId: z.string().min(1, 'Case ID is required'),
  assignedTo: z.string().min(1, 'Assigned to is required'),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
});

const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  assignedTo: z.string().min(1, 'Assigned to is required').optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

// Get all tasks
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const db = new Database();
  await db.connect();

  let tasks;
  
  // Admin can see all tasks
  if (req.user!.role === 'ADMIN') {
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
  // Other users can see tasks assigned to them or created by them
  else {
    tasks = await db.client.task.findMany({
      where: {
        OR: [
          { assignedTo: req.user!.id },
          { assignedBy: req.user!.id },
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

// Get task by ID
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const db = new Database();
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
    throw createError('Task not found', 404);
  }

  // Check if user has permission to view this task
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    task.assignedTo === req.user!.id ||
    task.assignedBy === req.user!.id ||
    (req.user!.role === 'ATTORNEY' && task.case.attorney.userId === req.user!.id) ||
    (req.user!.role === 'CLIENT' && task.case.client.userId === req.user!.id);

  if (!hasAccess) {
    throw createError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { task },
  });
}));

// Create task
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const validatedData = createTaskSchema.parse(req.body);

  const db = new Database();
  await db.connect();

  // Verify case exists and user has access
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
    throw createError('Case not found', 404);
  }

  // Check if user has permission to create task for this case
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    (req.user!.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user!.id) ||
    (req.user!.role === 'CLIENT' && caseRecord.client.userId === req.user!.id);

  if (!hasAccess) {
    await db.disconnect();
    throw createError('Access denied', 403);
  }

  // Verify assignee exists
  const assignee = await db.client.user.findUnique({
    where: { id: validatedData.assignedTo },
  });

  if (!assignee) {
    await db.disconnect();
    throw createError('Assignee not found', 404);
  }

  const task = await db.client.task.create({
    data: {
      ...validatedData,
      assignedBy: req.user!.id,
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

// Update task
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const validatedData = updateTaskSchema.parse(req.body);

  const db = new Database();
  await db.connect();

  // Check if task exists
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
    throw createError('Task not found', 404);
  }

  // Check if user has permission to update this task
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    existingTask.assignedTo === req.user!.id ||
    existingTask.assignedBy === req.user!.id ||
    (req.user!.role === 'ATTORNEY' && existingTask.case.attorney.userId === req.user!.id) ||
    (req.user!.role === 'CLIENT' && existingTask.case.client.userId === req.user!.id);

  if (!hasAccess) {
    await db.disconnect();
    throw createError('Access denied', 403);
  }

  // If updating assignee, verify new assignee exists
  if (validatedData.assignedTo) {
    const assignee = await db.client.user.findUnique({
      where: { id: validatedData.assignedTo },
    });

    if (!assignee) {
      await db.disconnect();
      throw createError('Assignee not found', 404);
    }
  }

  const updateData: any = { ...validatedData };
  
  // Handle due date conversion
  if (validatedData.dueDate) {
    updateData.dueDate = new Date(validatedData.dueDate);
  }

  // Handle status change to completed
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

// Delete task
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const db = new Database();
  await db.connect();

  // Check if task exists
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
    throw createError('Task not found', 404);
  }

  // Check if user has permission to delete this task
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    existingTask.assignedBy === req.user!.id ||
    (req.user!.role === 'ATTORNEY' && existingTask.case.attorney.userId === req.user!.id);

  if (!hasAccess) {
    await db.disconnect();
    throw createError('Access denied', 403);
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

export default router;