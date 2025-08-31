"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentRepository = void 0;
class DocumentRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
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
    async findById(id) {
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
    async findMany(params) {
        const { caseId, category, status, tags, limit = 20, offset = 0 } = params;
        const where = {};
        if (caseId)
            where.caseId = caseId;
        if (category)
            where.category = category;
        if (status)
            where.status = status;
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
    async update(id, data) {
        return await this.prisma.document.update({
            where: { id },
            data
        });
    }
    async delete(id) {
        return await this.prisma.document.update({
            where: { id },
            data: { status: 'DELETED' }
        });
    }
    async createVersion(data) {
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
    async getVersions(documentId) {
        return await this.prisma.documentVersion.findMany({
            where: { documentId },
            orderBy: { versionNumber: 'desc' }
        });
    }
    async getVersion(documentId, versionNumber) {
        return await this.prisma.documentVersion.findUnique({
            where: {
                documentId_versionNumber: {
                    documentId,
                    versionNumber
                }
            }
        });
    }
    async findByChecksum(checksum) {
        return await this.prisma.document.findFirst({
            where: { checksum }
        });
    }
    async getStats() {
        const [totalDocs, totalSize, categoryStats, statusStats, recentUploads] = await Promise.all([
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
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);
        const byCategory = categoryStats.reduce((acc, stat) => {
            acc[stat.category] = stat._count.category;
            return acc;
        }, {});
        const byStatus = statusStats.reduce((acc, stat) => {
            acc[stat.status] = stat._count.status;
            return acc;
        }, {});
        return {
            totalDocuments: totalDocs,
            totalSize: totalSize._sum.size || 0,
            byCategory,
            byStatus,
            recentUploads
        };
    }
    async search(params) {
        const { query, caseId, category, tags, limit = 20, offset = 0 } = params;
        const where = {
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
        if (caseId)
            where.caseId = caseId;
        if (category)
            where.category = category;
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
    async getDocumentsByCase(caseId) {
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
    async getDocumentsByUser(userId) {
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
exports.DocumentRepository = DocumentRepository;
//# sourceMappingURL=documentRepository.js.map