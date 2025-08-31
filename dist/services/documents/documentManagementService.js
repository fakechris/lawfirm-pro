"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentManagementService = exports.DocumentManagementService = void 0;
const client_1 = require("@prisma/client");
const storage_1 = require("../services/documents/storage");
const versionStorage_1 = require("../services/documents/versionStorage");
const evidenceStorage_1 = require("../services/documents/evidenceStorage");
const backupService_1 = require("../services/documents/backupService");
const optimizationService_1 = require("../services/documents/optimizationService");
class DocumentManagementService {
    constructor(config) {
        this.prisma = new client_1.PrismaClient();
        this.storageService = new storage_1.DocumentStorageService();
        this.versionService = new versionStorage_1.VersionControlStorageService();
        this.evidenceService = new evidenceStorage_1.EvidenceStorageService();
        this.backupService = new backupService_1.BackupService();
        this.optimizationService = new optimizationService_1.StorageOptimizationService();
        this.config = {
            storage: {
                basePath: config?.storage?.basePath || './storage',
                maxFileSize: config?.storage?.maxFileSize || 100 * 1024 * 1024,
                allowedMimeTypes: config?.storage?.allowedMimeTypes || [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg',
                    'image/png'
                ],
                allowedExtensions: config?.storage?.allowedExtensions || ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
            },
            versioning: {
                enabled: config?.versioning?.enabled ?? true,
                maxVersions: config?.versioning?.maxVersions || 50,
                autoCleanup: config?.versioning?.autoCleanup ?? true,
                retentionDays: config?.versioning?.retentionDays || 90
            },
            backup: {
                enabled: config?.backup?.enabled ?? true,
                schedule: config?.backup?.schedule || '0 2 * * *',
                compression: config?.backup?.compression ?? true,
                encryption: config?.backup?.encryption ?? false,
                retentionDays: config?.backup?.retentionDays || 30
            },
            optimization: {
                enabled: config?.optimization?.enabled ?? true,
                schedule: config?.optimization?.schedule || '0 3 * * 0',
                cleanupTempFiles: config?.optimization?.cleanupTempFiles ?? true,
                cleanupOldVersions: config?.optimization?.cleanupOldVersions ?? true,
                cleanupDuplicates: config?.optimization?.cleanupDuplicates ?? true,
                compressLargeFiles: config?.optimization?.compressLargeFiles ?? true
            },
            security: {
                encryptionEnabled: config?.security?.encryptionEnabled ?? false,
                virusScanEnabled: config?.security?.virusScanEnabled ?? false,
                checksumValidation: config?.security?.checksumValidation ?? true
            }
        };
        this.initializeServices();
    }
    async initializeServices() {
        if (this.config.backup.enabled) {
            await this.setupBackupSchedule();
        }
        if (this.config.optimization.enabled) {
            await this.setupOptimizationSchedule();
        }
    }
    async setupBackupSchedule() {
        try {
            const backupConfig = {
                enabled: true,
                schedule: this.config.backup.schedule,
                compression: this.config.backup.compression,
                encryption: this.config.backup.encryption,
                includeVersions: true,
                includeThumbnails: true,
                retention: this.config.backup.retentionDays,
                destination: {
                    type: 'local',
                    path: './storage/backups'
                },
                notifications: {
                    onSuccess: false,
                    onFailure: true
                }
            };
            await this.backupService.createBackupSchedule('Daily Document Backup', backupConfig);
        }
        catch (error) {
            console.error('Error setting up backup schedule:', error);
        }
    }
    async setupOptimizationSchedule() {
        try {
            const optimizationOptions = {
                cleanupTempFiles: this.config.optimization.cleanupTempFiles,
                cleanupOldVersions: this.config.optimization.cleanupOldVersions,
                cleanupDuplicates: this.config.optimization.cleanupDuplicates,
                compressLargeFiles: this.config.optimization.compressLargeFiles,
                maxAge: {
                    tempFiles: 24,
                    versions: this.config.versioning.retentionDays
                }
            };
            await this.optimizationService.scheduleOptimization(this.config.optimization.schedule, optimizationOptions);
        }
        catch (error) {
            console.error('Error setting up optimization schedule:', error);
        }
    }
    async uploadDocument(request) {
        try {
            if (!request.file || request.file.length === 0) {
                return {
                    success: false,
                    error: 'No file provided'
                };
            }
            if (request.file.length > this.config.storage.maxFileSize) {
                return {
                    success: false,
                    error: `File size exceeds maximum limit of ${this.config.storage.maxFileSize} bytes`
                };
            }
            if (!this.config.storage.allowedMimeTypes.includes(request.mimeType)) {
                return {
                    success: false,
                    error: `File type ${request.mimeType} is not allowed`
                };
            }
            const storageOptions = {
                filename: request.filename,
                mimeType: request.mimeType,
                category: 'documents',
                subcategory: 'original',
                generateChecksum: this.config.security.checksumValidation,
                generateThumbnail: request.generateThumbnail,
                metadata: {
                    caseId: request.caseId,
                    clientId: request.clientId,
                    category: request.category,
                    description: request.description,
                    tags: request.tags,
                    isConfidential: request.isConfidential,
                    uploadedBy: request.uploadedBy
                }
            };
            const storageResult = await this.storageService.uploadFile(request.file, request.filename, storageOptions);
            if (!storageResult.success) {
                return {
                    success: false,
                    error: storageResult.error || 'Failed to store file'
                };
            }
            const document = await this.prisma.document.create({
                data: {
                    filename: storageResult.filename,
                    originalName: request.filename,
                    path: storageResult.filePath,
                    size: request.file.length,
                    mimeType: request.mimeType,
                    caseId: request.caseId,
                    clientId: request.clientId,
                    uploadedById: request.uploadedBy,
                    category: request.category,
                    description: request.description,
                    tags: request.tags || [],
                    isConfidential: request.isConfidential || false,
                    checksum: storageResult.checksum,
                    thumbnailPath: storageResult.thumbnailPath,
                    metadata: storageResult.metadata || {},
                    status: 'ACTIVE'
                }
            });
            return {
                success: true,
                document,
                storageResult,
                warnings: storageResult.warnings
            };
        }
        catch (error) {
            console.error('Error uploading document:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getDocument(id) {
        try {
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
                    }
                }
            });
        }
        catch (error) {
            console.error('Error getting document:', error);
            return null;
        }
    }
    async searchDocuments(request) {
        try {
            const { query, caseId, clientId, category, tags, uploadedBy, dateFrom, dateTo, isConfidential, limit = 20, offset = 0 } = request;
            const where = { status: { not: 'DELETED' } };
            if (query) {
                where.OR = [
                    { originalName: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { extractedText: { contains: query, mode: 'insensitive' } }
                ];
            }
            if (caseId)
                where.caseId = caseId;
            if (clientId)
                where.clientId = clientId;
            if (category)
                where.category = category;
            if (uploadedBy)
                where.uploadedById = uploadedBy;
            if (isConfidential !== undefined)
                where.isConfidential = isConfidential;
            if (tags && tags.length > 0) {
                where.tags = { hasSome: tags };
            }
            if (dateFrom || dateTo) {
                where.createdAt = {};
                if (dateFrom)
                    where.createdAt.gte = dateFrom;
                if (dateTo)
                    where.createdAt.lte = dateTo;
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
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset
                }),
                this.prisma.document.count({ where })
            ]);
            const totalPages = Math.ceil(total / limit);
            return {
                data,
                total,
                page: Math.floor(offset / limit) + 1,
                limit,
                totalPages,
                filters: { query, caseId, clientId, category, tags, uploadedBy, dateFrom, dateTo, isConfidential }
            };
        }
        catch (error) {
            console.error('Error searching documents:', error);
            return {
                data: [],
                total: 0,
                page: 1,
                limit: 20,
                totalPages: 0,
                filters: {}
            };
        }
    }
    async updateDocument(id, updates) {
        try {
            return await this.prisma.document.update({
                where: { id },
                data: {
                    ...updates,
                    updatedAt: new Date()
                }
            });
        }
        catch (error) {
            console.error('Error updating document:', error);
            return null;
        }
    }
    async deleteDocument(id, permanent = false) {
        try {
            if (permanent) {
                const document = await this.prisma.document.findUnique({ where: { id } });
                if (document?.path) {
                    await this.storageService.deleteFile(document.path, true);
                }
                await this.prisma.document.delete({ where: { id } });
            }
            else {
                await this.prisma.document.update({
                    where: { id },
                    data: {
                        status: 'DELETED',
                        deletedAt: new Date()
                    }
                });
            }
            return true;
        }
        catch (error) {
            console.error('Error deleting document:', error);
            return false;
        }
    }
    async createDocumentVersion(request) {
        try {
            if (!this.config.versioning.enabled) {
                throw new Error('Versioning is not enabled');
            }
            const document = await this.prisma.document.findUnique({
                where: { id: request.documentId }
            });
            if (!document) {
                throw new Error('Document not found');
            }
            const versionOptions = {
                filename: request.filename,
                mimeType: request.mimeType,
                category: 'versions',
                versionNumber: document.version + 1,
                changeDescription: request.changeDescription,
                generateChecksum: this.config.security.checksumValidation,
                metadata: {
                    documentId: request.documentId,
                    createdBy: request.createdBy
                }
            };
            const versionResult = await this.versionService.uploadVersion(request.file, request.filename, versionOptions);
            if (!versionResult.success) {
                throw new Error(versionResult.error || 'Failed to store version');
            }
            const version = await this.prisma.documentVersion.create({
                data: {
                    documentId: request.documentId,
                    versionNumber: versionResult.versionNumber,
                    filePath: versionResult.filePath,
                    fileSize: request.file.length,
                    checksum: versionResult.checksum,
                    changeDescription: request.changeDescription,
                    createdBy: request.createdBy
                }
            });
            await this.prisma.document.update({
                where: { id: request.documentId },
                data: {
                    version: versionResult.versionNumber,
                    updatedAt: new Date()
                }
            });
            if (this.config.versioning.autoCleanup) {
                await this.cleanupOldVersions(request.documentId);
            }
            return version;
        }
        catch (error) {
            console.error('Error creating document version:', error);
            return null;
        }
    }
    async cleanupOldVersions(documentId) {
        try {
            const versions = await this.prisma.documentVersion.findMany({
                where: { documentId },
                orderBy: { versionNumber: 'desc' }
            });
            if (versions.length > this.config.versioning.maxVersions) {
                const versionsToDelete = versions.slice(this.config.versioning.maxVersions);
                for (const version of versionsToDelete) {
                    await this.prisma.documentVersion.delete({
                        where: { id: version.id }
                    });
                    if (version.filePath) {
                        await this.storageService.deleteFile(version.filePath);
                    }
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up old versions:', error);
        }
    }
    async createTemplate(request) {
        try {
            const storageResult = await this.storageService.uploadFile(request.file, request.filename, {
                filename: request.filename,
                mimeType: request.mimeType,
                category: 'templates',
                subcategory: 'active',
                generateChecksum: this.config.security.checksumValidation,
                metadata: {
                    name: request.name,
                    description: request.description,
                    category: request.category,
                    variables: request.variables,
                    isPublic: request.isPublic,
                    createdBy: request.createdBy
                }
            });
            if (!storageResult.success) {
                throw new Error(storageResult.error || 'Failed to store template');
            }
            const template = await this.prisma.documentTemplate.create({
                data: {
                    name: request.name,
                    description: request.description,
                    category: request.category,
                    filePath: storageResult.filePath,
                    fileSize: request.file.length,
                    mimeType: request.mimeType,
                    checksum: storageResult.checksum,
                    variableSchema: request.variables || [],
                    isPublic: request.isPublic || false,
                    createdBy: request.createdBy
                }
            });
            if (request.variables && request.variables.length > 0) {
                await this.prisma.templateVariable.createMany({
                    data: request.variables.map((variable, index) => ({
                        templateId: template.id,
                        name: variable.name,
                        type: variable.type,
                        description: variable.description,
                        defaultValue: variable.defaultValue,
                        required: variable.required,
                        order: index
                    }))
                });
            }
            return template;
        }
        catch (error) {
            console.error('Error creating template:', error);
            return null;
        }
    }
    async createEvidence(request) {
        try {
            const evidenceOptions = {
                title: request.title,
                description: request.description,
                type: request.type,
                caseId: request.caseId,
                collectedBy: request.collectedBy,
                generateChecksum: this.config.security.checksumValidation,
                metadata: {
                    originalFilename: request.filename,
                    tags: request.tags
                }
            };
            const evidenceResult = await this.evidenceService.uploadEvidence(request.file, request.filename, evidenceOptions);
            if (!evidenceResult.success) {
                throw new Error(evidenceResult.error || 'Failed to store evidence');
            }
            const evidence = await this.prisma.evidenceItem.create({
                data: {
                    title: request.title,
                    description: request.description,
                    caseId: request.caseId,
                    type: request.type,
                    filePath: evidenceResult.filePath,
                    fileSize: request.file.length,
                    mimeType: request.mimeType,
                    checksum: evidenceResult.checksum,
                    collectedBy: request.collectedBy,
                    tags: request.tags || [],
                    metadata: evidenceResult.metadata || {}
                }
            });
            return evidence;
        }
        catch (error) {
            console.error('Error creating evidence:', error);
            return null;
        }
    }
    async performBackup(config) {
        try {
            const backupConfig = {
                enabled: true,
                schedule: '0 2 * * *',
                compression: true,
                encryption: false,
                includeVersions: true,
                includeThumbnails: true,
                retention: 30,
                destination: {
                    type: 'local',
                    path: './storage/backups'
                },
                notifications: {
                    onSuccess: false,
                    onFailure: true
                },
                ...config
            };
            return await this.backupService.performBackup(backupConfig);
        }
        catch (error) {
            console.error('Error performing backup:', error);
            throw error;
        }
    }
    async restoreFromBackup(backupId, options) {
        try {
            return await this.backupService.restoreFromBackup(backupId, options);
        }
        catch (error) {
            console.error('Error restoring from backup:', error);
            throw error;
        }
    }
    async performOptimization(options) {
        try {
            const optimizationOptions = {
                cleanupTempFiles: this.config.optimization.cleanupTempFiles,
                cleanupOldVersions: this.config.optimization.cleanupOldVersions,
                cleanupDuplicates: this.config.optimization.cleanupDuplicates,
                compressLargeFiles: this.config.optimization.compressLargeFiles,
                maxAge: {
                    tempFiles: 24,
                    versions: this.config.versioning.retentionDays
                },
                ...options
            };
            return await this.optimizationService.performOptimization(optimizationOptions);
        }
        catch (error) {
            console.error('Error performing optimization:', error);
            throw error;
        }
    }
    async getStorageMetrics() {
        try {
            return await this.optimizationService.getStorageMetrics();
        }
        catch (error) {
            console.error('Error getting storage metrics:', error);
            throw error;
        }
    }
    async getBackupInfo(backupId) {
        try {
            return await this.backupService.getBackupInfo(backupId);
        }
        catch (error) {
            console.error('Error getting backup info:', error);
            throw error;
        }
    }
    async verifyEvidenceIntegrity(evidenceId) {
        try {
            return await this.evidenceService.verifyEvidenceIntegrity(evidenceId);
        }
        catch (error) {
            console.error('Error verifying evidence integrity:', error);
            throw error;
        }
    }
    async dispose() {
        await this.prisma.$disconnect();
    }
}
exports.DocumentManagementService = DocumentManagementService;
exports.documentManagementService = new DocumentManagementService();
//# sourceMappingURL=documentManagementService.js.map