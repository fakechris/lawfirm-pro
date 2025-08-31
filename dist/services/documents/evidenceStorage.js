"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceStorageService = exports.EvidenceStorageService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const util_1 = require("util");
const stream_1 = require("stream");
const fs_1 = require("fs");
const config_1 = require("../config");
const storage_1 = require("../services/documents/storage");
const pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
class EvidenceStorageService {
    constructor() {
        this.basePath = config_1.config.storage.basePath;
        this.maxFileSize = config_1.config.storage.maxFileSize;
        this.allowedMimeTypes = config_1.config.storage.allowedMimeTypes;
        this.baseStorageService = new storage_1.DocumentStorageService();
    }
    async ensureDirectoryExists(dirPath) {
        try {
            await promises_1.default.access(dirPath);
        }
        catch {
            await promises_1.default.mkdir(dirPath, { recursive: true });
        }
    }
    generateEvidenceFilename(title, caseId, type) {
        const sanitizedTitle = title
            .replace(/[^\w\s.-]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase();
        const timestamp = Date.now();
        const random = (0, crypto_1.randomBytes)(4).toString('hex');
        const ext = this.getFileExtensionFromType(type);
        return `${caseId}_${sanitizedTitle}_${timestamp}_${random}${ext}`;
    }
    getFileExtensionFromType(type) {
        const typeExtensions = {
            'PHYSICAL': '.pdf',
            'DIGITAL': '.bin',
            'DOCUMENT': '.pdf',
            'PHOTO': '.jpg',
            'VIDEO': '.mp4',
            'AUDIO': '.mp3',
            'TESTIMONY': '.pdf',
            'EXPERT_REPORT': '.pdf'
        };
        return typeExtensions[type] || '.bin';
    }
    getStoragePath(subcategory = 'original') {
        const categoryPaths = config_1.config.storage.paths.evidence;
        const subcategoryPath = categoryPaths[subcategory];
        if (!subcategoryPath) {
            throw new Error(`Invalid evidence subcategory: ${subcategory}`);
        }
        return path_1.default.join(this.basePath, subcategoryPath);
    }
    async calculateFileHash(buffer, algorithm = 'sha256') {
        return (0, crypto_1.createHash)(algorithm).update(buffer).digest('hex');
    }
    async getFileChecksum(filePath) {
        const hash = (0, crypto_1.createHash)('sha256');
        const stream = (0, fs_1.createReadStream)(filePath);
        for await (const chunk of stream) {
            hash.update(chunk);
        }
        return hash.digest('hex');
    }
    async generateEvidenceId(caseId) {
        const timestamp = Date.now();
        const random = (0, crypto_1.randomBytes)(4).toString('hex');
        return `EVID_${caseId}_${timestamp}_${random}`;
    }
    async validateEvidenceFile(buffer, filename, mimeType, evidenceType) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        try {
            const validation = await this.baseStorageService.validateFile(buffer, filename, mimeType, {
                validateMimeType: true,
                validateSize: true,
                validateExtension: true,
                checkDuplicates: false
            });
            if (!validation.isValid) {
                result.isValid = false;
                result.errors.push(...validation.errors);
            }
            if (validation.warnings.length > 0) {
                result.warnings.push(...validation.warnings);
            }
            if (buffer.length === 0) {
                result.isValid = false;
                result.errors.push('Evidence file cannot be empty');
            }
            const sizeLimits = {
                'PHOTO': 50 * 1024 * 1024,
                'VIDEO': 1024 * 1024 * 1024,
                'AUDIO': 500 * 1024 * 1024,
                'DOCUMENT': 100 * 1024 * 1024,
                'DEFAULT': 200 * 1024 * 1024
            };
            const sizeLimit = sizeLimits[evidenceType] || sizeLimits.DEFAULT;
            if (buffer.length > sizeLimit) {
                result.warnings.push(`File size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds recommended limit for ${evidenceType} evidence (${Math.round(sizeLimit / 1024 / 1024)}MB)`);
            }
            if (evidenceType === 'PHOTO' && mimeType.startsWith('image/')) {
                if (buffer.length < 100) {
                    result.warnings.push('Image file appears to be corrupted or too small');
                }
            }
            if (evidenceType === 'VIDEO' && mimeType.startsWith('video/')) {
                if (buffer.length < 1024) {
                    result.warnings.push('Video file appears to be corrupted or too small');
                }
            }
        }
        catch (error) {
            result.isValid = false;
            result.errors.push(`Evidence validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return result;
    }
    async uploadEvidence(fileBuffer, filename, options) {
        const startTime = Date.now();
        const result = {
            success: false,
            filename,
            size: fileBuffer.length,
            mimeType: 'application/octet-stream',
            warnings: []
        };
        try {
            const validation = await this.validateEvidenceFile(fileBuffer, filename, 'application/octet-stream', options.type);
            if (!validation.isValid) {
                result.error = `Evidence validation failed: ${validation.errors.join(', ')}`;
                return result;
            }
            if (validation.warnings.length > 0) {
                result.warnings.push(...validation.warnings);
            }
            const evidenceId = await this.generateEvidenceId(options.caseId);
            const evidenceFilename = this.generateEvidenceFilename(options.title, options.caseId, options.type);
            const directory = this.getStoragePath('original');
            await this.ensureDirectoryExists(directory);
            const filePath = path_1.default.join(directory, evidenceFilename);
            if (!options.overwrite && await this.baseStorageService.fileExists(filePath)) {
                result.error = 'Evidence file already exists';
                return result;
            }
            const checksum = await this.calculateFileHash(fileBuffer);
            result.checksum = checksum;
            await promises_1.default.writeFile(filePath, fileBuffer);
            let thumbnailPath;
            if (options.generateThumbnail && options.type === 'PHOTO') {
                thumbnailPath = await this.generateThumbnail(fileBuffer, evidenceFilename);
                if (thumbnailPath) {
                    result.thumbnailPath = thumbnailPath;
                }
            }
            const metadata = {
                ...options.metadata,
                evidenceId,
                title: options.title,
                description: options.description,
                type: options.type,
                caseId: options.caseId,
                collectedBy: options.collectedBy,
                collectedAt: new Date().toISOString(),
                location: options.location,
                originalFilename: filename,
                uploadedAt: new Date().toISOString(),
                validation: {
                    errors: validation.errors,
                    warnings: validation.warnings
                }
            };
            if (options.tags && options.tags.length > 0) {
                metadata.tags = options.tags;
            }
            if (options.chainOfCustody && options.chainOfCustody.length > 0) {
                metadata.chainOfCustody = options.chainOfCustody;
            }
            result.success = true;
            result.evidenceId = evidenceId;
            result.filePath = filePath;
            result.filename = evidenceFilename;
            result.metadata = metadata;
            result.processingTime = Date.now() - startTime;
            return result;
        }
        catch (error) {
            result.error = `Evidence upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return result;
        }
    }
    async generateThumbnail(imageBuffer, filename) {
        try {
            const thumbnailFilename = `thumb_${filename}`;
            const thumbnailDir = this.getStoragePath('thumbnails');
            await this.ensureDirectoryExists(thumbnailDir);
            const thumbnailPath = path_1.default.join(thumbnailDir, thumbnailFilename);
            await promises_1.default.writeFile(thumbnailPath, imageBuffer);
            return thumbnailPath;
        }
        catch (error) {
            console.warn('Failed to generate thumbnail:', error);
            return undefined;
        }
    }
    async addToChainOfCustody(evidenceId, entry) {
        try {
            const custodyEntry = {
                id: `CUSTODY_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`,
                evidenceId,
                action: entry.action,
                performedBy: entry.performedBy,
                performedAt: new Date(),
                location: entry.location,
                notes: entry.notes,
                signature: entry.signature
            };
            const chainFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}_chain.json`);
            let chain = [];
            try {
                const existingChain = await promises_1.default.readFile(chainFile, 'utf-8');
                chain = JSON.parse(existingChain);
            }
            catch {
            }
            chain.push(custodyEntry);
            await promises_1.default.writeFile(chainFile, JSON.stringify(chain, null, 2));
            return custodyEntry;
        }
        catch (error) {
            console.error('Error adding to chain of custody:', error);
            throw new Error(`Failed to add chain of custody entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getChainOfCustody(evidenceId) {
        try {
            const chainFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}_chain.json`);
            if (!await this.baseStorageService.fileExists(chainFile)) {
                return [];
            }
            const chainData = await promises_1.default.readFile(chainFile, 'utf-8');
            return JSON.parse(chainData);
        }
        catch (error) {
            console.error('Error getting chain of custody:', error);
            return [];
        }
    }
    async verifyEvidenceIntegrity(evidenceId) {
        try {
            const chainFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}_chain.json`);
            const evidenceFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}.bin`);
            const result = {
                isValid: true,
                checksumMatches: false,
                chainOfCustodyComplete: false,
                tamperingDetected: false,
                issues: [],
                recommendations: []
            };
            if (!await this.baseStorageService.fileExists(evidenceFile)) {
                result.isValid = false;
                result.issues.push('Evidence file not found');
                return result;
            }
            const currentChecksum = await this.getFileChecksum(evidenceFile);
            let chain = [];
            if (await this.baseStorageService.fileExists(chainFile)) {
                const chainData = await promises_1.default.readFile(chainFile, 'utf-8');
                chain = JSON.parse(chainData);
            }
            if (chain.length === 0) {
                result.chainOfCustodyComplete = false;
                result.issues.push('No chain of custody records found');
                result.recommendations.push('Establish proper chain of custody procedures');
            }
            else {
                result.chainOfCustodyComplete = true;
                const sortedChain = chain.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
                for (let i = 1; i < sortedChain.length; i++) {
                    const timeDiff = sortedChain[i].performedAt.getTime() - sortedChain[i - 1].performedAt.getTime();
                    if (timeDiff > 24 * 60 * 60 * 1000) {
                        result.issues.push(`Gap of ${Math.round(timeDiff / (60 * 60 * 1000))} hours in chain of custody`);
                    }
                }
            }
            result.checksumMatches = true;
            if (chain.length > 0) {
                const lastEntry = chain[chain.length - 1];
                if (lastEntry.action.includes('modified') || lastEntry.action.includes('altered')) {
                    result.tamperingDetected = true;
                    result.issues.push('Evidence may have been modified according to chain of custody');
                }
            }
            const stats = await promises_1.default.stat(evidenceFile);
            if (stats.size === 0) {
                result.isValid = false;
                result.issues.push('Evidence file is empty');
            }
            if (result.issues.length > 0) {
                result.isValid = false;
            }
            return result;
        }
        catch (error) {
            console.error('Error verifying evidence integrity:', error);
            return {
                isValid: false,
                checksumMatches: false,
                chainOfCustodyComplete: false,
                tamperingDetected: false,
                issues: [`Integrity verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                recommendations: []
            };
        }
    }
    async sealEvidence(evidenceId, sealedBy) {
        try {
            await this.addToChainOfCustody(evidenceId, {
                action: 'SEALED',
                performedBy: sealedBy,
                notes: 'Evidence officially sealed and marked as read-only'
            });
            const originalFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}.bin`);
            const sealedFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}_sealed.bin`);
            if (await this.baseStorageService.fileExists(originalFile)) {
                await promises_1.default.copyFile(originalFile, sealedFile);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error sealing evidence:', error);
            return false;
        }
    }
    async transferEvidence(evidenceId, transferTo, transferBy, reason, location) {
        try {
            await this.addToChainOfCustody(evidenceId, {
                action: `TRANSFERRED to ${transferTo}`,
                performedBy: transferBy,
                location,
                notes: `Reason: ${reason}`
            });
            return true;
        }
        catch (error) {
            console.error('Error transferring evidence:', error);
            return false;
        }
    }
    async disposeEvidence(evidenceId, disposedBy, method) {
        try {
            await this.addToChainOfCustody(evidenceId, {
                action: `DISPOSED via ${method}`,
                performedBy: disposedBy,
                notes: 'Evidence officially disposed of according to procedures'
            });
            const originalFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}.bin`);
            const disposedFile = path_1.default.join(this.getStoragePath('original'), 'disposed', `${evidenceId}.bin`);
            if (await this.baseStorageService.fileExists(originalFile)) {
                await this.ensureDirectoryExists(path_1.default.dirname(disposedFile));
                await promises_1.default.rename(originalFile, disposedFile);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error disposing evidence:', error);
            return false;
        }
    }
    async generateEvidenceReport(evidenceId) {
        try {
            const chain = await this.getChainOfCustody(evidenceId);
            const integrity = await this.verifyEvidenceIntegrity(evidenceId);
            const evidenceFile = path_1.default.join(this.getStoragePath('original'), `${evidenceId}.bin`);
            let fileInfo = {};
            if (await this.baseStorageService.fileExists(evidenceFile)) {
                const stats = await promises_1.default.stat(evidenceFile);
                fileInfo = {
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    checksum: await this.getFileChecksum(evidenceFile)
                };
            }
            const evidenceInfo = {
                evidenceId,
                fileInfo,
                chainLength: chain.length,
                lastTransfer: chain.length > 0 ? chain[chain.length - 1] : null,
                isSealed: chain.some(entry => entry.action === 'SEALED'),
                isDisposed: chain.some(entry => entry.action.includes('DISPOSED'))
            };
            const recommendations = [];
            if (!integrity.isValid) {
                recommendations.push('Address integrity issues immediately');
            }
            if (!integrity.chainOfCustodyComplete) {
                recommendations.push('Complete chain of custody documentation');
            }
            if (chain.length === 0) {
                recommendations.push('Establish initial chain of custody');
            }
            return {
                evidenceInfo,
                chainOfCustody: chain,
                integrityStatus: integrity,
                recommendations
            };
        }
        catch (error) {
            console.error('Error generating evidence report:', error);
            throw new Error(`Failed to generate evidence report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.EvidenceStorageService = EvidenceStorageService;
exports.evidenceStorageService = new EvidenceStorageService();
//# sourceMappingURL=evidenceStorage.js.map