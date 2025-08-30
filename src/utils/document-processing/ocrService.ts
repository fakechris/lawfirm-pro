import { createWorker } from 'tesseract.js';
import { storageService } from '../storage';
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
}

export class OCRService {
  private worker: any = null;

  async initialize(): Promise<void> {
    try {
      this.worker = await createWorker({
        logger: (m: any) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('OCR Progress:', m);
          }
        },
      });
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw new Error('OCR initialization failed');
    }
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
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Load the file from storage
      const fileBuffer = await storageService.getFile(filePath);
      
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
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.processDocument(filePath, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process ${filePath}:`, error);
        results.push({
          text: '',
          confidence: 0,
          language: '',
          pages: [],
          processingTime: 0,
        });
      }
    }

    return results;
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