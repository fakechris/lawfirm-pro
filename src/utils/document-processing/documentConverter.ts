import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { archiver } from 'archiver';
import { PassThrough } from 'stream';
import { storageService } from '../storage';

export interface ConversionOptions {
  quality?: number;
  compression?: number;
  format?: string;
  width?: number;
  height?: number;
  dpi?: number;
  preserveMetadata?: boolean;
}

export interface ConversionResult {
  convertedFile: string;
  originalFile: string;
  conversionTime: number;
  fileSize: number;
  format: string;
  metadata?: any;
}

export class DocumentConverter {
  private supportedConversions = new Map([
    ['image/jpeg', ['image/png', 'image/webp', 'image/tiff', 'image/bmp']],
    ['image/png', ['image/jpeg', 'image/webp', 'image/tiff', 'image/bmp']],
    ['image/tiff', ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']],
    ['image/bmp', ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']],
    ['image/webp', ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp']],
    ['application/pdf', ['image/jpeg', 'image/png', 'image/tiff']],
    ['text/plain', ['application/pdf', 'text/html']],
    ['text/html', ['application/pdf', 'text/plain']],
  ]);

  async convertFile(
    sourcePath: string,
    targetFormat: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    
    try {
      const sourceBuffer = await storageService.getFile(sourcePath);
      const sourceFormat = await this.detectMimeType(sourceBuffer, path.basename(sourcePath));
      
      if (!this.isConversionSupported(sourceFormat, targetFormat)) {
        throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} is not supported`);
      }

      const convertedBuffer = await this.performConversion(sourceBuffer, sourceFormat, targetFormat, options);
      
      // Save converted file
      const originalName = path.basename(sourcePath, path.extname(sourcePath));
      const targetName = `${originalName}_converted.${this.getExtensionFromMimeType(targetFormat)}`;
      
      const { filePath } = await storageService.saveFile(
        convertedBuffer,
        targetName,
        {
          category: 'documents',
          subcategory: 'processed',
        }
      );

      const conversionTime = Date.now() - startTime;

      return {
        convertedFile: filePath,
        originalFile: sourcePath,
        conversionTime,
        fileSize: convertedBuffer.length,
        format: targetFormat,
        metadata: await this.extractMetadata(convertedBuffer, targetFormat),
      };
    } catch (error) {
      console.error(`Failed to convert file ${sourcePath}:`, error);
      throw new Error(`File conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async convertImage(
    buffer: Buffer,
    sourceFormat: string,
    targetFormat: string,
    options: ConversionOptions = {}
  ): Promise<Buffer> {
    const defaultOptions: ConversionOptions = {
      quality: 85,
      compression: 6,
      width: undefined,
      height: undefined,
      dpi: 300,
      preserveMetadata: true,
    };

    const finalOptions = { ...defaultOptions, ...options };

    let sharpInstance = sharp(buffer);

    // Resize if dimensions are specified
    if (finalOptions.width || finalOptions.height) {
      sharpInstance = sharpInstance.resize(finalOptions.width, finalOptions.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Set DPI if specified
    if (finalOptions.dpi) {
      sharpInstance = sharpInstance.withMetadata({ density: finalOptions.dpi });
    }

    // Convert to target format
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

  async convertToPdf(
    buffer: Buffer,
    sourceFormat: string,
    options: ConversionOptions = {}
  ): Promise<Buffer> {
    // This is a simplified implementation
    // In a real implementation, you would use libraries like pdfkit or jsPDF
    
    if (sourceFormat === 'text/plain' || sourceFormat === 'text/html') {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const text = buffer.toString('utf8');
      
      // Add text to PDF (simplified)
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

  async createArchive(
    filePaths: string[],
    archiveFormat: 'zip' | 'tar' | '7z' = 'zip',
    options: { compressionLevel?: number; password?: string } = {}
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const output = new PassThrough();
      const chunks: Buffer[] = [];

      output.on('data', (chunk) => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', reject);

      const archive = archiver(archiveFormat, {
        zlib: { level: options.compressionLevel || 6 },
      });

      archive.pipe(output);

      // Add files to archive
      filePaths.forEach(async (filePath) => {
        try {
          const fileBuffer = await storageService.getFile(filePath);
          const filename = path.basename(filePath);
          archive.append(fileBuffer, { name: filename });
        } catch (error) {
          console.error(`Failed to add file ${filePath} to archive:`, error);
        }
      });

      archive.finalize();
    });
  }

  async extractArchive(
    archivePath: string,
    extractTo: string
  ): Promise<string[]> {
    const { extractFull } = await import('node-unzipper');
    const archiveBuffer = await storageService.getFile(archivePath);
    
    const extractedFiles: string[] = [];
    
    return new Promise((resolve, reject) => {
      const stream = require('stream');
      const readable = new stream.Readable();
      readable.push(archiveBuffer);
      readable.push(null);
      
      readable
        .pipe(extractFull({ path: extractTo }))
        .on('entry', (entry: any) => {
          const filePath = path.join(extractTo, entry.path);
          extractedFiles.push(filePath);
        })
        .on('finish', () => resolve(extractedFiles))
        .on('error', reject);
    });
  }

  async batchConvert(
    filePaths: string[],
    targetFormat: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.convertFile(filePath, targetFormat, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to convert ${filePath}:`, error);
        // Continue with other files
      }
    }
    
    return results;
  }

  private async detectMimeType(buffer: Buffer, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();
    
    const extToMime: Record<string, string> = {
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

  private isConversionSupported(sourceFormat: string, targetFormat: string): boolean {
    const supportedTargets = this.supportedConversions.get(sourceFormat);
    return supportedTargets?.includes(targetFormat) || false;
  }

  private async performConversion(
    buffer: Buffer,
    sourceFormat: string,
    targetFormat: string,
    options: ConversionOptions
  ): Promise<Buffer> {
    if (sourceFormat.startsWith('image/') && targetFormat.startsWith('image/')) {
      return this.convertImage(buffer, sourceFormat, targetFormat, options);
    }
    
    if (targetFormat === 'application/pdf') {
      return this.convertToPdf(buffer, sourceFormat, options);
    }
    
    throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} is not implemented`);
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
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

  private async extractMetadata(buffer: Buffer, format: string): Promise<any> {
    try {
      if (format.startsWith('image/')) {
        return await sharp(buffer).metadata();
      }
      return {};
    } catch (error) {
      return {};
    }
  }

  getSupportedConversions(): Record<string, string[]> {
    const conversions: Record<string, string[]> = {};
    for (const [source, targets] of this.supportedConversions) {
      conversions[source] = targets;
    }
    return conversions;
  }

  isFormatSupported(format: string): boolean {
    return this.supportedConversions.has(format);
  }
}

export const documentConverter = new DocumentConverter();