import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { documentStorageService } from '../services/documents';
import { EvidenceItem } from '../models/documents/evidence';

const prisma = new PrismaClient();

// Validation schemas
const createEvidenceSchema = z.object({
  title: z.string().min(1, 'Evidence title is required'),
  description: z.string().optional(),
  type: z.enum(['PHYSICAL', 'DIGITAL', 'DOCUMENT', 'TESTIMONY', 'EXPERT_REPORT', 'PHOTO', 'VIDEO', 'AUDIO', 'OTHER']),
  caseId: z.string().min(1, 'Case ID is required'),
  collectedBy: z.string().optional(),
  collectedAt: z.string().optional(),
  location: z.string().optional(),
  chainOfCustody: z.array(z.object({
    transferredTo: z.string(),
    transferredBy: z.string(),
    transferDate: z.string(),
    reason: z.string(),
    notes: z.string().optional()
  })).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  isConfidential: z.boolean().optional().default(false)
});

const updateEvidenceSchema = z.object({
  title: z.string().min(1, 'Evidence title is required').optional(),
  description: z.string().optional(),
  type: z.enum(['PHYSICAL', 'DIGITAL', 'DOCUMENT', 'TESTIMONY', 'EXPERT_REPORT', 'PHOTO', 'VIDEO', 'AUDIO', 'OTHER']).optional(),
  collectedBy: z.string().optional(),
  collectedAt: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isConfidential: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DESTROYED', 'RELEASED']).optional()
});

const evidenceQuerySchema = z.object({
  caseId: z.string().optional(),
  type: z.enum(['PHYSICAL', 'DIGITAL', 'DOCUMENT', 'TESTIMONY', 'EXPERT_REPORT', 'PHOTO', 'VIDEO', 'AUDIO', 'OTHER']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DESTROYED', 'RELEASED']).optional(),
  collectedBy: z.string().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  isConfidential: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'collectedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

const chainOfCustodySchema = z.object({
  transferredTo: z.string().min(1, 'Transfer recipient is required'),
  transferDate: z.string().min(1, 'Transfer date is required'),
  reason: z.string().min(1, 'Transfer reason is required'),
  notes: z.string().optional()
});

export class EvidenceController {
  
  async createEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const validatedData = createEvidenceSchema.parse(req.body);

      // Verify case exists and user has access
      const caseRecord = await prisma.case.findUnique({
        where: { id: validatedData.caseId },
        include: {
          attorney: {
            select: { userId: true }
          },
          client: {
            select: { userId: true }
          }
        }
      });

      if (!caseRecord) {
        throw createError('Case not found', 404);
      }

      // Check if user has permission to add evidence to this case
      const hasAccess = 
        req.user.role === 'ADMIN' ||
        (req.user.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user.id) ||
        (req.user.role === 'CLIENT' && caseRecord.client.userId === req.user.id);

      if (!hasAccess) {
        throw createError('Access denied to add evidence to this case', 403);
      }

      // Handle file upload if present
      let filePath = null;
      let fileSize = 0;
      let mimeType = null;
      let checksum = null;

      if (req.file) {
        const validationResult = await documentStorageService.validateFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        if (!validationResult.isValid) {
          throw createError(validationResult.error || 'File validation failed', 400);
        }

        const storageResult = await documentStorageService.uploadFile(
          req.file.buffer,
          req.file.originalname,
          {
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            category: 'evidence',
            subcategory: validatedData.type.toLowerCase(),
            metadata: {
              caseId: validatedData.caseId,
              evidenceType: validatedData.type,
              uploadedBy: req.user.id
            }
          }
        );

        if (!storageResult.success) {
          throw createError(storageResult.error || 'Failed to store evidence file', 500);
        }

        filePath = storageResult.filePath;
        fileSize = storageResult.size;
        mimeType = req.file.mimetype;
        checksum = await documentStorageService.calculateFileHash(req.file.buffer);
      }

      // Create evidence record
      const evidenceData = {
        ...validatedData,
        filePath,
        fileSize,
        mimeType,
        checksum,
        collectedBy: validatedData.collectedBy || req.user.id,
        collectedAt: validatedData.collectedAt ? new Date(validatedData.collectedAt) : new Date(),
        createdBy: req.user.id
      };

      const evidence = await prisma.evidenceItem.create({
        data: evidenceData,
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true
            }
          },
          collectedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          createdByUser: {
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
        data: evidence,
        message: 'Evidence created successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async getEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;

      const evidence = await prisma.evidenceItem.findUnique({
        where: { id },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true
            }
          },
          collectedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          chainOfCustody: {
            orderBy: { transferDate: 'desc' },
            include: {
              transferredToUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              transferredByUser: {
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

      if (!evidence) {
        throw createError('Evidence not found', 404);
      }

      // Check access permissions
      const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to this evidence', 403);
      }

      res.json({
        success: true,
        data: evidence
      });

    } catch (error) {
      next(error);
    }
  }

  async updateEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;
      const validatedData = updateEvidenceSchema.parse(req.body);

      // Check if evidence exists and user has permission
      const existingEvidence = await prisma.evidenceItem.findUnique({
        where: { id },
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

      if (!existingEvidence) {
        throw createError('Evidence not found', 404);
      }

      // Check access permissions
      const hasAccess = await this.checkEvidenceAccess(existingEvidence, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to update this evidence', 403);
      }

      const updatedEvidence = await prisma.evidenceItem.update({
        where: { id },
        data: validatedData,
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true
            }
          },
          collectedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: updatedEvidence,
        message: 'Evidence updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async deleteEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;

      // Check if evidence exists and user has permission
      const existingEvidence = await prisma.evidenceItem.findUnique({
        where: { id },
        include: {
          case: {
            include: {
              attorney: {
                select: { userId: true }
              }
            }
          }
        }
      });

      if (!existingEvidence) {
        throw createError('Evidence not found', 404);
      }

      // Only attorney, admin, or evidence creator can delete
      const hasAccess = 
        req.user.role === 'ADMIN' ||
        (req.user.role === 'ATTORNEY' && existingEvidence.case.attorney.userId === req.user.id) ||
        existingEvidence.createdBy === req.user.id;

      if (!hasAccess) {
        throw createError('Access denied to delete this evidence', 403);
      }

      // Delete evidence file if it exists
      if (existingEvidence.filePath) {
        await documentStorageService.deleteFile(existingEvidence.filePath);
      }

      // Delete evidence record
      await prisma.evidenceItem.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Evidence deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async searchEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const validatedQuery = evidenceQuerySchema.parse(req.query);

      // Build where clause
      const where: any = {};

      if (validatedQuery.caseId) {
        where.caseId = validatedQuery.caseId;
      }

      if (validatedQuery.type) {
        where.type = validatedQuery.type;
      }

      if (validatedQuery.status) {
        where.status = validatedQuery.status;
      }

      if (validatedQuery.collectedBy) {
        where.collectedBy = validatedQuery.collectedBy;
      }

      if (validatedQuery.isConfidential !== undefined) {
        where.isConfidential = validatedQuery.isConfidential;
      }

      if (validatedQuery.tags && validatedQuery.tags.length > 0) {
        where.tags = {
          hasSome: validatedQuery.tags
        };
      }

      if (validatedQuery.search) {
        where.OR = [
          { title: { contains: validatedQuery.search, mode: 'insensitive' } },
          { description: { contains: validatedQuery.search, mode: 'insensitive' } },
          { location: { contains: validatedQuery.search, mode: 'insensitive' } }
        ];
      }

      // Get user's accessible cases for filtering
      const userCases = await this.getUserAccessibleCases(req.user.id, req.user.role);
      const accessibleCaseIds = userCases.map(c => c.id);

      if (!where.caseId) {
        where.caseId = { in: accessibleCaseIds };
      } else if (!accessibleCaseIds.includes(where.caseId)) {
        throw createError('Access denied to search evidence in this case', 403);
      }

      const [evidence, total] = await Promise.all([
        prisma.evidenceItem.findMany({
          where,
          include: {
            case: {
              select: {
                id: true,
                title: true,
                caseNumber: true
              }
            },
            collectedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            createdByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            [validatedQuery.sortBy]: validatedQuery.sortOrder
          },
          skip: validatedQuery.offset,
          take: validatedQuery.limit
        }),
        prisma.evidenceItem.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          evidence,
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

  async addToChainOfCustody(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;
      const validatedData = chainOfCustodySchema.parse(req.body);

      // Check if evidence exists and user has permission
      const evidence = await prisma.evidenceItem.findUnique({
        where: { id },
        include: {
          case: {
            include: {
              attorney: {
                select: { userId: true }
              }
            }
          }
        }
      });

      if (!evidence) {
        throw createError('Evidence not found', 404);
      }

      // Check access permissions
      const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to modify this evidence', 403);
      }

      // Add chain of custody entry
      const chainEntry = await prisma.evidenceChainOfCustody.create({
        data: {
          evidenceId: id,
          transferredTo: validatedData.transferredTo,
          transferredBy: req.user.id,
          transferDate: new Date(validatedData.transferDate),
          reason: validatedData.reason,
          notes: validatedData.notes
        },
        include: {
          transferredToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          transferredByUser: {
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
        data: chainEntry,
        message: 'Chain of custody entry added successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async getChainOfCustody(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;

      // Check if evidence exists and user has permission
      const evidence = await prisma.evidenceItem.findUnique({
        where: { id }
      });

      if (!evidence) {
        throw createError('Evidence not found', 404);
      }

      // Check access permissions
      const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to view this evidence', 403);
      }

      const chainOfCustody = await prisma.evidenceChainOfCustody.findMany({
        where: { evidenceId: id },
        orderBy: { transferDate: 'desc' },
        include: {
          transferredToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          transferredByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: chainOfCustody
      });

    } catch (error) {
      next(error);
    }
  }

  async downloadEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;

      const evidence = await prisma.evidenceItem.findUnique({
        where: { id }
      });

      if (!evidence) {
        throw createError('Evidence not found', 404);
      }

      if (!evidence.filePath) {
        throw createError('No file associated with this evidence', 404);
      }

      // Check access permissions
      const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
      if (!hasAccess) {
        throw createError('Access denied to download this evidence', 403);
      }

      // Download the file
      const downloadResult = await documentStorageService.downloadFile(evidence.filePath);

      if (!downloadResult.success || !downloadResult.buffer) {
        throw createError(downloadResult.error || 'Failed to download evidence file', 500);
      }

      // Set appropriate headers
      res.setHeader('Content-Type', evidence.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${evidence.title}.${evidence.filePath.split('.').pop()}"`);
      res.setHeader('Content-Length', downloadResult.buffer.length.toString());

      // Send the file
      res.send(downloadResult.buffer);

      // Log the download
      console.log(`Evidence ${evidence.id} downloaded by user ${req.user.id}`);

    } catch (error) {
      next(error);
    }
  }

  private async checkEvidenceAccess(evidence: any, userId: string, userRole: string): Promise<boolean> {
    // Admin can access all evidence
    if (userRole === 'ADMIN') {
      return true;
    }

    // Check if user has access to the case
    const caseAccess = await prisma.case.findFirst({
      where: {
        id: evidence.caseId,
        OR: [
          { attorney: { userId } },
          { client: { userId } }
        ]
      }
    });

    return !!caseAccess;
  }

  private async getUserAccessibleCases(userId: string, userRole: string): Promise<any[]> {
    if (userRole === 'ADMIN') {
      return await prisma.case.findMany({
        select: { id: true }
      });
    }

    return await prisma.case.findMany({
      where: {
        OR: [
          { attorney: { userId } },
          { client: { userId } }
        ]
      },
      select: { id: true }
    });
  }
}

export const evidenceController = new EvidenceController();