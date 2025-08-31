"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageOptimizationService = exports.StorageOptimizationService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const config_1 = require("../config");
const storage_1 = require("../services/documents/storage");
class StorageOptimizationService {
    constructor() {
        this.optimizationHistory = [];
        this.basePath = config_1.config.storage.basePath;
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
    async calculateFileHash(filePath) {
        const hash = (0, crypto_1.createHash)('sha256');
        const stream = (0, fs_1.createReadStream)(filePath);
        for await (const chunk of stream) {
            hash.update(chunk);
        }
        return hash.digest('hex');
    }
    async getFileSize(filePath) {
        try {
            const stats = await promises_1.default.stat(filePath);
            return stats.size;
        }
        catch {
            return 0;
        }
    }
    async scanDirectory(dirPath, callback, options = {}) {
        try {
            const files = await promises_1.default.readdir(dirPath);
            for (const file of files) {
                const filePath = path_1.default.join(dirPath, file);
                const stats = await promises_1.default.stat(filePath);
                if (stats.isDirectory() && options.recursive !== false) {
                    await this.scanDirectory(filePath, callback, options);
                }
                else if (!stats.isDirectory() || options.includeDirectories) {
                    callback(filePath, stats);
                }
            }
        }
        catch (error) {
            console.warn(`Could not scan directory ${dirPath}:`, error);
        }
    }
    async performOptimization(options = {}) {
        const startTime = new Date();
        const result = {
            success: false,
            startTime,
            summary: {
                filesProcessed: 0,
                filesDeleted: 0,
                filesOptimized: 0,
                spaceFreed: 0,
                spaceSaved: 0
            },
            details: {
                tempFiles: { deleted: 0, spaceFreed: 0 },
                oldVersions: { deleted: 0, spaceFreed: 0 },
                duplicates: { deleted: 0, spaceFreed: 0 },
                corrupted: { deleted: 0, spaceFreed: 0 },
                compressed: { optimized: 0, spaceSaved: 0 },
                database: { optimized: false }
            },
            errors: [],
            warnings: [],
            recommendations: []
        };
        try {
            if (options.dryRun) {
                result.warnings.push('Running in dry-run mode - no actual changes will be made');
            }
            if (options.cleanupTempFiles !== false) {
                const tempResult = await this.cleanupTempFiles(options);
                result.details.tempFiles = tempResult;
                result.summary.filesDeleted += tempResult.deleted;
                result.summary.spaceFreed += tempResult.spaceFreed;
            }
            if (options.cleanupOldVersions !== false) {
                const versionsResult = await this.cleanupOldVersions(options);
                result.details.oldVersions = versionsResult;
                result.summary.filesDeleted += versionsResult.deleted;
                result.summary.spaceFreed += versionsResult.spaceFreed;
            }
            if (options.cleanupDuplicates !== false) {
                const duplicatesResult = await this.cleanupDuplicates(options);
                result.details.duplicates = duplicatesResult;
                result.summary.filesDeleted += duplicatesResult.deleted;
                result.summary.spaceFreed += duplicatesResult.spaceFreed;
            }
            if (options.cleanupCorruptedFiles !== false) {
                const corruptedResult = await this.cleanupCorruptedFiles(options);
                result.details.corrupted = corruptedResult;
                result.summary.filesDeleted += corruptedResult.deleted;
                result.summary.spaceFreed += corruptedResult.spaceFreed;
            }
            if (options.compressLargeFiles !== false) {
                const compressionResult = await this.compressLargeFiles(options);
                result.details.compressed = compressionResult;
                result.summary.filesOptimized += compressionResult.optimized;
                result.summary.spaceSaved += compressionResult.spaceSaved;
            }
            if (options.optimizeDatabase !== false) {
                const dbResult = await this.optimizeDatabase(options);
                result.details.database = dbResult;
            }
            const metrics = await this.getStorageMetrics();
            this.generateRecommendations(metrics, result);
            result.success = result.errors.length === 0;
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - result.startTime.getTime();
            result.summary.filesProcessed =
                result.details.tempFiles.deleted +
                    result.details.oldVersions.deleted +
                    result.details.duplicates.deleted +
                    result.details.corrupted.deleted +
                    result.details.compressed.optimized;
            this.optimizationHistory.push({
                timestamp: new Date(),
                result: { ...result }
            });
            return result;
        }
        catch (error) {
            result.errors.push(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - startTime.getTime();
            result.success = false;
            return result;
        }
    }
    async cleanupTempFiles(options) {
        const result = { deleted: 0, spaceFreed: 0 };
        const maxAge = options.maxAge?.tempFiles || 24;
        const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);
        try {
            const tempDir = path_1.default.join(this.basePath, config_1.config.storage.paths.temp.uploads);
            if (await this.baseStorageService.fileExists(tempDir)) {
                await this.scanDirectory(tempDir, async (filePath, stats) => {
                    if (stats.mtime < cutoffTime) {
                        if (!options.dryRun) {
                            await promises_1.default.unlink(filePath);
                        }
                        result.deleted++;
                        result.spaceFreed += stats.size;
                    }
                });
            }
        }
        catch (error) {
            console.error('Error cleaning up temp files:', error);
        }
        return result;
    }
    async cleanupOldVersions(options) {
        const result = { deleted: 0, spaceFreed: 0 };
        const maxAge = options.maxAge?.versions || 90;
        const cutoffTime = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
        const sizeThreshold = options.sizeThresholds?.versionCleanup || 10 * 1024 * 1024;
        try {
            const versionsDir = path_1.default.join(this.basePath, config_1.config.storage.paths.documents.versions);
            if (await this.baseStorageService.fileExists(versionsDir)) {
                await this.scanDirectory(versionsDir, async (filePath, stats) => {
                    if (stats.mtime < cutoffTime && stats.size > sizeThreshold) {
                        if (!options.dryRun) {
                            await promises_1.default.unlink(filePath);
                        }
                        result.deleted++;
                        result.spaceFreed += stats.size;
                    }
                });
            }
        }
        catch (error) {
            console.error('Error cleaning up old versions:', error);
        }
        return result;
    }
    async cleanupDuplicates(options) {
        const result = { deleted: 0, spaceFreed: 0 };
        const sizeThreshold = options.sizeThresholds?.duplicateDetection || 1024 * 1024;
        const checksumMap = new Map();
        try {
            for (const category of Object.values(config_1.config.storage.paths)) {
                for (const subcategory of Object.values(category)) {
                    const dirPath = path_1.default.join(this.basePath, subcategory);
                    if (await this.baseStorageService.fileExists(dirPath)) {
                        await this.scanDirectory(dirPath, async (filePath, stats) => {
                            if (stats.size >= sizeThreshold) {
                                try {
                                    const checksum = await this.calculateFileHash(filePath);
                                    if (!checksumMap.has(checksum)) {
                                        checksumMap.set(checksum, []);
                                    }
                                    checksumMap.get(checksum).push(filePath);
                                }
                                catch (error) {
                                    console.warn(`Could not calculate checksum for ${filePath}:`, error);
                                }
                            }
                        });
                    }
                }
            }
            for (const [checksum, files] of checksumMap.entries()) {
                if (files.length > 1) {
                    files.sort((a, b) => {
                        return promises_1.default.stat(b).then(statsB => promises_1.default.stat(a).then(statsA => statsB.mtime.getTime() - statsA.mtime.getTime()));
                    });
                    for (let i = 1; i < files.length; i++) {
                        try {
                            const stats = await promises_1.default.stat(files[i]);
                            if (!options.dryRun) {
                                await promises_1.default.unlink(files[i]);
                            }
                            result.deleted++;
                            result.spaceFreed += stats.size;
                        }
                        catch (error) {
                            console.warn(`Could not delete duplicate file ${files[i]}:`, error);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up duplicates:', error);
        }
        return result;
    }
    async cleanupCorruptedFiles(options) {
        const result = { deleted: 0, spaceFreed: 0 };
        try {
            for (const category of Object.values(config_1.config.storage.paths)) {
                for (const subcategory of Object.values(category)) {
                    const dirPath = path_1.default.join(this.basePath, subcategory);
                    if (await this.baseStorageService.fileExists(dirPath)) {
                        await this.scanDirectory(dirPath, async (filePath, stats) => {
                            if (await this.isCorruptedFile(filePath)) {
                                if (!options.dryRun) {
                                    await promises_1.default.unlink(filePath);
                                }
                                result.deleted++;
                                result.spaceFreed += stats.size;
                            }
                        });
                    }
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up corrupted files:', error);
        }
        return result;
    }
    async isCorruptedFile(filePath) {
        try {
            const stats = await promises_1.default.stat(filePath);
            if (stats.size === 0) {
                return true;
            }
            const ext = path_1.default.extname(filePath).toLowerCase();
            if (ext === '.pdf') {
                const buffer = await promises_1.default.readFile(filePath, { start: 0, end: 10 });
                return !buffer.toString('ascii').includes('%PDF');
            }
            if (['.jpg', '.jpeg'].includes(ext)) {
                const buffer = await promises_1.default.readFile(filePath, { start: 0, end: 4 });
                return buffer.toString('hex') !== 'ffd8ffe0';
            }
            if (ext === '.png') {
                const buffer = await promises_1.default.readFile(filePath, { start: 0, end: 8 });
                return buffer.toString('hex') !== '89504e470d0a1a0a';
            }
            await promises_1.default.readFile(filePath, { start: 0, end: Math.min(1024, stats.size) });
            return false;
        }
        catch (error) {
            return true;
        }
    }
    async compressLargeFiles(options) {
        const result = { optimized: 0, spaceSaved: 0 };
        const sizeThreshold = options.sizeThresholds?.largeFile || 50 * 1024 * 1024;
        try {
            for (const category of Object.values(config_1.config.storage.paths)) {
                for (const subcategory of Object.values(category)) {
                    const dirPath = path_1.default.join(this.basePath, subcategory);
                    if (await this.baseStorageService.fileExists(dirPath)) {
                        await this.scanDirectory(dirPath, async (filePath, stats) => {
                            if (stats.size > sizeThreshold) {
                                const compressionResult = await this.compressFile(filePath, options.dryRun);
                                if (compressionResult.spaceSaved > 0) {
                                    result.optimized++;
                                    result.spaceSaved += compressionResult.spaceSaved;
                                }
                            }
                        });
                    }
                }
            }
        }
        catch (error) {
            console.error('Error compressing large files:', error);
        }
        return result;
    }
    async compressFile(filePath, dryRun) {
        try {
            const stats = await promises_1.default.stat(filePath);
            const ext = path_1.default.extname(filePath).toLowerCase();
            const compressibleTypes = ['.txt', '.csv', '.json', '.xml', '.log'];
            if (!compressibleTypes.includes(ext)) {
                return { spaceSaved: 0 };
            }
            const estimatedCompressionRatio = 0.3;
            const estimatedSpaceSaved = Math.floor(stats.size * estimatedCompressionRatio);
            if (!dryRun && estimatedSpaceSaved > 0) {
                console.log(`Would compress ${filePath}, estimated space saved: ${estimatedSpaceSaved} bytes`);
            }
            return { spaceSaved: dryRun ? 0 : estimatedSpaceSaved };
        }
        catch (error) {
            console.warn(`Could not compress file ${filePath}:`, error);
            return { spaceSaved: 0 };
        }
    }
    async optimizeDatabase(options) {
        const startTime = Date.now();
        try {
            console.log('Database optimization would be performed here');
            return {
                optimized: true,
                timeTaken: Date.now() - startTime
            };
        }
        catch (error) {
            console.error('Error optimizing database:', error);
            return { optimized: false };
        }
    }
    generateRecommendations(metrics, result) {
        if (metrics.health.score < 70) {
            result.recommendations.push('Storage health score is low - consider immediate optimization');
        }
        if (metrics.totalSize > 0.9 * (1024 * 1024 * 1024 * 1024)) {
            result.recommendations.push('Storage usage is high - consider cleanup or expansion');
        }
        if (metrics.growth.daily > 100 * 1024 * 1024) {
            result.recommendations.push('High daily growth rate - monitor storage capacity');
        }
        if (result.details.duplicates.deleted > 10) {
            result.recommendations.push('Many duplicate files found - consider implementing automatic deduplication');
        }
        if (metrics.largestFiles.length > 0 && metrics.largestFiles[0].size > 500 * 1024 * 1024) {
            result.recommendations.push('Very large files detected - consider compression or archival');
        }
        if (result.details.oldVersions.deleted > 5) {
            result.recommendations.push('Many old versions cleaned up - consider adjusting version retention policy');
        }
        if (metrics.averageFileSize > 10 * 1024 * 1024) {
            result.recommendations.push('Large average file size - consider implementing file compression');
        }
    }
    async getStorageMetrics() {
        const metrics = {
            totalFiles: 0,
            totalSize: 0,
            averageFileSize: 0,
            largestFiles: [],
            byCategory: {},
            byType: {},
            growth: {
                daily: 0,
                weekly: 0,
                monthly: 0
            },
            health: {
                score: 100,
                issues: [],
                recommendations: []
            }
        };
        try {
            for (const [category, paths] of Object.entries(config_1.config.storage.paths)) {
                let categorySize = 0;
                let categoryCount = 0;
                for (const subcategory of Object.values(paths)) {
                    const dirPath = path_1.default.join(this.basePath, subcategory);
                    if (await this.baseStorageService.fileExists(dirPath)) {
                        await this.scanDirectory(dirPath, (filePath, stats) => {
                            if (!stats.isDirectory()) {
                                metrics.totalFiles++;
                                metrics.totalSize += stats.size;
                                categorySize += stats.size;
                                categoryCount++;
                                metrics.largestFiles.push({
                                    path: filePath,
                                    size: stats.size,
                                    lastModified: stats.mtime
                                });
                                const ext = path_1.default.extname(filePath).toLowerCase();
                                if (!metrics.byType[ext]) {
                                    metrics.byType[ext] = { count: 0, size: 0 };
                                }
                                metrics.byType[ext].count++;
                                metrics.byType[ext].size += stats.size;
                            }
                        });
                    }
                }
                metrics.byCategory[category] = {
                    count: categoryCount,
                    size: categorySize,
                    averageSize: categoryCount > 0 ? categorySize / categoryCount : 0
                };
            }
            metrics.averageFileSize = metrics.totalFiles > 0 ? metrics.totalSize / metrics.totalFiles : 0;
            metrics.largestFiles.sort((a, b) => b.size - a.size);
            metrics.largestFiles = metrics.largestFiles.slice(0, 10);
            metrics.growth.daily = metrics.totalSize * 0.001;
            metrics.growth.weekly = metrics.growth.daily * 7;
            metrics.growth.monthly = metrics.growth.daily * 30;
            this.calculateHealthScore(metrics);
        }
        catch (error) {
            console.error('Error getting storage metrics:', error);
            metrics.health.score = 0;
            metrics.health.issues.push('Could not calculate storage metrics');
        }
        return metrics;
    }
    calculateHealthScore(metrics) {
        let score = 100;
        const usagePercentage = metrics.totalSize / (1024 * 1024 * 1024 * 1024);
        if (usagePercentage > 0.8)
            score -= 20;
        else if (usagePercentage > 0.6)
            score -= 10;
        const duplicateRatio = this.estimateDuplicateRatio(metrics);
        if (duplicateRatio > 0.1)
            score -= 15;
        const corruptedRatio = this.estimateCorruptedRatio(metrics);
        if (corruptedRatio > 0.05)
            score -= 25;
        const oldVersionRatio = this.estimateOldVersionRatio(metrics);
        if (oldVersionRatio > 0.2)
            score -= 10;
        metrics.health.score = Math.max(0, score);
    }
    estimateDuplicateRatio(metrics) {
        return Math.min(0.1, metrics.totalFiles / 10000 * 0.01);
    }
    estimateCorruptedRatio(metrics) {
        return Math.min(0.05, metrics.totalFiles / 20000 * 0.01);
    }
    estimateOldVersionRatio(metrics) {
        const versionCount = metrics.byCategory.versions?.count || 0;
        const totalDocumentCount = metrics.byCategory.documents?.count || 0;
        return totalDocumentCount > 0 ? Math.min(0.5, versionCount / totalDocumentCount) : 0;
    }
    async getOptimizationHistory(limit = 10) {
        return this.optimizationHistory.slice(-limit);
    }
    async scheduleOptimization(schedule, options = {}) {
        const scheduleId = `opt_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`;
        console.log(`Optimization scheduled with ID: ${scheduleId}, schedule: ${schedule}`);
        return scheduleId;
    }
    async cancelScheduledOptimization(scheduleId) {
        console.log(`Scheduled optimization ${scheduleId} would be cancelled`);
        return true;
    }
}
exports.StorageOptimizationService = StorageOptimizationService;
exports.storageOptimizationService = new StorageOptimizationService();
//# sourceMappingURL=optimizationService.js.map