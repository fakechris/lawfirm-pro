import { createWorker } from 'tesseract.js';
import { storageService } from '../storage';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  pages: OCRPage[];
  processingTime: number;
}

export interface OCRPage {
  pageNumber: number;
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  type: 'text' | 'table' | 'image';
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text: string;
  confidence: number;
}

export interface OCRProcessingOptions {
  languages?: string[];
  autoRotate?: boolean;
  preserveFormatting?: boolean;
  extractTables?: boolean;
  dpi?: number;
  preprocessing?: ImagePreprocessingOptions;
  batchProcessing?: BatchProcessingOptions;
}

export interface ImagePreprocessingOptions {
  denoise?: boolean;
  despeckle?: boolean;
  normalize?: boolean;
  threshold?: boolean;
  adaptiveThreshold?: boolean;
  contrast?: number;
  brightness?: number;
  sharpen?: boolean;
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  grayscale?: boolean;
  binarize?: boolean;
}

export interface BatchProcessingOptions {
  maxConcurrent?: number;
  retryCount?: number;
  timeout?: number;
  progressCallback?: (progress: number, current: number, total: number) => void;
}

export interface OCRBatchResult {
  results: OCRResult[];
  total: number;
  processed: number;
  failed: number;
  processingTime: number;
  errors: string[];
}

export class OCRService {
  private worker: any = null;
  private workers: any[] = [];
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.worker = await createWorker({
        logger: (m: any) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('OCR Progress:', m);
          }
        },
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw new Error('OCR initialization failed');
    }
  }

  async initializeWorkers(count: number = 4): Promise<void> {
    if (this.workers.length >= count) return;
    
    try {
      const newWorkers = await Promise.all(
        Array(count - this.workers.length).fill(null).map(async () => {
          return await createWorker({
            logger: (m: any) => {
              if (process.env.NODE_ENV === 'development') {
                console.log('OCR Worker Progress:', m);
              }
            },
          });
        })
      );
      
      this.workers.push(...newWorkers);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR workers:', error);
      throw new Error('OCR workers initialization failed');
    }
  }

  private async preprocessImage(
    imageBuffer: Buffer,
    options: ImagePreprocessingOptions = {}
  ): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);

    // Apply grayscale conversion
    if (options.grayscale) {
      pipeline = pipeline.grayscale();
    }

    // Apply resize
    if (options.resize) {
      pipeline = pipeline.resize(
        options.resize.width,
        options.resize.height,
        { fit: options.resize.fit || 'cover' }
      );
    }

    // Apply contrast and brightness adjustments
    if (options.contrast !== undefined || options.brightness !== undefined) {
      pipeline = pipeline.modulate({
        brightness: options.brightness,
        contrast: options.contrast,
      });
    }

    // Apply normalization
    if (options.normalize) {
      pipeline = pipeline.normalize();
    }

    // Apply sharpening
    if (options.sharpen) {
      pipeline = pipeline.sharpen();
    }

    // Apply threshold
    if (options.threshold) {
      pipeline = pipeline.threshold(128);
    }

    // Apply adaptive threshold (requires additional processing)
    if (options.adaptiveThreshold) {
      // Convert to grayscale first if not already
      if (!options.grayscale) {
        pipeline = pipeline.grayscale();
      }
      // Note: Sharp doesn't have built-in adaptive threshold
      // This would require custom implementation or additional library
    }

    // Apply binarization
    if (options.binarize) {
      pipeline = pipeline.threshold(128).toColortype('b-w');
    }

    // Apply denoising (simplified - Sharp doesn't have built-in denoise)
    if (options.denoise) {
      // This would require additional processing or library
      pipeline = pipeline.median(3);
    }

    return await pipeline.toBuffer();
  }

  async processDocument(
    filePath: string,
    options: OCRProcessingOptions = {}
  ): Promise<OCRResult> {
    if (!this.worker) {
      await this.initialize();
    }

    const startTime = Date.now();
    const defaultOptions: OCRProcessingOptions = {
      languages: ['eng', 'chi_sim'],
      autoRotate: true,
      preserveFormatting: true,
      extractTables: false,
      dpi: 300,
      preprocessing: {
        grayscale: true,
        normalize: true,
        contrast: 1.2,
        brightness: 1.1,
      },
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Load the file from storage
      let fileBuffer = await storageService.getFile(filePath);
      
      // Apply image preprocessing if options are provided
      if (finalOptions.preprocessing) {
        fileBuffer = await this.preprocessImage(fileBuffer, finalOptions.preprocessing);
      }
      
      // Set languages for OCR
      await this.worker.loadLanguages(finalOptions.languages || ['eng']);
      await this.worker.initialize(finalOptions.languages?.[0] || 'eng');

      // Recognize text
      const { data: { text, confidence } } = await this.worker.recognize(fileBuffer);

      // Extract pages and blocks (simplified implementation)
      const pages: OCRPage[] = [{
        pageNumber: 1,
        text,
        confidence,
        blocks: this.extractBlocks(text, confidence),
      }];

      const processingTime = Date.now() - startTime;

      return {
        text,
        confidence,
        language: finalOptions.languages?.[0] || 'eng',
        pages,
        processingTime,
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error('Failed to process document with OCR');
    }
  }

  async processBatch(
    filePaths: string[],
    options: OCRProcessingOptions = {}
  ): Promise<OCRBatchResult> {
    const startTime = Date.now();
    const defaultBatchOptions: BatchProcessingOptions = {
      maxConcurrent: 3,
      retryCount: 2,
      timeout: 60000, // 1 minute per document
    };

    const finalOptions = { ...defaultBatchOptions, ...options.batchProcessing };
    const results: OCRResult[] = [];
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    // Initialize workers for concurrent processing
    if (this.workers.length < finalOptions.maxConcurrent!) {
      await this.initializeWorkers(finalOptions.maxConcurrent!);
    }

    const processFile = async (filePath: string, retryCount: number = 0): Promise<OCRResult | null> => {
      try {
        const result = await this.processDocument(filePath, options);
        if (finalOptions.progressCallback) {
          finalOptions.progressCallback(
            (processed + 1) / filePaths.length * 100,
            processed + 1,
            filePaths.length
          );
        }
        return result;
      } catch (error) {
        if (retryCount < finalOptions.retryCount!) {
          console.log(`Retrying ${filePath} (attempt ${retryCount + 1})`);
          return processFile(filePath, retryCount + 1);
        } else {
          throw error;
        }
      }
    };

    // Process files in batches
    const batchSize = finalOptions.maxConcurrent!;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(filePath => 
          Promise.race([
            processFile(filePath),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('OCR timeout')), finalOptions.timeout!)
            )
          ])
        )
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
          processed++;
        } else {
          failed++;
          const error = result.status === 'rejected' ? result.reason : new Error('Unknown error');
          errors.push(`Processing failed: ${error.message}`);
          console.error('Batch processing error:', error);
        }
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      results,
      total: filePaths.length,
      processed,
      failed,
      processingTime,
      errors,
    };
  }

  async extractTextFromImage(
    imageBuffer: Buffer,
    options: OCRProcessingOptions = {}
  ): Promise<string> {
    if (!this.worker) {
      await this.initialize();
    }

    const defaultOptions: OCRProcessingOptions = {
      languages: ['eng', 'chi_sim'],
      autoRotate: true,
      preserveFormatting: false,
      extractTables: false,
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      await this.worker.loadLanguages(finalOptions.languages || ['eng']);
      await this.worker.initialize(finalOptions.languages?.[0] || 'eng');

      const { data: { text } } = await this.worker.recognize(imageBuffer);
      return text;
    } catch (error) {
      console.error('Image OCR failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  async detectLanguage(text: string): Promise<string> {
    // Simple language detection based on character patterns
    const chineseRegex = /[\u4e00-\u9fff]/;
    const englishRegex = /^[a-zA-Z\s\d.,!?;:'"()-]+$/;

    if (chineseRegex.test(text)) {
      return 'chi_sim';
    } else if (englishRegex.test(text)) {
      return 'eng';
    } else {
      return 'eng'; // Default to English
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    
    if (this.workers.length > 0) {
      await Promise.all(this.workers.map(worker => worker.terminate()));
      this.workers = [];
    }
    
    this.isInitialized = false;
  }

  // Additional utility methods
  async getOptimalPreprocessingForImage(imageBuffer: Buffer): Promise<ImagePreprocessingOptions> {
    const metadata = await sharp(imageBuffer).metadata();
    
    const options: ImagePreprocessingOptions = {
      grayscale: true,
      normalize: true,
    };

    // Adjust based on image characteristics
    if (metadata.width && metadata.width < 1000) {
      options.resize = { width: 2000, fit: 'inside' };
    }

    // Add contrast enhancement for low contrast images
    if (metadata.hasAlpha) {
      options.contrast = 1.3;
    }

    return options;
  }

  async autoRotateImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(imageBuffer).rotate().toBuffer();
    } catch (error) {
      console.warn('Auto-rotation failed:', error);
      return imageBuffer;
    }
  }

  async enhanceImageForOCR(imageBuffer: Buffer): Promise<Buffer> {
    const optimalOptions = await this.getOptimalPreprocessingForImage(imageBuffer);
    const preprocessed = await this.preprocessImage(imageBuffer, optimalOptions);
    return await this.autoRotateImage(preprocessed);
  }

  async processDocumentWithAutoEnhancement(
    filePath: string,
    options: OCRProcessingOptions = {}
  ): Promise<OCRResult> {
    const fileBuffer = await storageService.getFile(filePath);
    const enhancedBuffer = await this.enhanceImageForOCR(fileBuffer);
    
    // Save enhanced image temporarily
    const tempPath = `temp/enhanced_${Date.now()}.png`;
    await storageService.saveFile(enhancedBuffer, tempPath, {
      category: 'temp',
      subcategory: 'uploads',
    });

    try {
      return await this.processDocument(tempPath, options);
    } finally {
      // Clean up temporary file
      try {
        await storageService.deleteFile(tempPath);
      } catch (error) {
        console.warn('Failed to cleanup temporary file:', error);
      }
    }
  }

  private extractBlocks(text: string, confidence: number): OCRBlock[] {
    // Simplified block extraction
    // In a real implementation, this would parse the Tesseract output more thoroughly
    const lines = text.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => ({
      type: 'text' as const,
      boundingBox: {
        x: 0,
        y: index * 20, // Approximate line height
        width: line.length * 10, // Approximate character width
        height: 20,
      },
      text: line.trim(),
      confidence,
    }));
  }

  async validateOCRQuality(result: OCRResult): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check confidence
    if (result.confidence < 70) {
      issues.push('Low confidence score');
      suggestions.push('Consider rescanning the document at higher DPI');
    }

    // Check text length
    if (result.text.length < 50) {
      issues.push('Very little text extracted');
      suggestions.push('Check if document is text-based or properly scanned');
    }

    // Check for common OCR errors
    const commonErrors = [
      /\s{2,}/g, // Multiple spaces
      /[0-9]+[oO]/g, // Numbers followed by 'o' instead of '0'
      /[lI|]/g, // Confusion between 'l', 'I', and '|'
    ];

    commonErrors.forEach((error, index) => {
      if (error.test(result.text)) {
        issues.push(`Potential OCR error pattern ${index + 1}`);
        suggestions.push('Manual review recommended');
      }
    });

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  async getSupportedFormats(): Promise<string[]> {
    return [
      'image/png',
      'image/jpeg',
      'image/tiff',
      'image/bmp',
      'application/pdf',
    ];
  }

  async isFormatSupported(mimeType: string): Promise<boolean> {
    const supportedFormats = await this.getSupportedFormats();
    return supportedFormats.includes(mimeType);
  }
}

export const ocrService = new OCRService();