"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionControlStorageService = exports.VersionControlStorageService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const util_1 = require("util");
const stream_1 = require("stream");
const fs_1 = require("fs");
const config_1 = require("../config");
const storage_1 = require("../services/documents/storage");
const pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
class VersionControlStorageService {
    constructor() {
        this.basePath = config_1.config.storage.basePath;
        this.maxFileSize = config_1.config.storage.maxFileSize;
        this.allowedMimeTypes = config_1.config.storage.allowedMimeTypes;
        this.maxVersions = 50;
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
    generateVersionFilename(originalName, versionNumber) {
        const ext = path_1.default.extname(originalName);
        const name = path_1.default.basename(originalName, ext);
        const timestamp = Date.now();
        const random = (0, crypto_1.randomBytes)(4).toString('hex');
        return `${name}_v${versionNumber}_${timestamp}_${random}${ext}`;
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
    async compareFiles(filePath1, filePath2) {
        try {
            const [buffer1, buffer2] = await Promise.all([
                promises_1.default.readFile(filePath1),
                promises_1.default.readFile(filePath2)
            ]);
            const checksum1 = await this.calculateFileHash(buffer1);
            const checksum2 = await this.calculateFileHash(buffer2);
            if (checksum1 === checksum2) {
                return {
                    hasChanges: false,
                    changes: { added: [], removed: [], modified: [] },
                    similarity: 1.0
                };
            }
            if (filePath1.endsWith('.txt') && filePath2.endsWith('.txt')) {
                const text1 = buffer1.toString('utf-8');
                const text2 = buffer2.toString('utf-8');
                const lines1 = text1.split('\n');
                const lines2 = text2.split('\n');
                const added = [];
                const removed = [];
                const modified = [];
                lines2.forEach((line, index) => {
                    if (!lines1.includes(line)) {
                        added.push(line);
                    }
                });
                lines1.forEach((line, index) => {
                    if (!lines2.includes(line)) {
                        removed.push(line);
                    }
                });
                const similarity = this.calculateSimilarity(lines1, lines2);
                return {
                    hasChanges: true,
                    changes: { added, removed, modified },
                    similarity
                };
            }
            const sizeDiff = Math.abs(buffer1.length - buffer2.length);
            const similarity = 1 - (sizeDiff / Math.max(buffer1.length, buffer2.length));
            return {
                hasChanges: true,
                changes: {
                    added: [`Size difference: ${sizeDiff} bytes`],
                    removed: [],
                    modified: []
                },
                similarity
            };
        }
        catch (error) {
            console.error('Error comparing files:', error);
            return {
                hasChanges: true,
                changes: { added: [], removed: [], modified: ['Comparison failed'] },
                similarity: 0
            };
        }
    }
    calculateSimilarity(lines1, lines2) {
        const intersection = lines1.filter(line => lines2.includes(line));
        const union = [...new Set([...lines1, ...lines2])];
        return union.length > 0 ? intersection.length / union.length : 0;
    }
    async createDeltaPatch(originalPath, modifiedPath) {
        try {
            const [originalBuffer, modifiedBuffer] = await Promise.all([
                promises_1.default.readFile(originalPath),
                promises_1.default.readFile(modifiedPath)
            ]);
            return modifiedBuffer;
        }
        catch (error) {
            console.error('Error creating delta patch:', error);
            throw error;
        }
    }
    async applyDeltaPatch(originalPath, patchPath) {
        try {
            return await promises_1.default.readFile(patchPath);
        }
        catch (error) {
            console.error('Error applying delta patch:', error);
            throw error;
        }
    }
    async uploadVersion(fileBuffer, originalName, options) {
        const startTime = Date.now();
        const result = {
            success: false,
            filePath: '',
            filename: '',
            size: fileBuffer.length,
            mimeType: options.mimeType,
            versionNumber: options.versionNumber || 1,
            warnings: []
        };
        try {
            const validation = await this.baseStorageService.validateFile(fileBuffer, originalName, options.mimeType, {
                validateMimeType: true,
                validateSize: true,
                validateExtension: true,
                checkDuplicates: false
            });
            if (!validation.isValid) {
                result.error = `Validation failed: ${validation.errors.join(', ')}`;
                return result;
            }
            const versionNumber = options.versionNumber || 1;
            const filename = options.overwrite
                ? originalName
                : this.generateVersionFilename(originalName, versionNumber);
            const directory = this.getStoragePath(options);
            await this.ensureDirectoryExists(directory);
            const filePath = path_1.default.join(directory, filename);
            if (!options.overwrite && await this.baseStorageService.fileExists(filePath)) {
                result.error = 'File already exists';
                return result;
            }
            let checksum;
            if (options.generateChecksum) {
                checksum = await this.calculateFileHash(fileBuffer);
                result.checksum = checksum;
            }
            await promises_1.default.writeFile(filePath, fileBuffer);
            const metadata = {
                ...options.metadata,
                originalName,
                uploadedAt: new Date().toISOString(),
                versionNumber,
                changeDescription: options.changeDescription || `Version ${versionNumber}`,
                validation: {
                    mimeType: validation.mimeType,
                    size: validation.size,
                    extension: validation.extension
                }
            };
            if (options.userId) {
                metadata.uploadedBy = options.userId;
            }
            result.success = true;
            result.filePath = filePath;
            result.filename = filename;
            result.versionNumber = versionNumber;
            result.metadata = metadata;
            result.processingTime = Date.now() - startTime;
            return result;
        }
        catch (error) {
            result.error = `Version upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return result;
        }
    }
    async createVersionFromPrevious(previousVersionPath, newFileBuffer, originalName, options) {
        try {
            const comparison = await this.compareFiles(previousVersionPath, 'temp_compare');
            await promises_1.default.writeFile('temp_compare', newFileBuffer);
            const comparisonResult = await this.compareFiles(previousVersionPath, 'temp_compare');
            try {
                await promises_1.default.unlink('temp_compare');
            }
            catch { }
            if (comparisonResult.similarity > 0.99) {
                const result = {
                    success: true,
                    filePath: previousVersionPath,
                    filename: originalName,
                    size: newFileBuffer.length,
                    mimeType: options.mimeType,
                    versionNumber: options.versionNumber || 1,
                    warnings: ['File is very similar to previous version (>99% similarity)']
                };
                return result;
            }
            const versionNumber = (options.versionNumber || 0) + 1;
            return await this.uploadVersion(newFileBuffer, originalName, {
                ...options,
                versionNumber,
                changeDescription: options.changeDescription || `Changes detected (${Math.round((1 - comparisonResult.similarity) * 100)}% different)`
            });
        }
        catch (error) {
            const result = {
                success: false,
                filePath: '',
                filename: originalName,
                size: newFileBuffer.length,
                mimeType: options.mimeType,
                versionNumber: options.versionNumber || 1,
                error: `Version creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            return result;
        }
    }
    async listVersions(documentId) {
        try {
            const versions = [];
            const versionsDir = path_1.default.join(this.basePath, config_1.config.storage.paths.versions);
            if (await this.baseStorageService.fileExists(versionsDir)) {
                const files = await promises_1.default.readdir(versionsDir);
                for (const file of files) {
                    if (file.includes(documentId) && file.includes('_v')) {
                        const filePath = path_1.default.join(versionsDir, file);
                        const stats = await promises_1.default.stat(filePath);
                        const versionMatch = file.match(/_v(\d+)_/);
                        const versionNumber = versionMatch ? parseInt(versionMatch[1]) : 1;
                        versions.push({
                            versionNumber,
                            filePath,
                            size: stats.size,
                            checksum: await this.getFileChecksum(filePath),
                            createdAt: stats.mtime,
                            changeDescription: `Version ${versionNumber}`
                        });
                    }
                }
            }
            return versions.sort((a, b) => b.versionNumber - a.versionNumber);
        }
        catch (error) {
            console.error('Error listing versions:', error);
            return [];
        }
    }
    async getVersion(documentId, versionNumber) {
        try {
            const versions = await this.listVersions(documentId);
            const version = versions.find(v => v.versionNumber === versionNumber);
            if (!version) {
                return {
                    success: false,
                    filePath: '',
                    filename: '',
                    size: 0,
                    mimeType: '',
                    versionNumber,
                    error: 'Version not found'
                };
            }
            const result = await this.baseStorageService.downloadFile(version.filePath);
            return {
                success: result.success,
                filePath: version.filePath,
                filename: path_1.default.basename(version.filePath),
                size: version.size,
                mimeType: 'application/octet-stream',
                versionNumber,
                checksum: version.checksum,
                error: result.error
            };
        }
        catch (error) {
            return {
                success: false,
                filePath: '',
                filename: '',
                size: 0,
                mimeType: '',
                versionNumber,
                error: `Get version failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async getLatestVersion(documentId) {
        try {
            const versions = await this.listVersions(documentId);
            if (versions.length === 0) {
                return {
                    success: false,
                    filePath: '',
                    filename: '',
                    size: 0,
                    mimeType: '',
                    versionNumber: 1,
                    error: 'No versions found'
                };
            }
            const latestVersion = versions[0];
            const result = await this.baseStorageService.downloadFile(latestVersion.filePath);
            return {
                success: result.success,
                filePath: latestVersion.filePath,
                filename: path_1.default.basename(latestVersion.filePath),
                size: latestVersion.size,
                mimeType: 'application/octet-stream',
                versionNumber: latestVersion.versionNumber,
                checksum: latestVersion.checksum,
                error: result.error
            };
        }
        catch (error) {
            return {
                success: false,
                filePath: '',
                filename: '',
                size: 0,
                mimeType: '',
                versionNumber: 1,
                error: `Get latest version failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async compareVersions(documentId, version1, version2) {
        try {
            const [v1Result, v2Result] = await Promise.all([
                this.getVersion(documentId, version1),
                this.getVersion(documentId, version2)
            ]);
            if (!v1Result.success || !v2Result.success) {
                throw new Error('Could not retrieve one or both versions');
            }
            if (!v1Result.filePath || !v2Result.filePath) {
                throw new Error('Version file paths not available');
            }
            return await this.compareFiles(v1Result.filePath, v2Result.filePath);
        }
        catch (error) {
            console.error('Error comparing versions:', error);
            return {
                hasChanges: false,
                changes: { added: [], removed: [], modified: [] },
                similarity: 0
            };
        }
    }
    async deleteVersion(documentId, versionNumber) {
        try {
            const versions = await this.listVersions(documentId);
            const version = versions.find(v => v.versionNumber === versionNumber);
            if (!version) {
                return false;
            }
            if (versionNumber === versions[0].versionNumber && versions.length > 1) {
                return false;
            }
            await promises_1.default.unlink(version.filePath);
            return true;
        }
        catch (error) {
            console.error('Error deleting version:', error);
            return false;
        }
    }
    async cleanupOldVersions(documentId, keepCount = 10) {
        try {
            const versions = await this.listVersions(documentId);
            if (versions.length <= keepCount) {
                return {
                    success: true,
                    deletedVersions: 0,
                    freedSpace: 0
                };
            }
            const versionsToDelete = versions.slice(keepCount);
            let deletedVersions = 0;
            let freedSpace = 0;
            for (const version of versionsToDelete) {
                try {
                    const stats = await promises_1.default.stat(version.filePath);
                    await promises_1.default.unlink(version.filePath);
                    deletedVersions++;
                    freedSpace += stats.size;
                }
                catch (error) {
                    console.error(`Error deleting version ${version.versionNumber}:`, error);
                }
            }
            return {
                success: true,
                deletedVersions,
                freedSpace
            };
        }
        catch (error) {
            console.error('Error cleaning up old versions:', error);
            return {
                success: false,
                deletedVersions: 0,
                freedSpace: 0
            };
        }
    }
    async createVersionSummary(documentId) {
        try {
            const versions = await this.listVersions(documentId);
            if (versions.length === 0) {
                return {
                    totalVersions: 0,
                    totalSize: 0,
                    latestVersion: 0,
                    oldestVersion: 0,
                    averageSize: 0,
                    growthTrend: 'stable'
                };
            }
            const totalSize = versions.reduce((sum, v) => sum + v.size, 0);
            const averageSize = totalSize / versions.length;
            const recentVersions = versions.slice(0, Math.min(3, versions.length));
            const olderVersions = versions.slice(Math.min(3, versions.length));
            const recentAvgSize = recentVersions.reduce((sum, v) => sum + v.size, 0) / recentVersions.length;
            const olderAvgSize = olderVersions.length > 0
                ? olderVersions.reduce((sum, v) => sum + v.size, 0) / olderVersions.length
                : recentAvgSize;
            let growthTrend = 'stable';
            if (recentAvgSize > olderAvgSize * 1.1) {
                growthTrend = 'increasing';
            }
            else if (recentAvgSize < olderAvgSize * 0.9) {
                growthTrend = 'decreasing';
            }
            return {
                totalVersions: versions.length,
                totalSize,
                latestVersion: versions[0].versionNumber,
                oldestVersion: versions[versions.length - 1].versionNumber,
                averageSize,
                growthTrend
            };
        }
        catch (error) {
            console.error('Error creating version summary:', error);
            return {
                totalVersions: 0,
                totalSize: 0,
                latestVersion: 0,
                oldestVersion: 0,
                averageSize: 0,
                growthTrend: 'stable'
            };
        }
    }
    async rollbackToVersion(documentId, targetVersion) {
        try {
            const versions = await this.listVersions(documentId);
            const targetVersionData = versions.find(v => v.versionNumber === targetVersion);
            if (!targetVersionData) {
                return {
                    success: false,
                    filePath: '',
                    filename: '',
                    size: 0,
                    mimeType: '',
                    versionNumber: targetVersion,
                    error: 'Target version not found'
                };
            }
            const targetResult = await this.getVersion(documentId, targetVersion);
            if (!targetResult.success || !targetResult.buffer) {
                return {
                    success: false,
                    filePath: '',
                    filename: '',
                    size: 0,
                    mimeType: '',
                    versionNumber: targetVersion,
                    error: 'Could not retrieve target version'
                };
            }
            const rollbackVersion = Math.max(...versions.map(v => v.versionNumber)) + 1;
            return await this.uploadVersion(targetResult.buffer, targetVersionData.filePath, {
                filename: targetVersionData.filePath,
                mimeType: 'application/octet-stream',
                category: 'versions',
                versionNumber: rollbackVersion,
                changeDescription: `Rollback to version ${targetVersion}`,
                generateChecksum: true
            });
        }
        catch (error) {
            return {
                success: false,
                filePath: '',
                filename: '',
                size: 0,
                mimeType: '',
                versionNumber: targetVersion,
                error: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
exports.VersionControlStorageService = VersionControlStorageService;
exports.versionControlStorageService = new VersionControlStorageService();
//# sourceMappingURL=versionStorage.js.map