import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { documentStorageService } from '../services/documents';
import { 
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
  TemplateGenerationInput,
  TemplateGenerationResult,
  DocumentTemplateWithDetails
} from '../models/documents';

const prisma = new PrismaClient();

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
  file: z.any().refine((file) => file !== undefined, 'Template file is required'),
  variableSchema: z.record(z.unknown()).optional().default({}),
  isPublic: z.boolean().optional().default(false)
});

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').optional(),
  description: z.string().optional(),
  category: z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
  variableSchema: z.record(z.unknown()).optional(),
  isPublic: z.boolean().optional()
});

const generateFromTemplateSchema = z.object({
  variables: z.record(z.unknown()),
  outputFilename: z.string().optional(),
  caseId: z.string().optional(),
  clientId: z.string().optional()
});

const templateQuerySchema = z.object({
  category: z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
  isPublic: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'category']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

export class TemplateController {
  
  async createTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      if (!req.file) {
        throw createError('Template file is required', 400);
      }

      const validatedData = createTemplateSchema.parse({
        ...req.body,
        file: req.file
      });

      // Validate file
      const validationResult = await documentStorageService.validateFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!validationResult.isValid) {
        throw createError(validationResult.error || 'File validation failed', 400);
      }

      // Store the template file
      const storageResult = await documentStorageService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        {
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          category: 'templates',
          subcategory: 'original',
          metadata: {
            uploadedBy: req.user.id,
            category: validatedData.category,
            isTemplate: true
          }
        }
      );

      if (!storageResult.success) {
        throw createError(storageResult.error || 'Failed to store template file', 500);
      }

      // Create template record
      const templateData: CreateDocumentTemplateInput = {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        filePath: storageResult.filePath,
        variableSchema: validatedData.variableSchema,
        isPublic: validatedData.isPublic,
        createdBy: req.user.id
      };

      const template = await prisma.documentTemplate.create({
        data: templateData,
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          _count: {
            select: {
              generatedDocuments: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async getTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const validatedQuery = templateQuerySchema.parse(req.query);

      // Build where clause
      const where: any = {};
      
      if (validatedQuery.category) {
        where.category = validatedQuery.category;
      }
      
      if (validatedQuery.isPublic !== undefined) {
        where.isPublic = validatedQuery.isPublic;
      } else {
        // If not specified, show public templates and user's private templates
        where.OR = [
          { isPublic: true },
          { createdBy: req.user.id }
        ];
      }

      if (validatedQuery.search) {
        where.OR = [
          { name: { contains: validatedQuery.search, mode: 'insensitive' } },
          { description: { contains: validatedQuery.search, mode: 'insensitive' } }
        ];
      }

      const [templates, total] = await Promise.all([
        prisma.documentTemplate.findMany({
          where,
          include: {
            createdByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            _count: {
              select: {
                generatedDocuments: true
              }
            }
          },
          orderBy: {
            [validatedQuery.sortBy]: validatedQuery.sortOrder
          },
          skip: validatedQuery.offset,
          take: validatedQuery.limit
        }),
        prisma.documentTemplate.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          templates,
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

  async getTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;

      const template = await prisma.documentTemplate.findUnique({
        where: { id },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          generatedDocuments: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              createdAt: true,
              case: {
                select: {
                  id: true,
                  title: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          _count: {
            select: {
              generatedDocuments: true
            }
          }
        }
      });

      if (!template) {
        throw createError('Template not found', 404);
      }

      // Check access permissions
      if (!template.isPublic && template.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Access denied to this template', 403);
      }

      res.json({
        success: true,
        data: template
      });

    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;
      const validatedData = updateTemplateSchema.parse(req.body);

      // Check if template exists and user has permission
      const existingTemplate = await prisma.documentTemplate.findUnique({
        where: { id },
        include: {
          createdByUser: {
            select: { id: true }
          }
        }
      });

      if (!existingTemplate) {
        throw createError('Template not found', 404);
      }

      // Only template creator or admin can update
      if (existingTemplate.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Access denied to update this template', 403);
      }

      const updatedTemplate = await prisma.documentTemplate.update({
        where: { id },
        data: validatedData,
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          _count: {
            select: {
              generatedDocuments: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: updatedTemplate,
        message: 'Template updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;

      // Check if template exists and user has permission
      const existingTemplate = await prisma.documentTemplate.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              generatedDocuments: true
            }
          }
        }
      });

      if (!existingTemplate) {
        throw createError('Template not found', 404);
      }

      // Only template creator or admin can delete
      if (existingTemplate.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Access denied to delete this template', 403);
      }

      // Check if template has generated documents
      if (existingTemplate._count.generatedDocuments > 0) {
        throw createError('Cannot delete template that has been used to generate documents', 400);
      }

      // Delete template file from storage
      await documentStorageService.deleteFile(existingTemplate.filePath);

      // Delete template record
      await prisma.documentTemplate.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async generateFromTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;
      const validatedData = generateFromTemplateSchema.parse(req.body);

      // Check if template exists and user has access
      const template = await prisma.documentTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        throw createError('Template not found', 404);
      }

      // Check access permissions
      if (!template.isPublic && template.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Access denied to this template', 403);
      }

      // Validate variables against schema
      const validationErrors: string[] = [];
      const schema = template.variableSchema as Record<string, any>;
      
      for (const [key, config] of Object.entries(schema)) {
        if (config.required && validatedData.variables[key] === undefined) {
          validationErrors.push(`Required variable '${key}' is missing`);
        }
      }

      if (validationErrors.length > 0) {
        throw createError(`Variable validation failed: ${validationErrors.join(', ')}`, 400);
      }

      // Generate document from template
      const generationResult: TemplateGenerationResult = await this.generateDocumentFromTemplate(
        template,
        validatedData.variables,
        validatedData.outputFilename,
        req.user.id,
        validatedData.caseId,
        validatedData.clientId
      );

      if (!generationResult.success) {
        throw createError(generationResult.errors?.join(', ') || 'Failed to generate document', 500);
      }

      res.status(201).json({
        success: true,
        data: {
          documentId: generationResult.documentId,
          filename: generationResult.filename,
          message: 'Document generated successfully from template'
        }
      });

    } catch (error) {
      next(error);
    }
  }

  private async generateDocumentFromTemplate(
    template: any,
    variables: Record<string, unknown>,
    outputFilename?: string,
    uploadedById?: string,
    caseId?: string,
    clientId?: string
  ): Promise<TemplateGenerationResult> {
    try {
      // In a real implementation, this would use document processing libraries
      // to replace variables in the template and generate a new document
      // For now, we'll create a simple implementation
      
      const templateContent = await documentStorageService.readFile(template.filePath);
      
      // Replace variables in template content (simplified implementation)
      let processedContent = templateContent.toString();
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), String(value));
      }

      // Generate output filename
      const filename = outputFilename || `generated_${template.name}_${Date.now()}.docx`;
      
      // Store the generated document
      const storageResult = await documentStorageService.uploadFile(
        Buffer.from(processedContent),
        filename,
        {
          filename,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          category: 'documents',
          subcategory: 'generated',
          metadata: {
            uploadedBy: uploadedById,
            caseId,
            clientId,
            templateId: template.id,
            generatedFrom: template.name
          }
        }
      );

      if (!storageResult.success) {
        return {
          success: false,
          errors: [storageResult.error || 'Failed to store generated document']
        };
      }

      // Create document record
      const document = await prisma.document.create({
        data: {
          filename: storageResult.filename,
          originalName: filename,
          path: storageResult.filePath,
          size: storageResult.size,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          type: 'GENERATED',
          caseId,
          clientId,
          uploadedBy: uploadedById || '',
          category: template.category,
          description: `Generated from template: ${template.name}`,
          isTemplate: false,
          checksum: await documentStorageService.calculateFileHash(Buffer.from(processedContent))
        }
      });

      return {
        success: true,
        documentId: document.id,
        filePath: storageResult.filePath,
        filename: storageResult.filename
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  async downloadTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { id } = req.params;

      const template = await prisma.documentTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        throw createError('Template not found', 404);
      }

      // Check access permissions
      if (!template.isPublic && template.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        throw createError('Access denied to this template', 403);
      }

      // Download the template file
      const downloadResult = await documentStorageService.downloadFile(template.filePath);

      if (!downloadResult.success || !downloadResult.buffer) {
        throw createError(downloadResult.error || 'Failed to download template', 500);
      }

      // Set appropriate headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${template.name}.docx"`);
      res.setHeader('Content-Length', downloadResult.buffer.length.toString());

      // Send the file
      res.send(downloadResult.buffer);

    } catch (error) {
      next(error);
    }
  }
}

export const templateController = new TemplateController();