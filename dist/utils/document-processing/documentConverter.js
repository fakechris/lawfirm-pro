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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentConverter = exports.DocumentConverter = void 0;
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const archiver_1 = require("archiver");
const stream_1 = require("stream");
const storage_1 = require("../storage");
class DocumentConverter {
    constructor() {
        this.supportedConversions = new Map([
            ['image/jpeg', ['image/png', 'image/webp', 'image/tiff', 'image/bmp']],
            ['image/png', ['image/jpeg', 'image/webp', 'image/tiff', 'image/bmp']],
            ['image/tiff', ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']],
            ['image/bmp', ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']],
            ['image/webp', ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp']],
            ['application/pdf', ['image/jpeg', 'image/png', 'image/tiff']],
            ['text/plain', ['application/pdf', 'text/html']],
            ['text/html', ['application/pdf', 'text/plain']],
        ]);
    }
    async convertFile(sourcePath, targetFormat, options = {}) {
        const startTime = Date.now();
        try {
            const sourceBuffer = await storage_1.storageService.getFile(sourcePath);
            const sourceFormat = await this.detectMimeType(sourceBuffer, path_1.default.basename(sourcePath));
            if (!this.isConversionSupported(sourceFormat, targetFormat)) {
                throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} is not supported`);
            }
            const convertedBuffer = await this.performConversion(sourceBuffer, sourceFormat, targetFormat, options);
            const originalName = path_1.default.basename(sourcePath, path_1.default.extname(sourcePath));
            const targetName = `${originalName}_converted.${this.getExtensionFromMimeType(targetFormat)}`;
            const { filePath } = await storage_1.storageService.saveFile(convertedBuffer, targetName, {
                category: 'documents',
                subcategory: 'processed',
            });
            const conversionTime = Date.now() - startTime;
            return {
                convertedFile: filePath,
                originalFile: sourcePath,
                conversionTime,
                fileSize: convertedBuffer.length,
                format: targetFormat,
                metadata: await this.extractMetadata(convertedBuffer, targetFormat),
            };
        }
        catch (error) {
            console.error(`Failed to convert file ${sourcePath}:`, error);
            throw new Error(`File conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async convertImage(buffer, sourceFormat, targetFormat, options = {}) {
        const defaultOptions = {
            quality: 85,
            compression: 6,
            width: undefined,
            height: undefined,
            dpi: 300,
            preserveMetadata: true,
        };
        const finalOptions = { ...defaultOptions, ...options };
        let sharpInstance = (0, sharp_1.default)(buffer);
        if (finalOptions.width || finalOptions.height) {
            sharpInstance = sharpInstance.resize(finalOptions.width, finalOptions.height, {
                fit: 'inside',
                withoutEnlargement: true,
            });
        }
        if (finalOptions.dpi) {
            sharpInstance = sharpInstance.withMetadata({ density: finalOptions.dpi });
        }
        switch (targetFormat) {
            case 'image/jpeg':
                return sharpInstance.jpeg({
                    quality: finalOptions.quality || 85,
                    mozjpeg: true,
                }).toBuffer();
            case 'image/png':
                return sharpInstance.png({
                    compressionLevel: finalOptions.compression || 6,
                    adaptiveFiltering: true,
                }).toBuffer();
            case 'image/webp':
                return sharpInstance.webp({
                    quality: finalOptions.quality || 85,
                    lossless: false,
                }).toBuffer();
            case 'image/tiff':
                return sharpInstance.tiff({
                    quality: finalOptions.quality || 85,
                    compression: 'lzw',
                }).toBuffer();
            case 'image/bmp':
                return sharpInstance.bmp().toBuffer();
            default:
                throw new Error(`Unsupported target format: ${targetFormat}`);
        }
    }
    async convertToPdf(buffer, sourceFormat, options = {}) {
        if (sourceFormat === 'text/plain' || sourceFormat === 'text/html') {
            const { PDFDocument } = await Promise.resolve().then(() => __importStar(require('pdf-lib')));
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage();
            const text = buffer.toString('utf8');
            const { width, height } = page.getSize();
            page.drawText(text.substring(0, 1000), {
                x: 50,
                y: height - 50,
                size: 12,
            });
            return Buffer.from(await pdfDoc.save());
        }
        throw new Error(`PDF conversion from ${sourceFormat} is not yet implemented`);
    }
    async createArchive(filePaths, archiveFormat = 'zip', options = {}) {
        return new Promise((resolve, reject) => {
            const output = new stream_1.PassThrough();
            const chunks = [];
            output.on('data', (chunk) => chunks.push(chunk));
            output.on('end', () => resolve(Buffer.concat(chunks)));
            output.on('error', reject);
            const archive = (0, archiver_1.archiver)(archiveFormat, {
                zlib: { level: options.compressionLevel || 6 },
            });
            archive.pipe(output);
            filePaths.forEach(async (filePath) => {
                try {
                    const fileBuffer = await storage_1.storageService.getFile(filePath);
                    const filename = path_1.default.basename(filePath);
                    archive.append(fileBuffer, { name: filename });
                }
                catch (error) {
                    console.error(`Failed to add file ${filePath} to archive:`, error);
                }
            });
            archive.finalize();
        });
    }
    async extractArchive(archivePath, extractTo) {
        const { extractFull } = await Promise.resolve().then(() => __importStar(require('node-unzipper')));
        const archiveBuffer = await storage_1.storageService.getFile(archivePath);
        const extractedFiles = [];
        return new Promise((resolve, reject) => {
            const stream = require('stream');
            const readable = new stream.Readable();
            readable.push(archiveBuffer);
            readable.push(null);
            readable
                .pipe(extractFull({ path: extractTo }))
                .on('entry', (entry) => {
                const filePath = path_1.default.join(extractTo, entry.path);
                extractedFiles.push(filePath);
            })
                .on('finish', () => resolve(extractedFiles))
                .on('error', reject);
        });
    }
    async batchConvert(filePaths, targetFormat, options = {}) {
        const results = [];
        for (const filePath of filePaths) {
            try {
                const result = await this.convertFile(filePath, targetFormat, options);
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to convert ${filePath}:`, error);
            }
        }
        return results;
    }
    async detectMimeType(buffer, filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        const extToMime = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.html': 'text/html',
        };
        return extToMime[ext] || 'application/octet-stream';
    }
    isConversionSupported(sourceFormat, targetFormat) {
        const supportedTargets = this.supportedConversions.get(sourceFormat);
        return supportedTargets?.includes(targetFormat) || false;
    }
    async performConversion(buffer, sourceFormat, targetFormat, options) {
        if (sourceFormat.startsWith('image/') && targetFormat.startsWith('image/')) {
            return this.convertImage(buffer, sourceFormat, targetFormat, options);
        }
        if (targetFormat === 'application/pdf') {
            return this.convertToPdf(buffer, sourceFormat, options);
        }
        throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} is not implemented`);
    }
    getExtensionFromMimeType(mimeType) {
        const mimeToExt = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/tiff': 'tiff',
            'image/bmp': 'bmp',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
            'text/plain': 'txt',
            'text/html': 'html',
        };
        return mimeToExt[mimeType] || 'bin';
    }
    async extractMetadata(buffer, format) {
        try {
            if (format.startsWith('image/')) {
                return await (0, sharp_1.default)(buffer).metadata();
            }
            return {};
        }
        catch (error) {
            return {};
        }
    }
    getSupportedConversions() {
        const conversions = {};
        for (const [source, targets] of this.supportedConversions) {
            conversions[source] = targets;
        }
        return conversions;
    }
    isFormatSupported(format) {
        return this.supportedConversions.has(format);
    }
}
exports.DocumentConverter = DocumentConverter;
exports.documentConverter = new DocumentConverter();
//# sourceMappingURL=documentConverter.js.map