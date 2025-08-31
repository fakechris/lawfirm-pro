"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../utils/database");
const websocket_1 = require("./websocket");
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let DocumentService = class DocumentService {
    constructor(db, wsService) {
        this.db = db;
        this.wsService = wsService;
    }
    async uploadDocument(file, caseId, uploadedBy, isConfidential = false) {
        await this.verifyCaseAccess(caseId, uploadedBy);
        this.validateFile(file);
        const filename = this.generateUniqueFilename(file.originalname);
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const filePath = path.join(uploadDir, filename);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(filePath, file.buffer);
        const document = await this.db.client.document.create({
            data: {
                filename,
                originalName: file.originalname,
                path: filePath,
                size: file.size,
                mimeType: file.mimetype,
                caseId,
                uploadedBy,
                isConfidential,
            },
            include: {
                case: true,
            },
        });
        const documentResponse = this.transformDocumentResponse(document);
        this.wsService.broadcastDocument(caseId, documentResponse);
        return documentResponse;
    }
    async getDocumentsByCaseId(caseId, userId) {
        await this.verifyCaseAccess(caseId, userId);
        const documents = await this.db.client.document.findMany({
            where: { caseId },
            include: {
                case: true,
            },
            orderBy: { uploadedAt: 'desc' },
        });
        return documents.map(doc => this.transformDocumentResponse(doc));
    }
    async getDocumentById(documentId, userId) {
        const document = await this.db.client.document.findUnique({
            where: { id: documentId },
            include: {
                case: true,
            },
        });
        if (!document) {
            throw new Error('Document not found');
        }
        await this.verifyCaseAccess(document.caseId, userId);
        return this.transformDocumentResponse(document);
    }
    async downloadDocument(documentId, userId) {
        const document = await this.db.client.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new Error('Document not found');
        }
        await this.verifyCaseAccess(document.caseId, userId);
        if (!fs.existsSync(document.path)) {
            throw new Error('File not found on server');
        }
        return {
            filePath: document.path,
            filename: document.originalName,
            mimeType: document.mimeType,
        };
    }
    async updateDocument(documentId, updates, userId) {
        const document = await this.db.client.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new Error('Document not found');
        }
        await this.verifyCaseAccess(document.caseId, userId);
        if (document.uploadedBy !== userId) {
            throw new Error('Only the uploader can update document settings');
        }
        const updatedDocument = await this.db.client.document.update({
            where: { id: documentId },
            data: updates,
            include: {
                case: true,
            },
        });
        return this.transformDocumentResponse(updatedDocument);
    }
    async deleteDocument(documentId, userId) {
        const document = await this.db.client.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new Error('Document not found');
        }
        await this.verifyCaseAccess(document.caseId, userId);
        if (document.uploadedBy !== userId) {
            throw new Error('Only the uploader can delete the document');
        }
        if (fs.existsSync(document.path)) {
            fs.unlinkSync(document.path);
        }
        await this.db.client.document.delete({
            where: { id: documentId },
        });
    }
    async grantDocumentAccess(documentId, userId, grantedBy) {
        const document = await this.db.client.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new Error('Document not found');
        }
        await this.verifyCaseAccess(document.caseId, grantedBy);
        const targetUser = await this.db.client.user.findUnique({
            where: { id: userId },
        });
        if (!targetUser) {
            throw new Error('Target user not found');
        }
        const existingAccess = await this.db.client.documentAccess.findUnique({
            where: {
                documentId_userId: {
                    documentId,
                    userId,
                },
            },
        });
        if (existingAccess) {
            return;
        }
        await this.db.client.documentAccess.create({
            data: {
                documentId,
                userId,
                grantedAt: new Date(),
            },
        });
    }
    async revokeDocumentAccess(documentId, userId, revokedBy) {
        const document = await this.db.client.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new Error('Document not found');
        }
        await this.verifyCaseAccess(document.caseId, revokedBy);
        await this.db.client.documentAccess.delete({
            where: {
                documentId_userId: {
                    documentId,
                    userId,
                },
            },
        });
    }
    async getDocumentAccess(documentId, userId) {
        const document = await this.db.client.document.findUnique({
            where: { id: documentId },
        });
        if (!document) {
            throw new Error('Document not found');
        }
        await this.verifyCaseAccess(document.caseId, userId);
        const accessList = await this.db.client.documentAccess.findMany({
            where: { documentId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
        });
        return accessList.map(access => ({
            id: access.id,
            userId: access.userId,
            user: access.user,
            grantedAt: access.grantedAt,
            expiresAt: access.expiresAt,
        }));
    }
    async searchDocuments(userId, query, caseId) {
        const where = {
            AND: [
                {
                    OR: [
                        { case: { clientId: userId } },
                        { case: { attorneyId: userId } },
                        { uploadedBy: userId },
                    ],
                },
                {
                    OR: [
                        { originalName: { contains: query, mode: 'insensitive' } },
                        { filename: { contains: query, mode: 'insensitive' } },
                    ],
                },
            ],
        };
        if (caseId) {
            where.AND.push({ caseId });
        }
        const documents = await this.db.client.document.findMany({
            where,
            include: {
                case: true,
            },
            orderBy: { uploadedAt: 'desc' },
            take: 100,
        });
        return documents.map(doc => this.transformDocumentResponse(doc));
    }
    async getDocumentStats(userId) {
        const where = {
            OR: [
                { case: { clientId: userId } },
                { case: { attorneyId: userId } },
                { uploadedBy: userId },
            ],
        };
        const [documents, total, totalSizeResult] = await Promise.all([
            this.db.client.document.findMany({
                where,
                include: {
                    case: true,
                },
                orderBy: { uploadedAt: 'desc' },
                take: 10,
            }),
            this.db.client.document.count({ where }),
            this.db.client.document.aggregate({
                where,
                _sum: { size: true },
            }),
        ]);
        const byType = {};
        documents.forEach(doc => {
            const type = doc.mimetype.split('/')[0] || 'other';
            byType[type] = (byType[type] || 0) + 1;
        });
        return {
            total,
            totalSize: totalSizeResult._sum.size || 0,
            byType,
            recentUploads: documents.map(doc => this.transformDocumentResponse(doc)),
        };
    }
    validateFile(file) {
        const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760');
        if (file.size > maxSize) {
            throw new Error(`File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`);
        }
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/gif',
            'text/plain',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new Error('File type not allowed');
        }
    }
    generateUniqueFilename(originalName) {
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const sanitizedName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
        return `${sanitizedName}_${timestamp}_${random}${ext}`;
    }
    async verifyCaseAccess(caseId, userId) {
        const user = await this.db.client.user.findUnique({
            where: { id: userId },
            include: {
                clientProfile: true,
                attorneyProfile: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        let hasAccess = false;
        if (user.role === client_1.UserRole.CLIENT && user.clientProfile) {
            const caseAccess = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    clientId: user.clientProfile.id,
                },
            });
            hasAccess = !!caseAccess;
        }
        else if (user.role === client_1.UserRole.ATTORNEY && user.attorneyProfile) {
            const caseAccess = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    attorneyId: user.attorneyProfile.id,
                },
            });
            hasAccess = !!caseAccess;
        }
        if (!hasAccess) {
            throw new Error('Access denied to this case');
        }
    }
    transformDocumentResponse(document) {
        return {
            id: document.id,
            filename: document.filename,
            originalName: document.originalName,
            size: document.size,
            mimeType: document.mimeType,
            caseId: document.caseId,
            uploadedBy: document.uploadedBy,
            uploadedAt: document.uploadedAt,
            isConfidential: document.isConfidential,
        };
    }
};
exports.DocumentService = DocumentService;
exports.DocumentService = DocumentService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __param(1, (0, tsyringe_1.inject)(websocket_1.WebSocketService)),
    __metadata("design:paramtypes", [database_1.Database,
        websocket_1.WebSocketService])
], DocumentService);
//# sourceMappingURL=document.js.map