"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
class StorageService {
    constructor() {
        this.basePath = config_1.config.storage.basePath;
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
        const random = crypto_1.default.randomBytes(8).toString('hex');
        return `${timestamp}-${random}${ext}`;
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
    async saveFile(fileBuffer, originalName, options) {
        const filename = options.filename || this.generateUniqueFilename(originalName);
        const directory = this.getStoragePath(options);
        const filePath = path_1.default.join(directory, filename);
        await this.ensureDirectoryExists(directory);
        await promises_1.default.writeFile(filePath, fileBuffer);
        return {
            filePath,
            filename,
            size: fileBuffer.length
        };
    }
    async getFile(filePath) {
        try {
            return await promises_1.default.readFile(filePath);
        }
        catch (error) {
            throw new Error(`File not found: ${filePath}`);
        }
    }
    async deleteFile(filePath) {
        try {
            await promises_1.default.unlink(filePath);
        }
        catch (error) {
            throw new Error(`Failed to delete file: ${filePath}`);
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
        const stats = await promises_1.default.stat(filePath);
        return stats.size;
    }
    async copyFile(sourcePath, destinationPath) {
        await this.ensureDirectoryExists(path_1.default.dirname(destinationPath));
        await promises_1.default.copyFile(sourcePath, destinationPath);
    }
    async moveFile(sourcePath, destinationPath) {
        await this.ensureDirectoryExists(path_1.default.dirname(destinationPath));
        await promises_1.default.rename(sourcePath, destinationPath);
    }
    calculateChecksum(buffer) {
        return crypto_1.default.createHash('sha256').update(buffer).digest('hex');
    }
    async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) {
        const tempDir = path_1.default.join(this.basePath, config_1.config.storage.paths.temp.uploads);
        const now = Date.now();
        try {
            const files = await promises_1.default.readdir(tempDir);
            for (const file of files) {
                const filePath = path_1.default.join(tempDir, file);
                const stats = await promises_1.default.stat(filePath);
                if (now - stats.mtime.getTime() > maxAge) {
                    await promises_1.default.unlink(filePath);
                }
            }
        }
        catch (error) {
            console.warn('Failed to cleanup temp files:', error);
        }
    }
    validateMimeType(mimeType) {
        return config_1.config.storage.allowedMimeTypes.includes(mimeType);
    }
    validateFileSize(size) {
        return size <= config_1.config.storage.maxFileSize;
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
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
//# sourceMappingURL=index.js.map