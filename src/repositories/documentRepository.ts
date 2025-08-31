import { PrismaClient } from '@prisma/client';
import { 
  Document, 
  DocumentVersion, 
  DocumentWithDetails,
  DocumentUploadInput,
  DocumentUpdateInput,
  DocumentVersionInput
} from '../../types';
import { DocumentValidator } from '../../utils/validation';

export class DocumentRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: DocumentUploadInput & { path: string; checksum: string; uploadedBy: string }): Promise<Document> {
    return await this.prisma.document.create({
      data: {
        filename: data.filename,
        originalName: data.originalName,
        path: data.path,
        size: data.size,
        mimeType: data.mimeType,
        caseId: data.caseId,
        uploadedBy: data.uploadedBy,
        isConfidential: data.isConfidential,
        isTemplate: data.isTemplate,
        category: data.category,
        description: data.description,
        tags: data.tags,
        metadata: data.metadata,
        checksum: data.checksum
      }
    });
  }

  async findById(id: string): Promise<Document | null> {
    return await this.prisma.document.findUnique({
      where: { id },
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: 'desc' }
        }
      }
    });
  }

  async findMany(params: {
    caseId?: string;
    category?: string;
    status?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<DocumentWithDetails[]> {
    const { caseId, category, status, tags, limit = 20, offset = 0 } = params;

    const where: any = {};
    
    if (caseId) where.caseId = caseId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }

    return await this.prisma.document.findMany({
      where,
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async update(id: string, data: DocumentUpdateInput): Promise<Document> {
    return await this.prisma.document.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<Document> {
    return await this.prisma.document.update({
      where: { id },
      data: { status: 'DELETED' }
    });
  }

  async createVersion(data: DocumentVersionInput): Promise<DocumentVersion> {
    // Get the latest version number
    const latestVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId: data.documentId },
      orderBy: { versionNumber: 'desc' }
    });

    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    return await this.prisma.documentVersion.create({
      data: {
        documentId: data.documentId,
        versionNumber,
        filePath: data.filePath,
        fileSize: data.fileSize,
        checksum: data.checksum,
        changeDescription: data.changeDescription
      }
    });
  }

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    return await this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'desc' }
    });
  }

  async getVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    return await this.prisma.documentVersion.findUnique({
      where: {
        documentId_versionNumber: {
          documentId,
          versionNumber
        }
      }
    });
  }

  async findByChecksum(checksum: string): Promise<Document | null> {
    return await this.prisma.document.findFirst({
      where: { checksum }
    });
  }

  async getStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    recentUploads: number;
  }> {
    const [
      totalDocs,
      totalSize,
      categoryStats,
      statusStats,
      recentUploads
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
      this.prisma.document.count({
        where: {
          status: { not: 'DELETED' },
          uploadedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
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

    return {
      totalDocuments: totalDocs,
      totalSize: totalSize._sum.size || 0,
      byCategory,
      byStatus,
      recentUploads
    };
  }

  async search(params: {
    query: string;
    caseId?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<DocumentWithDetails[]> {
    const { query, caseId, category, tags, limit = 20, offset = 0 } = params;

    const where: any = {
      OR: [
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
          tags: {
            hasSome: [query]
          }
        }
      ]
    };

    if (caseId) where.caseId = caseId;
    if (category) where.category = category;
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }

    return await this.prisma.document.findMany({
      where,
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async getDocumentsByCase(caseId: string): Promise<DocumentWithDetails[]> {
    return await this.prisma.document.findMany({
      where: { caseId, status: { not: 'DELETED' } },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  async getDocumentsByUser(userId: string): Promise<DocumentWithDetails[]> {
    return await this.prisma.document.findMany({
      where: { uploadedBy: userId, status: { not: 'DELETED' } },
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }
}