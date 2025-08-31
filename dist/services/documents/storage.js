"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentStorageService = exports.DocumentStorageService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const util_1 = require("util");
const stream_1 = require("stream");
const fs_1 = require("fs");
const config_1 = require("../config");
const pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
class DocumentStorageService {
    constructor() {
        this.basePath = config_1.config.storage.basePath;
        this.maxFileSize = config_1.config.storage.maxFileSize;
        this.allowedMimeTypes = config_1.config.storage.allowedMimeTypes;
        this.allowedExtensions = [
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.txt', '.jpg', '.jpeg', '.png', '.tiff', '.mp3', '.wav', '.mp4', '.avi',
            '.zip', '.csv', '.rtf', '.odt', '.ods', '.odp'
        ];
    }
    async ensureDirectoryExists(dirPath) {
        try {
            await promises_1.default.access(dirPath);
        }
        catch {
            await promises_1.default.mkdir(dirPath, { recursive: true });
        }
    }
    generateUniqueFilename(originalName) {
        const ext = path_1.default.extname(originalName);
        const timestamp = Date.now();
        const random = (0, crypto_1.randomBytes)(4).toString('hex');
        return `${timestamp}-${random}${ext}`;
    }
    generateSecureFilename(originalName) {
        const sanitized = originalName
            .replace(/[^\w\s.-]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase();
        const ext = path_1.default.extname(sanitized);
        const name = path_1.default.basename(sanitized, ext);
        const timestamp = Date.now();
        const random = (0, crypto_1.randomBytes)(4).toString('hex');
        return `${name}_${timestamp}_${random}${ext}`;
    }
    getStoragePath(options) {
        const { category, subcategory = 'original' } = options;
        const categoryPaths = config_1.config.storage.paths[category];
        if (!categoryPaths) {
            throw new Error(`Invalid storage category: ${category}`);
        }
        const subcategoryPath = categoryPaths[subcategory];
        if (!subcategoryPath) {
            throw new Error(`Invalid subcategory: ${subcategory} for category: ${category}`);
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
    async detectMimeType(buffer, filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        const mimeMap = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.tiff': 'image/tiff',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.zip': 'application/zip'
        };
        return mimeMap[ext] || 'application/octet-stream';
    }
    async validateFile(buffer, originalName, mimeType, options = {}) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        try {
            if (options.validateMimeType !== false) {
                const detectedMime = await this.detectMimeType(buffer, originalName);
                const isAllowed = this.allowedMimeTypes.includes(detectedMime);
                result.mimeType = {
                    detected: detectedMime,
                    expected: mimeType,
                    matches: detectedMime === mimeType
                };
                if (!isAllowed) {
                    result.isValid = false;
                    result.errors.push(`File type not allowed: ${detectedMime}`);
                }
                if (detectedMime !== mimeType) {
                    result.warnings.push(`MIME type mismatch: declared ${mimeType}, detected ${detectedMime}`);
                }
            }
            if (options.validateSize !== false) {
                const maxSize = this.maxFileSize;
                result.size = {
                    actual: buffer.length,
                    maximum: maxSize,
                    withinLimit: buffer.length <= maxSize
                };
                if (buffer.length > maxSize) {
                    result.isValid = false;
                    result.errors.push(`File size exceeds maximum limit of ${maxSize} bytes`);
                }
            }
            if (options.validateExtension !== false) {
                const ext = path_1.default.extname(originalName).toLowerCase();
                const isAllowed = this.allowedExtensions.includes(ext);
                result.extension = {
                    detected: ext,
                    allowed: isAllowed
                };
                if (!isAllowed) {
                    result.isValid = false;
                    result.errors.push(`File extension not allowed: ${ext}`);
                }
            }
            if (options.checkDuplicates) {
                const checksum = await this.calculateFileHash(buffer);
                const existingFiles = await this.findFilesByChecksum(checksum);
                result.duplicates = {
                    exists: existingFiles.length > 0,
                    existingFiles: existingFiles.slice(0, 5)
                };
                if (existingFiles.length > 0) {
                    result.warnings.push(`Duplicate file detected. ${existingFiles.length} existing files with same checksum.`);
                }
            }
            try {
                if (buffer.length === 0) {
                    result.isValid = false;
                    result.errors.push('File is empty');
                }
                if (originalName.toLowerCase().endsWith('.pdf')) {
                    if (!buffer.toString('ascii', 0, 10).includes('%PDF')) {
                        result.warnings.push('File may be corrupted: Invalid PDF signature');
                    }
                }
            }
            catch (error) {
                result.warnings.push('Could not perform file integrity check');
            }
        }
        catch (error) {
            result.isValid = false;
            result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return result;
    }
    async findFilesByChecksum(checksum) {
        return [];
    }
    async generateThumbnail(imageBuffer, mimeType) {
        try {
            if (mimeType.startsWith('image/')) {
                return null;
            }
            return null;
        }
        catch (error) {
            console.warn('Failed to generate thumbnail:', error);
            return null;
        }
    }
    async uploadFile(fileBuffer, originalName, options) {
        const startTime = Date.now();
        const result = {
            success: false,
            filePath: '',
            filename: '',
            size: fileBuffer.length,
            mimeType: options.mimeType,
            warnings: []
        };
        try {
            const validation = await this.validateFile(fileBuffer, originalName, options.mimeType, {
                validateMimeType: true,
                validateSize: true,
                validateExtension: true,
                checkDuplicates: true
            });
            if (!validation.isValid) {
                result.error = `Validation failed: ${validation.errors.join(', ')}`;
                return result;
            }
            if (validation.warnings.length > 0) {
                result.warnings.push(...validation.warnings);
            }
            const filename = options.overwrite
                ? originalName
                : this.generateSecureFilename(originalName);
            const directory = this.getStoragePath(options);
            await this.ensureDirectoryExists(directory);
            const filePath = path_1.default.join(directory, filename);
            if (!options.overwrite && await this.fileExists(filePath)) {
                result.error = 'File already exists';
                return result;
            }
            let checksum;
            if (options.generateChecksum) {
                checksum = await this.calculateFileHash(fileBuffer);
                result.checksum = checksum;
            }
            let thumbnailPath;
            if (options.generateThumbnail) {
                const thumbnailBuffer = await this.generateThumbnail(fileBuffer, options.mimeType);
                if (thumbnailBuffer) {
                    const thumbnailFilename = `thumb_${filename}`;
                    const thumbnailDir = path_1.default.join(this.basePath, config_1.config.storage.paths.evidence.thumbnails);
                    await this.ensureDirectoryExists(thumbnailDir);
                    const thumbnailFilePath = path_1.default.join(thumbnailDir, thumbnailFilename);
                    await promises_1.default.writeFile(thumbnailFilePath, thumbnailBuffer);
                    thumbnailPath = thumbnailFilePath;
                    result.thumbnailPath = thumbnailPath;
                }
            }
            await promises_1.default.writeFile(filePath, fileBuffer);
            const metadata = {
                ...options.metadata,
                originalName,
                uploadedAt: new Date().toISOString(),
                validation: {
                    mimeType: validation.mimeType,
                    size: validation.size,
                    extension: validation.extension,
                    duplicates: validation.duplicates
                }
            };
            if (options.userId) {
                metadata.uploadedBy = options.userId;
            }
            result.success = true;
            result.filePath = filePath;
            result.filename = filename;
            result.metadata = metadata;
            result.processingTime = Date.now() - startTime;
            return result;
        }
        catch (error) {
            result.error = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return result;
        }
    }
    async downloadFile(filePath, options = {}) {
        const result = {
            success: false,
            filePath
        };
        try {
            if (!await this.fileExists(filePath)) {
                result.error = 'File not found';
                return result;
            }
            const stats = await promises_1.default.stat(filePath);
            result.size = stats.size;
            const buffer = await promises_1.default.readFile(filePath);
            result.buffer = buffer;
            if (options.validateChecksum) {
                const checksum = await this.getFileChecksum(filePath);
                result.checksum = checksum;
            }
            result.success = true;
            return result;
        }
        catch (error) {
            result.error = `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return result;
        }
    }
    async getFileStream(filePath, options = {}) {
        const result = {
            success: false,
            filePath
        };
        try {
            if (!await this.fileExists(filePath)) {
                result.error = 'File not found';
                return result;
            }
            const stats = await promises_1.default.stat(filePath);
            result.size = stats.size;
            const stream = (0, fs_1.createReadStream)(filePath);
            result.stream = stream;
            result.success = true;
            return result;
        }
        catch (error) {
            result.error = `Stream creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return result;
        }
    }
    async deleteFile(filePath, deleteThumbnails = false) {
        try {
            if (await this.fileExists(filePath)) {
                await promises_1.default.unlink(filePath);
            }
            if (deleteThumbnails) {
                const filename = path_1.default.basename(filePath);
                const thumbnailFilename = `thumb_${filename}`;
                const thumbnailDir = path_1.default.join(this.basePath, config_1.config.storage.paths.evidence.thumbnails);
                const thumbnailPath = path_1.default.join(thumbnailDir, thumbnailFilename);
                if (await this.fileExists(thumbnailPath)) {
                    await promises_1.default.unlink(thumbnailPath);
                }
            }
            return true;
        }
        catch (error) {
            console.error(`Failed to delete file ${filePath}:`, error);
            return false;
        }
    }
    async moveFile(sourcePath, destinationPath) {
        try {
            await this.ensureDirectoryExists(path_1.default.dirname(destinationPath));
            await promises_1.default.rename(sourcePath, destinationPath);
            return true;
        }
        catch (error) {
            console.error(`Failed to move file from ${sourcePath} to ${destinationPath}:`, error);
            return false;
        }
    }
    async copyFile(sourcePath, destinationPath) {
        try {
            await this.ensureDirectoryExists(path_1.default.dirname(destinationPath));
            await promises_1.default.copyFile(sourcePath, destinationPath);
            return true;
        }
        catch (error) {
            console.error(`Failed to copy file from ${sourcePath} to ${destinationPath}:`, error);
            return false;
        }
    }
    async fileExists(filePath) {
        try {
            await promises_1.default.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getFileSize(filePath) {
        try {
            const stats = await promises_1.default.stat(filePath);
            return stats.size;
        }
        catch {
            throw new Error(`Cannot get file size: ${filePath}`);
        }
    }
    async getStorageUsage() {
        const usage = {
            totalUsed: 0,
            totalAvailable: 0,
            usedPercentage: 0,
            byCategory: {},
            largestFiles: []
        };
        try {
            for (const [category, paths] of Object.entries(config_1.config.storage.paths)) {
                let categoryUsed = 0;
                let fileCount = 0;
                const categoryFiles = [];
                for (const subcategory of Object.values(paths)) {
                    const dirPath = path_1.default.join(this.basePath, subcategory);
                    try {
                        await this.scanDirectory(dirPath, (filePath, stats) => {
                            categoryUsed += stats.size;
                            fileCount++;
                            categoryFiles.push({
                                path: filePath,
                                size: stats.size,
                                mime: 'unknown',
                                modified: stats.mtime
                            });
                        });
                    }
                    catch (error) {
                        continue;
                    }
                }
                usage.byCategory[category] = {
                    used: categoryUsed,
                    fileCount,
                    averageSize: fileCount > 0 ? categoryUsed / fileCount : 0
                };
                usage.totalUsed += categoryUsed;
            }
            const allFiles = [];
            for (const categoryFiles of Object.values(usage.byCategory)) {
                if (categoryFiles.fileCount > 0) {
                }
            }
            usage.largestFiles = allFiles
                .sort((a, b) => b.size - a.size)
                .slice(0, 10);
            usage.totalAvailable = 1024 * 1024 * 1024 * 1024;
            usage.usedPercentage = (usage.totalUsed / usage.totalAvailable) * 100;
        }
        catch (error) {
            console.error('Failed to calculate storage usage:', error);
        }
        return usage;
    }
    async scanDirectory(dirPath, callback) {
        try {
            const files = await promises_1.default.readdir(dirPath);
            for (const file of files) {
                const filePath = path_1.default.join(dirPath, file);
                const stats = await promises_1.default.stat(filePath);
                if (stats.isDirectory()) {
                    await this.scanDirectory(filePath, callback);
                }
                else {
                    callback(filePath, stats);
                }
            }
        }
        catch (error) {
            console.warn(`Failed to scan directory ${dirPath}:`, error);
        }
    }
    async cleanup(options = {}) {
        const result = {
            success: true,
            deletedFiles: 0,
            freedSpace: 0,
            details: {
                tempFiles: 0,
                oldVersions: 0,
                duplicates: 0,
                corrupted: 0,
                thumbnails: 0
            }
        };
        try {
            const now = Date.now();
            const maxAge = options.tempFilesOlderThan || 24;
            const tempDir = path_1.default.join(this.basePath, config_1.config.storage.paths.temp.uploads);
            if (await this.fileExists(tempDir)) {
                await this.scanDirectory(tempDir, async (filePath, stats) => {
                    const ageInHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
                    if (ageInHours > maxAge) {
                        if (!options.dryRun) {
                            await promises_1.default.unlink(filePath);
                        }
                        result.deletedFiles++;
                        result.freedSpace += stats.size;
                        result.details.tempFiles++;
                    }
                });
            }
            if (options.versionsOlderThan) {
            }
            if (options.includeThumbnails) {
                const thumbnailDir = path_1.default.join(this.basePath, config_1.config.storage.paths.evidence.thumbnails);
                if (await this.fileExists(thumbnailDir)) {
                }
            }
        }
        catch (error) {
            result.success = false;
            result.errors = [`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`];
        }
        return result;
    }
    async createDirectoryStructure() {
        const paths = Object.values(config_1.config.storage.paths);
        for (const category of paths) {
            for (const subcategory of Object.values(category)) {
                const dirPath = path_1.default.join(this.basePath, subcategory);
                await this.ensureDirectoryExists(dirPath);
            }
        }
    }
    async validateStorageHealth() {
        const issues = [];
        try {
            try {
                await promises_1.default.access(this.basePath, promises_1.default.constants.W_OK);
            }
            catch {
                issues.push(`Storage base path is not accessible: ${this.basePath}`);
            }
            for (const [category, paths] of Object.entries(config_1.config.storage.paths)) {
                for (const subcategory of Object.values(paths)) {
                    const dirPath = path_1.default.join(this.basePath, subcategory);
                    try {
                        await promises_1.default.access(dirPath, promises_1.default.constants.W_OK);
                    }
                    catch {
                        issues.push(`Directory is not accessible: ${dirPath}`);
                    }
                }
            }
            const usage = await this.getStorageUsage();
            if (usage.usedPercentage > 90) {
                issues.push(`Storage usage is critical: ${usage.usedPercentage.toFixed(1)}%`);
            }
            else if (usage.usedPercentage > 75) {
                issues.push(`Storage usage is high: ${usage.usedPercentage.toFixed(1)}%`);
            }
            return {
                healthy: issues.length === 0,
                issues,
                usage
            };
        }
        catch (error) {
            return {
                healthy: false,
                issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                usage: await this.getStorageUsage()
            };
        }
    }
}
exports.DocumentStorageService = DocumentStorageService;
exports.documentStorageService = new DocumentStorageService();
//# sourceMappingURL=storage.js.map