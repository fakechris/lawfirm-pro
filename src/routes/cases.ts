import { Router } from 'express';
import { z } from 'zod';
import { Database } from '../utils/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createCaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  caseType: z.enum([
    'LABOR_DISPUTE', 'MEDICAL_MALPRACTICE', 'CRIMINAL_DEFENSE', 
    'DIVORCE_FAMILY', 'INHERITANCE_DISPUTE', 'CONTRACT_DISPUTE', 
    'ADMINISTRATIVE_CASE', 'DEMOLITION_CASE', 'SPECIAL_MATTERS'
  ]),
  status: z.enum(['INTAKE', 'ACTIVE', 'PENDING', 'COMPLETED', 'CLOSED', 'ARCHIVED']).optional().default('INTAKE'),
  phase: z.enum([
    'INTAKE_RISK_ASSESSMENT', 'PRE_PROCEEDING_PREPARATION', 
    'FORMAL_PROCEEDINGS', 'RESOLUTION_POST_PROCEEDING', 'CLOSURE_REVIEW_ARCHIVING'
  ]).optional().default('INTAKE_RISK_ASSESSMENT'),
  clientId: z.string().min(1, 'Client ID is required'),
  attorneyId: z.string().min(1, 'Attorney ID is required'),
});

const updateCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  caseType: z.enum([
    'LABOR_DISPUTE', 'MEDICAL_MALPRACTICE', 'CRIMINAL_DEFENSE', 
    'DIVORCE_FAMILY', 'INHERITANCE_DISPUTE', 'CONTRACT_DISPUTE', 
    'ADMINISTRATIVE_CASE', 'DEMOLITION_CASE', 'SPECIAL_MATTERS'
  ]).optional(),
  status: z.enum(['INTAKE', 'ACTIVE', 'PENDING', 'COMPLETED', 'CLOSED', 'ARCHIVED']).optional(),
  phase: z.enum([
    'INTAKE_RISK_ASSESSMENT', 'PRE_PROCEEDING_PREPARATION', 
    'FORMAL_PROCEEDINGS', 'RESOLUTION_POST_PROCEEDING', 'CLOSURE_REVIEW_ARCHIVING'
  ]).optional(),
  clientId: z.string().min(1, 'Client ID is required').optional(),
  attorneyId: z.string().min(1, 'Attorney ID is required').optional(),
});

// Get all cases
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const db = new Database();
  await db.connect();

  let cases;
  
  // Admin can see all cases
  if (req.user!.role === 'ADMIN') {
    cases = await db.client.case.findMany({
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attorney: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        documents: true,
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  } 
  // Attorneys can see their assigned cases
  else if (req.user!.role === 'ATTORNEY') {
    // Get attorney profile ID
    const attorneyProfile = await db.client.attorneyProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!attorneyProfile) {
      await db.disconnect();
      throw createError('Attorney profile not found', 404);
    }

    cases = await db.client.case.findMany({
      where: { attorneyId: attorneyProfile.id },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attorney: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        documents: true,
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  // Clients can see their own cases
  else if (req.user!.role === 'CLIENT') {
    // Get client profile ID
    const clientProfile = await db.client.clientProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!clientProfile) {
      await db.disconnect();
      throw createError('Client profile not found', 404);
    }

    cases = await db.client.case.findMany({
      where: { clientId: clientProfile.id },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attorney: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        documents: true,
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  } else {
    // Assistants and other roles can't see cases
    cases = [];
  }

  await db.disconnect();

  res.json({
    success: true,
    data: { cases },
  });
}));

// Get case by ID
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const db = new Database();
  await db.connect();

  const caseRecord = await db.client.case.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      attorney: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      documents: true,
      tasks: {
        include: {
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
      },
    },
  });

  await db.disconnect();

  if (!caseRecord) {
    throw createError('Case not found', 404);
  }

  // Check if user has permission to view this case
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    (req.user!.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user!.id) ||
    (req.user!.role === 'CLIENT' && caseRecord.client.userId === req.user!.id);

  if (!hasAccess) {
    throw createError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { case: caseRecord },
  });
}));

// Create case
router.post('/', authenticate, authorize(['ADMIN', 'ATTORNEY']), asyncHandler(async (req: AuthRequest, res) => {
  const validatedData = createCaseSchema.parse(req.body);

  const db = new Database();
  await db.connect();

  // Verify client exists
  const client = await db.client.clientProfile.findUnique({
    where: { id: validatedData.clientId },
  });

  if (!client) {
    await db.disconnect();
    throw createError('Client not found', 404);
  }

  // Verify attorney exists
  const attorney = await db.client.attorneyProfile.findUnique({
    where: { id: validatedData.attorneyId },
  });

  if (!attorney) {
    await db.disconnect();
    throw createError('Attorney not found', 404);
  }

  // Non-admin attorneys can only create cases for themselves
  if (req.user!.role === 'ATTORNEY' && attorney.userId !== req.user!.id) {
    await db.disconnect();
    throw createError('You can only create cases for yourself', 403);
  }

  const caseRecord = await db.client.case.create({
    data: validatedData,
    include: {
      client: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      attorney: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  await db.disconnect();

  res.status(201).json({
    success: true,
    message: 'Case created successfully',
    data: { case: caseRecord },
  });
}));

// Update case
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const validatedData = updateCaseSchema.parse(req.body);

  const db = new Database();
  await db.connect();

  // Check if case exists
  const existingCase = await db.client.case.findUnique({
    where: { id },
    include: {
      attorney: {
        select: { userId: true },
      },
      client: {
        select: { userId: true },
      },
    },
  });

  if (!existingCase) {
    await db.disconnect();
    throw createError('Case not found', 404);
  }

  // Check if user has permission to update this case
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    (req.user!.role === 'ATTORNEY' && existingCase.attorney.userId === req.user!.id);

  if (!hasAccess) {
    await db.disconnect();
    throw createError('Access denied', 403);
  }

  // If updating attorney, verify new attorney exists
  if (validatedData.attorneyId) {
    const attorney = await db.client.attorneyProfile.findUnique({
      where: { id: validatedData.attorneyId },
    });

    if (!attorney) {
      await db.disconnect();
      throw createError('Attorney not found', 404);
    }
  }

  // If updating client, verify new client exists
  if (validatedData.clientId) {
    const client = await db.client.clientProfile.findUnique({
      where: { id: validatedData.clientId },
    });

    if (!client) {
      await db.disconnect();
      throw createError('Client not found', 404);
    }
  }

  const caseRecord = await db.client.case.update({
    where: { id },
    data: validatedData,
    include: {
      client: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      attorney: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  await db.disconnect();

  res.json({
    success: true,
    message: 'Case updated successfully',
    data: { case: caseRecord },
  });
}));

// Delete case
router.delete('/:id', authenticate, authorize(['ADMIN', 'ATTORNEY']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const db = new Database();
  await db.connect();

  // Check if case exists
  const existingCase = await db.client.case.findUnique({
    where: { id },
    include: {
      attorney: {
        select: { userId: true },
      },
    },
  });

  if (!existingCase) {
    await db.disconnect();
    throw createError('Case not found', 404);
  }

  // Non-admin attorneys can only delete their own cases
  if (req.user!.role === 'ATTORNEY' && existingCase.attorney.userId !== req.user!.id) {
    await db.disconnect();
    throw createError('You can only delete your own cases', 403);
  }

  await db.client.case.delete({
    where: { id },
  });

  await db.disconnect();

  res.json({
    success: true,
    message: 'Case deleted successfully',
  });
}));

export default router;