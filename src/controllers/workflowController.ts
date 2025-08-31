import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { 
  CreateDocumentWorkflowInput,
  CreateDocumentWorkflowStepInput,
  UpdateDocumentWorkflowStepInput
} from '../models/documents';

const prisma = new PrismaClient();

// Validation schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().default('PENDING'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  dueDate: z.string().optional(),
  steps: z.array(z.object({
    name: z.string().min(1, 'Step name is required'),
    description: z.string().optional(),
    assignedTo: z.string().optional(),
    dueDate: z.string().optional(),
    order: z.number().min(0, 'Step order is required')
  })).optional().default([])
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional()
});

const addWorkflowStepSchema = z.object({
  name: z.string().min(1, 'Step name is required'),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  order: z.number().min(0, 'Step order is required')
});

const updateWorkflowStepSchema = z.object({
  name: z.string().min(1, 'Step name is required').optional(),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).optional(),
  action: z.string().optional(),
  notes: z.string().optional(),
  completedAt: z.string().optional()
});

const workflowQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

export class WorkflowController {
  
  async createWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id: documentId } = req.params;
      const validatedData = createWorkflowSchema.parse(req.body);

      // Check if document exists and user has permission
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            include: {
              attorney: {
                select: { userId: true }
              },
              client: {
                select: { userId: true }
              }
            }
          }
        }
      });

      if (!document) {
        throw createError('Document not found', 404);
      }

      // Check if user has permission to create workflow for this document
      const hasAccess = await this.checkDocumentAccess(document, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to create workflow for this document', 403);
      }

      // Check if document already has an active workflow
      const existingWorkflow = await prisma.documentWorkflow.findFirst({
        where: {
          documentId,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      });

      if (existingWorkflow) {
        throw createError('Document already has an active workflow', 400);
      }

      // Create workflow
      const workflowData = {
        documentId,
        name: validatedData.name,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        startedBy: req.user.id
      };

      const workflow = await prisma.documentWorkflow.create({
        data: workflowData,
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          },
          startedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          steps: {
            orderBy: { order: 'asc' },
            include: {
              assignedToUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      // Create workflow steps if provided
      if (validatedData.steps && validatedData.steps.length > 0) {
        const stepsData = validatedData.steps.map((step, index) => ({
          workflowId: workflow.id,
          name: step.name,
          description: step.description,
          assignedTo: step.assignedTo,
          dueDate: step.dueDate ? new Date(step.dueDate) : null,
          order: step.order
        }));

        await prisma.documentWorkflowStep.createMany({
          data: stepsData
        });

        // Re-fetch workflow with steps
        const workflowWithSteps = await prisma.documentWorkflow.findUnique({
          where: { id: workflow.id },
          include: {
            document: {
              select: {
                id: true,
                filename: true,
                originalName: true
              }
            },
            startedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            steps: {
              orderBy: { order: 'asc' },
              include: {
                assignedToUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        });

        res.status(201).json({
          success: true,
          data: workflowWithSteps,
          message: 'Workflow created successfully'
        });
      } else {
        res.status(201).json({
          success: true,
          data: workflow,
          message: 'Workflow created successfully'
        });
      }

    } catch (error) {
      next(error);
    }
  }

  async getWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id: workflowId } = req.params;

      const workflow = await prisma.documentWorkflow.findUnique({
        where: { id: workflowId },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          },
          startedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          steps: {
            orderBy: { order: 'asc' },
            include: {
              assignedToUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!workflow) {
        throw createError('Workflow not found', 404);
      }

      // Check if user has access to the document
      const hasAccess = await this.checkDocumentAccess(workflow.document, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to this workflow', 403);
      }

      res.json({
        success: true,
        data: workflow
      });

    } catch (error) {
      next(error);
    }
  }

  async updateWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id: workflowId } = req.params;
      const validatedData = updateWorkflowSchema.parse(req.body);

      // Check if workflow exists and user has permission
      const existingWorkflow = await prisma.documentWorkflow.findUnique({
        where: { id: workflowId },
        include: {
          document: {
            include: {
              case: {
                include: {
                  attorney: {
                    select: { userId: true }
                  },
                  client: {
                    select: { userId: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!existingWorkflow) {
        throw createError('Workflow not found', 404);
      }

      // Check if user has permission to update this workflow
      const hasAccess = await this.checkDocumentAccess(existingWorkflow.document, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to update this workflow', 403);
      }

      // Only workflow starter or admin can update workflow
      if (existingWorkflow.startedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Only workflow starter or admin can update workflow', 403);
      }

      const updatedWorkflow = await prisma.documentWorkflow.update({
        where: { id: workflowId },
        data: {
          ...validatedData,
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined
        },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          },
          startedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          steps: {
            orderBy: { order: 'asc' },
            include: {
              assignedToUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        data: updatedWorkflow,
        message: 'Workflow updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async deleteWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id: workflowId } = req.params;

      // Check if workflow exists and user has permission
      const existingWorkflow = await prisma.documentWorkflow.findUnique({
        where: { id: workflowId },
        include: {
          document: {
            include: {
              case: {
                include: {
                  attorney: {
                    select: { userId: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!existingWorkflow) {
        throw createError('Workflow not found', 404);
      }

      // Check if user has permission to delete this workflow
      const hasAccess = await this.checkDocumentAccess(existingWorkflow.document, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to delete this workflow', 403);
      }

      // Only workflow starter or admin can delete workflow
      if (existingWorkflow.startedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Only workflow starter or admin can delete workflow', 403);
      }

      // Delete workflow and its steps
      await prisma.documentWorkflowStep.deleteMany({
        where: { workflowId }
      });

      await prisma.documentWorkflow.delete({
        where: { id: workflowId }
      });

      res.json({
        success: true,
        message: 'Workflow deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async addWorkflowStep(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id: workflowId } = req.params;
      const validatedData = addWorkflowStepSchema.parse(req.body);

      // Check if workflow exists and user has permission
      const workflow = await prisma.documentWorkflow.findUnique({
        where: { id: workflowId },
        include: {
          document: {
            include: {
              case: {
                include: {
                  attorney: {
                    select: { userId: true }
                  },
                  client: {
                    select: { userId: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!workflow) {
        throw createError('Workflow not found', 404);
      }

      // Check if user has permission to modify this workflow
      const hasAccess = await this.checkDocumentAccess(workflow.document, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to modify this workflow', 403);
      }

      // Only workflow starter or admin can add steps
      if (workflow.startedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Only workflow starter or admin can add steps', 403);
      }

      // Add workflow step
      const stepData = {
        workflowId,
        name: validatedData.name,
        description: validatedData.description,
        assignedTo: validatedData.assignedTo,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        order: validatedData.order
      };

      const step = await prisma.documentWorkflowStep.create({
        data: stepData,
        include: {
          assignedToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: step,
        message: 'Workflow step added successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async updateWorkflowStep(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id: workflowId, stepId } = req.params;
      const validatedData = updateWorkflowStepSchema.parse(req.body);

      // Check if workflow step exists and user has permission
      const step = await prisma.documentWorkflowStep.findUnique({
        where: { id: stepId },
        include: {
          workflow: {
            include: {
              document: {
                include: {
                  case: {
                    include: {
                      attorney: {
                        select: { userId: true }
                      },
                      client: {
                        select: { userId: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!step) {
        throw createError('Workflow step not found', 404);
      }

      if (step.workflowId !== workflowId) {
        throw createError('Workflow step does not belong to this workflow', 400);
      }

      // Check if user has permission to modify this workflow
      const hasAccess = await this.checkDocumentAccess(step.workflow.document, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to modify this workflow step', 403);
      }

      // Check if user can update this step
      const canUpdate = 
        step.workflow.startedBy === req.user.id ||
        step.assignedTo === req.user.id ||
        ['ADMIN', 'MANAGER'].includes(req.user.role);

      if (!canUpdate) {
        throw createError('Access denied to update this workflow step', 403);
      }

      // Update workflow step
      const updatedStep = await prisma.documentWorkflowStep.update({
        where: { id: stepId },
        data: {
          ...validatedData,
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
          completedAt: validatedData.completedAt ? new Date(validatedData.completedAt) : undefined
        },
        include: {
          assignedToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Check if all steps are completed
      if (validatedData.status === 'COMPLETED') {
        await this.checkAndUpdateWorkflowStatus(step.workflowId);
      }

      res.json({
        success: true,
        data: updatedStep,
        message: 'Workflow step updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async getDocumentWorkflows(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id: documentId } = req.params;
      const validatedQuery = workflowQuerySchema.parse(req.query);

      // Check if document exists and user has permission
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            include: {
              attorney: {
                select: { userId: true }
              },
              client: {
                select: { userId: true }
              }
            }
          }
        }
      });

      if (!document) {
        throw createError('Document not found', 404);
      }

      // Check if user has access to the document
      const hasAccess = await this.checkDocumentAccess(document, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to view workflows for this document', 403);
      }

      // Build where clause
      const where: any = { documentId };

      if (validatedQuery.status) {
        where.status = validatedQuery.status;
      }

      if (validatedQuery.priority) {
        where.priority = validatedQuery.priority;
      }

      if (validatedQuery.assignedTo) {
        where.steps = {
          some: {
            assignedTo: validatedQuery.assignedTo
          }
        };
      }

      const [workflows, total] = await Promise.all([
        prisma.documentWorkflow.findMany({
          where,
          include: {
            document: {
              select: {
                id: true,
                filename: true,
                originalName: true
              }
            },
            startedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            steps: {
              orderBy: { order: 'asc' },
              include: {
                assignedToUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: {
            [validatedQuery.sortBy]: validatedQuery.sortOrder
          },
          skip: validatedQuery.offset,
          take: validatedQuery.limit
        }),
        prisma.documentWorkflow.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          workflows,
          pagination: {
            total,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset,
            totalPages: Math.ceil(total / validatedQuery.limit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  private async checkDocumentAccess(document: any, userId: string, userRole: string): Promise<boolean> {
    // Admin can access all documents
    if (userRole === 'ADMIN') {
      return true;
    }

    // Document owner can access
    if (document.uploadedBy === userId) {
      return true;
    }

    // Check case access
    if (document.case) {
      const caseAccess = await prisma.case.findFirst({
        where: {
          id: document.case.id,
          OR: [
            { attorney: { userId } },
            { client: { userId } }
          ]
        }
      });

      if (caseAccess) {
        return true;
      }
    }

    return false;
  }

  private async checkAndUpdateWorkflowStatus(workflowId: string): Promise<void> {
    const steps = await prisma.documentWorkflowStep.findMany({
      where: { workflowId }
    });

    const allCompleted = steps.every(step => step.status === 'COMPLETED');
    const anyInProgress = steps.some(step => step.status === 'IN_PROGRESS');

    let newStatus = 'PENDING';
    if (allCompleted) {
      newStatus = 'COMPLETED';
    } else if (anyInProgress) {
      newStatus = 'IN_PROGRESS';
    }

    await prisma.documentWorkflow.update({
      where: { id: workflowId },
      data: { status: newStatus }
    });
  }
}

export const workflowController = new WorkflowController();