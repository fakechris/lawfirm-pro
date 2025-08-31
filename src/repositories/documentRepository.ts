import { PrismaClient } from '@prisma/client';
import { 
  Document, 
  DocumentVersion, 
  DocumentTemplate,
  EvidenceItem,
  SearchIndex,
  DocumentWithDetails,
  DocumentVersionWithDetails,
  DocumentTemplateWithDetails,
  EvidenceItemWithDetails,
  DocumentUploadInput,
  DocumentUpdateInput,
  DocumentVersionInput,
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
  CreateEvidenceItemInput,
  UpdateEvidenceItemInput,
  DocumentSearchOptions,
  DocumentListResult,
  DocumentOperationResult
} from '../../models/documents';
import { DOCUMENT_ERROR_CODES, DOCUMENT_STATUSES } from '../../models/documents/models';

export class DocumentRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Core Document Operations
  async create(data: DocumentUploadInput & { path: string; checksum: string; uploadedBy: string }): Promise<Document> {
    return await this.prisma.document.create({
      data: {
        filename: data.filename,
        originalName: data.originalName,
        path: data.path,
        size: data.size,
        mimeType: data.mimeType,
        caseId: data.caseId,
        clientId: data.clientId,
        uploadedBy: data.uploadedBy,
        isConfidential: data.isConfidential || false,
        isTemplate: data.isTemplate || false,
        category: data.category,
        description: data.description,
        tags: data.tags || [],
        status: data.status || 'ACTIVE',
        metadata: data.metadata || {},
        checksum: data.checksum,
        version: 1,
        isLatest: true
      }
    });
  }

  async findById(id: string): Promise<DocumentWithDetails | null> {
    return await this.prisma.document.findUnique({
      where: { id },
      include: {
        case: true,
        client: true,
        uploadedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            createdByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        template: true,
        workflow: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
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
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        shares: {
          include: {
            sharedWithUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        approvals: {
          include: {
            requestedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            approvedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            versions: true,
            comments: true,
            shares: true
          }
        }
      }
    }) as DocumentWithDetails;
  }

  async findMany(params: {
    caseId?: string;
    clientId?: string;
    category?: string;
    status?: string;
    tags?: string[];
    uploadedBy?: string;
    isConfidential?: boolean;
    isTemplate?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: {
      field: string;
      order: 'asc' | 'desc';
    };
  }): Promise<DocumentListResult<DocumentWithDetails>> {
    const { 
      caseId, 
      clientId, 
      category, 
      status, 
      tags, 
      uploadedBy, 
      isConfidential, 
      isTemplate, 
      limit = 20, 
      offset = 0,
      orderBy = { field: 'uploadedAt', order: 'desc' }
    } = params;

    const where: any = { status: { not: 'DELETED' } };
    
    if (caseId) where.caseId = caseId;
    if (clientId) where.clientId = clientId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (uploadedBy) where.uploadedBy = uploadedBy;
    if (isConfidential !== undefined) where.isConfidential = isConfidential;
    if (isTemplate !== undefined) where.isTemplate = isTemplate;
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          case: true,
          client: true,
          uploadedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              createdByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              versions: true,
              comments: true,
              shares: true
            }
          }
        },
        orderBy: { [orderBy.field]: orderBy.order },
        take: limit,
        skip: offset
      }),
      this.prisma.document.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as DocumentWithDetails[],
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages,
      filters: { caseId, clientId, category, status, tags, uploadedBy, isConfidential, isTemplate },
      sort: orderBy
    };
  }

  async update(id: string, data: DocumentUpdateInput): Promise<Document> {
    return await this.prisma.document.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async delete(id: string, permanent: boolean = false): Promise<Document> {
    if (permanent) {
      return await this.prisma.document.delete({
        where: { id }
      });
    } else {
      return await this.prisma.document.update({
        where: { id },
        data: { 
          status: 'DELETED',
          deletedAt: new Date()
        }
      });
    }
  }

  // Document Version Operations
  async createVersion(data: DocumentVersionInput & { createdBy: string }): Promise<DocumentVersionWithDetails> {
    // Get the latest version number
    const latestVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId: data.documentId },
      orderBy: { versionNumber: 'desc' }
    });

    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const version = await this.prisma.documentVersion.create({
      data: {
        documentId: data.documentId,
        versionNumber,
        filePath: data.filePath,
        fileSize: data.fileSize,
        checksum: data.checksum,
        changeDescription: data.changeDescription || `Version ${versionNumber}`,
        createdBy: data.createdBy,
        isLatest: true
      },
      include: {
        document: true,
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

    // Update previous versions to not be latest
    if (latestVersion) {
      await this.prisma.documentVersion.update({
        where: { id: latestVersion.id },
        data: { isLatest: false }
      });
    }

    // Update document version info
    await this.prisma.document.update({
      where: { id: data.documentId },
      data: {
        version: versionNumber,
        updatedAt: new Date()
      }
    });

    return version as DocumentVersionWithDetails;
  }

  async getVersions(documentId: string, options?: {
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<DocumentVersionWithDetails[]> {
    const where: any = { documentId };
    if (!options?.includeDeleted) {
      where.isDeleted = false;
    }

    return await this.prisma.documentVersion.findMany({
      where,
      include: {
        document: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { versionNumber: 'desc' },
      take: options?.limit,
      skip: options?.offset
    }) as DocumentVersionWithDetails[];
  }

  async getVersion(documentId: string, versionNumber: number): Promise<DocumentVersionWithDetails | null> {
    return await this.prisma.documentVersion.findUnique({
      where: {
        documentId_versionNumber: {
          documentId,
          versionNumber
        }
      },
      include: {
        document: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }) as DocumentVersionWithDetails;
  }

  async getLatestVersion(documentId: string): Promise<DocumentVersionWithDetails | null> {
    return await this.prisma.documentVersion.findFirst({
      where: { documentId, isLatest: true, isDeleted: false },
      include: {
        document: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { versionNumber: 'desc' }
    }) as DocumentVersionWithDetails;
  }

  // Document Template Operations
  async createTemplate(data: CreateDocumentTemplateInput & { createdBy: string }): Promise<DocumentTemplateWithDetails> {
    return await this.prisma.documentTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        filePath: data.filePath,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        checksum: data.checksum,
        variables: data.variables || [],
        tags: data.tags || [],
        isPublic: data.isPublic || false,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy,
        metadata: data.metadata || {}
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }) as DocumentTemplateWithDetails;
  }

  async findTemplates(params: {
    category?: string;
    isActive?: boolean;
    isPublic?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<DocumentTemplateWithDetails[]> {
    const { category, isActive, isPublic, tags, limit = 20, offset = 0 } = params;

    const where: any = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;
    if (isPublic !== undefined) where.isPublic = isPublic;
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }

    return await this.prisma.documentTemplate.findMany({
      where,
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset
    }) as DocumentTemplateWithDetails[];
  }

  async updateTemplate(id: string, data: UpdateDocumentTemplateInput): Promise<DocumentTemplateWithDetails> {
    return await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }) as DocumentTemplateWithDetails;
  }

  async deleteTemplate(id: string): Promise<DocumentTemplateWithDetails> {
    return await this.prisma.documentTemplate.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }) as DocumentTemplateWithDetails;
  }

  // Evidence Management Operations
  async createEvidence(data: CreateEvidenceItemInput & { collectedBy: string }): Promise<EvidenceItemWithDetails> {
    return await this.prisma.evidenceItem.create({
      data: {
        title: data.title,
        description: data.description,
        caseId: data.caseId,
        type: data.type,
        filePath: data.filePath,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        checksum: data.checksum,
        collectedBy: data.collectedBy,
        collectedAt: data.collectedAt || new Date(),
        location: data.location,
        chainOfCustody: data.chainOfCustody || [],
        tags: data.tags || [],
        status: data.status || 'ACTIVE',
        metadata: data.metadata || {}
      },
      include: {
        case: true,
        collectedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }) as EvidenceItemWithDetails;
  }

  async findEvidence(params: {
    caseId?: string;
    type?: string;
    status?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<EvidenceItemWithDetails[]> {
    const { caseId, type, status, tags, limit = 20, offset = 0 } = params;

    const where: any = {};
    if (caseId) where.caseId = caseId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }

    return await this.prisma.evidenceItem.findMany({
      where,
      include: {
        case: true,
        collectedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { collectedAt: 'desc' },
      take: limit,
      skip: offset
    }) as EvidenceItemWithDetails[];
  }

  async updateEvidence(id: string, data: UpdateEvidenceItemInput): Promise<EvidenceItemWithDetails> {
    return await this.prisma.evidenceItem.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        case: true,
        collectedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }) as EvidenceItemWithDetails;
  }

  async addToEvidenceChain(evidenceId: string, custodyEntry: {
    transferredTo: string;
    transferredBy: string;
    transferDate: Date;
    reason: string;
    notes?: string;
  }): Promise<EvidenceItemWithDetails> {
    const evidence = await this.prisma.evidenceItem.findUnique({
      where: { id: evidenceId }
    });

    if (!evidence) {
      throw new Error('Evidence item not found');
    }

    const updatedChain = [
      ...(evidence.chainOfCustody as any[] || []),
      custodyEntry
    ];

    return await this.prisma.evidenceItem.update({
      where: { id: evidenceId },
      data: {
        chainOfCustody: updatedChain as any,
        updatedAt: new Date()
      },
      include: {
        case: true,
        collectedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }) as EvidenceItemWithDetails;
  }

  // Search and Statistics Operations
  async searchDocuments(params: DocumentSearchOptions): Promise<DocumentListResult<DocumentWithDetails>> {
    const {
      query,
      caseId,
      clientId,
      category,
      status,
      tags,
      uploadedBy,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0
    } = params;

    const where: any = { status: { not: 'DELETED' } };

    // Build search conditions
    if (query) {
      where.OR = [
        {
          originalName: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          extractedText: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (caseId) where.caseId = caseId;
    if (clientId) where.clientId = clientId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (uploadedBy) where.uploadedBy = uploadedBy;
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }

    if (dateFrom || dateTo) {
      where.uploadedAt = {};
      if (dateFrom) where.uploadedAt.gte = dateFrom;
      if (dateTo) where.uploadedAt.lte = dateTo;
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          case: true,
          client: true,
          uploadedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              createdByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              versions: true,
              comments: true,
              shares: true
            }
          }
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.document.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as DocumentWithDetails[],
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages,
      filters: { query, caseId, clientId, category, status, tags, uploadedBy, dateFrom, dateTo },
      sort: { field: 'uploadedAt', order: 'desc' }
    };
  }

  async getDocumentStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byMimeType: Record<string, number>;
    recentUploads: number;
    processingStats: {
      total: number;
      processed: number;
      failed: number;
      pending: number;
    };
  }> {
    const [
      totalDocs,
      sizeStats,
      categoryStats,
      statusStats,
      mimeTypeStats,
      recentUploads,
      processingStats
    ] = await Promise.all([
      this.prisma.document.count({
        where: { status: { not: 'DELETED' } }
      }),
      this.prisma.document.aggregate({
        where: { status: { not: 'DELETED' } },
        _sum: { size: true }
      }),
      this.prisma.document.groupBy({
        by: ['category'],
        where: { status: { not: 'DELETED' } },
        _count: { category: true }
      }),
      this.prisma.document.groupBy({
        by: ['status'],
        where: { status: { not: 'DELETED' } },
        _count: { status: true }
      }),
      this.prisma.document.groupBy({
        by: ['mimeType'],
        where: { status: { not: 'DELETED' } },
        _count: { mimeType: true }
      }),
      this.prisma.document.count({
        where: {
          status: { not: 'DELETED' },
          uploadedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      this.prisma.document.groupBy({
        by: ['processingStatus'],
        _count: { processingStatus: true }
      })
    ]);

    const byCategory = categoryStats.reduce((acc, stat) => {
      acc[stat.category] = stat._count.category;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = statusStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);

    const byMimeType = mimeTypeStats.reduce((acc, stat) => {
      acc[stat.mimeType] = stat._count.mimeType;
      return acc;
    }, {} as Record<string, number>);

    const processingStatsData = processingStats.reduce((acc, stat) => {
      acc[stat.processingStatus || 'UNKNOWN'] = stat._count.processingStatus;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalDocuments: totalDocs,
      totalSize: sizeStats._sum.size || 0,
      byCategory,
      byStatus,
      byMimeType,
      recentUploads,
      processingStats: {
        total: Object.values(processingStatsData).reduce((sum, count) => sum + count, 0),
        processed: processingStatsData['PROCESSED'] || 0,
        failed: processingStatsData['FAILED'] || 0,
        pending: processingStatsData['PENDING'] || 0
      }
    };
  }

  async getUserDocuments(userId: string, params: {
    limit?: number;
    offset?: number;
    status?: string;
  } = {}): Promise<DocumentWithDetails[]> {
    const { limit = 20, offset = 0, status } = params;

    const where: any = { 
      OR: [
        { uploadedBy: userId },
        { shares: { some: { sharedWith: userId } } }
      ],
      status: { not: 'DELETED' }
    };

    if (status) where.status = status;

    return await this.prisma.document.findMany({
      where,
      include: {
        case: true,
        client: true,
        uploadedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true,
            comments: true,
            shares: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      skip: offset
    }) as DocumentWithDetails[];
  }

  async findByChecksum(checksum: string): Promise<Document | null> {
    return await this.prisma.document.findFirst({
      where: { checksum, status: { not: 'DELETED' } }
    });
  }

  // Utility Methods
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.document.count({
      where: { id, status: { not: 'DELETED' } }
    });
    return count > 0;
  }

  async isAccessible(documentId: string, userId: string, userRole: string): Promise<boolean> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        uploadedBy: true,
        isConfidential: true,
        caseId: true,
        shares: {
          where: { sharedWith: userId },
          select: { id: true }
        }
      }
    });

    if (!document) return false;

    // Owner always has access
    if (document.uploadedBy === userId) return true;

    // Check if shared with user
    if (document.shares.length > 0) return true;

    // Admin/Manager access to non-confidential documents
    if (['ADMIN', 'MANAGER'].includes(userRole) && !document.isConfidential) return true;

    return false;
  }

  async getDocumentsByCase(caseId: string): Promise<DocumentWithDetails[]> {
    return await this.prisma.document.findMany({
      where: { caseId, status: { not: 'DELETED' } },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            createdByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            versions: true,
            comments: true,
            shares: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    }) as DocumentWithDetails[];
  }

  async getDocumentsByClient(clientId: string): Promise<DocumentWithDetails[]> {
    return await this.prisma.document.findMany({
      where: { clientId, status: { not: 'DELETED' } },
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true,
            comments: true,
            shares: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    }) as DocumentWithDetails[];
  }
}
