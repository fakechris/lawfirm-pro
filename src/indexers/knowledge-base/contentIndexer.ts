import { PrismaClient } from '@prisma/client';
import { knowledgeSearchEngine, KnowledgeSearchDocument, KnowledgeIndexingOptions } from '../search/knowledgeSearchEngine';
import { documentProcessor } from '../../documents/documentProcessor';

const prisma = new PrismaClient();

export interface ContentProcessor {
  canProcess(contentType: string): boolean;
  process(content: string, options?: any): Promise<ProcessedContent>;
}

export interface ProcessedContent {
  text: string;
  metadata: Record<string, any>;
  structure?: ContentStructure;
}

export interface ContentStructure {
  sections: ContentSection[];
  headings: string[];
  links: string[];
  tables: TableData[];
  images: ImageData[];
}

export interface ContentSection {
  title: string;
  content: string;
  level: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface ImageData {
  src: string;
  alt: string;
  caption?: string;
}

export class DocumentContentProcessor implements ContentProcessor {
  canProcess(contentType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/html',
      'application/json',
    ];
    return supportedTypes.includes(contentType);
  }

  async process(content: string, options?: any): Promise<ProcessedContent> {
    try {
      // Use existing document processor
      const processed = await documentProcessor.processText(content);
      
      return {
        text: processed.content,
        metadata: {
          ...processed.metadata,
          wordCount: processed.content.split(/\s+/).length,
          characterCount: processed.content.length,
          language: 'zh-CN', // Default to Chinese
        },
      };
    } catch (error) {
      console.error('Document processing failed:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class HTMLContentProcessor implements ContentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'text/html' || contentType === 'application/xhtml+xml';
  }

  async process(content: string, options?: any): Promise<ProcessedContent> {
    try {
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(content);
      const document = dom.window.document;

      // Extract text content
      const text = document.body?.textContent || '';
      
      // Extract structure
      const structure: ContentStructure = {
        sections: this.extractSections(document),
        headings: this.extractHeadings(document),
        links: this.extractLinks(document),
        tables: this.extractTables(document),
        images: this.extractImages(document),
      };

      // Extract metadata
      const metadata = {
        title: document.title,
        description: this.getMetaContent(document, 'description'),
        keywords: this.getMetaContent(document, 'keywords'),
        author: this.getMetaContent(document, 'author'),
        language: document.documentElement.lang || 'zh-CN',
        wordCount: text.split(/\s+/).length,
        characterCount: text.length,
      };

      return {
        text,
        metadata,
        structure,
      };
    } catch (error) {
      console.error('HTML processing failed:', error);
      throw new Error(`Failed to process HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractSections(document: Document): ContentSection[] {
    const sections: ContentSection[] = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headingElements.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      const title = heading.textContent || '';
      
      // Get content until next heading
      let content = '';
      let nextElement = heading.nextElementSibling;
      
      while (nextElement && !/^H[1-6]$/.test(nextElement.tagName)) {
        content += nextElement.textContent + '\n';
        nextElement = nextElement.nextElementSibling;
      }
      
      if (title.trim()) {
        sections.push({ title, content: content.trim(), level });
      }
    });
    
    return sections;
  }

  private extractHeadings(document: Document): string[] {
    const headings: string[] = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headingElements.forEach(heading => {
      const text = heading.textContent?.trim();
      if (text) {
        headings.push(text);
      }
    });
    
    return headings;
  }

  private extractLinks(document: Document): string[] {
    const links: string[] = [];
    const linkElements = document.querySelectorAll('a[href]');
    
    linkElements.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      if (href && text) {
        links.push(`${text} (${href})`);
      }
    });
    
    return links;
  }

  private extractTables(document: Document): TableData[] {
    const tables: TableData[] = [];
    const tableElements = document.querySelectorAll('table');
    
    tableElements.forEach(table => {
      const headers: string[] = [];
      const rows: string[][] = [];
      
      // Extract headers
      const headerRow = table.querySelector('tr');
      if (headerRow) {
        const headerCells = headerRow.querySelectorAll('th, td');
        headerCells.forEach(cell => {
          headers.push(cell.textContent?.trim() || '');
        });
      }
      
      // Extract data rows
      const dataRows = table.querySelectorAll('tr:not(:first-child)');
      dataRows.forEach(row => {
        const rowData: string[] = [];
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
          rowData.push(cell.textContent?.trim() || '');
        });
        if (rowData.length > 0) {
          rows.push(rowData);
        }
      });
      
      const caption = table.querySelector('caption')?.textContent?.trim();
      
      if (headers.length > 0 && rows.length > 0) {
        tables.push({ headers, rows, caption });
      }
    });
    
    return tables;
  }

  private extractImages(document: Document): ImageData[] {
    const images: ImageData[] = [];
    const imageElements = document.querySelectorAll('img');
    
    imageElements.forEach(img => {
      const src = img.getAttribute('src');
      const alt = img.getAttribute('alt') || '';
      const caption = img.parentElement?.querySelector('figcaption')?.textContent?.trim();
      
      if (src) {
        images.push({ src, alt, caption });
      }
    });
    
    return images;
  }

  private getMetaContent(document: Document, name: string): string {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta?.getAttribute('content') || '';
  }
}

export class MarkdownContentProcessor implements ContentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'text/markdown' || contentType === 'text/x-markdown';
  }

  async process(content: string, options?: any): Promise<ProcessedContent> {
    try {
      const { marked } = await import('marked');
      const html = marked(content);
      
      // Process as HTML
      const htmlProcessor = new HTMLContentProcessor();
      const result = await htmlProcessor.process(html);
      
      // Add markdown-specific metadata
      result.metadata.format = 'markdown';
      
      return result;
    } catch (error) {
      console.error('Markdown processing failed:', error);
      throw new Error(`Failed to process markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class JSONContentProcessor implements ContentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'application/json' || contentType === 'text/json';
  }

  async process(content: string, options?: any): Promise<ProcessedContent> {
    try {
      const data = JSON.parse(content);
      const text = JSON.stringify(data, null, 2);
      
      // Extract structure from JSON
      const structure = this.extractJSONStructure(data);
      
      return {
        text,
        metadata: {
          format: 'json',
          dataType: Array.isArray(data) ? 'array' : 'object',
          keys: this.extractKeys(data),
          depth: this.calculateDepth(data),
        },
        structure,
      };
    } catch (error) {
      console.error('JSON processing failed:', error);
      throw new Error(`Failed to process JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractJSONStructure(data: any): ContentStructure {
    const sections: ContentSection[] = [];
    
    const traverse = (obj: any, path: string = '', depth: number = 0) => {
      if (depth > 5) return; // Limit depth
      
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string') {
            sections.push({
              title: currentPath,
              content: value,
              level: depth,
            });
          } else if (typeof value === 'object' && value !== null) {
            traverse(value, currentPath, depth + 1);
          }
        });
      }
    };
    
    traverse(data);
    
    return {
      sections,
      headings: sections.map(s => s.title),
      links: [],
      tables: [],
      images: [],
    };
  }

  private extractKeys(data: any): string[] {
    const keys = new Set<string>();
    
    const traverse = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          keys.add(key);
          traverse(obj[key]);
        });
      }
    };
    
    traverse(data);
    return Array.from(keys);
  }

  private calculateDepth(data: any): number {
    const traverse = (obj: any, depth: number = 0): number => {
      if (typeof obj !== 'object' || obj === null) return depth;
      
      let maxDepth = depth;
      Object.values(obj).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          maxDepth = Math.max(maxDepth, traverse(value, depth + 1));
        }
      });
      
      return maxDepth;
    };
    
    return traverse(data);
  }
}

export class KnowledgeBaseContentIndexer {
  private processors: ContentProcessor[] = [];

  constructor() {
    this.processors = [
      new HTMLContentProcessor(),
      new MarkdownContentProcessor(),
      new JSONContentProcessor(),
      new DocumentContentProcessor(),
    ];
  }

  async indexContent(
    entityId: string,
    entityType: string,
    content: string,
    metadata: Record<string, any>,
    options: KnowledgeIndexingOptions = {}
  ): Promise<void> {
    try {
      // Get appropriate processor
      const processor = this.getProcessor(metadata.contentType || 'text/plain');
      
      // Process content
      const processedContent = await processor.process(content, options);
      
      // Create search document
      const searchDocument: KnowledgeSearchDocument = {
        id: entityId,
        entityId,
        entityType: entityType as any,
        title: metadata.title || 'Untitled',
        content: processedContent.text,
        tags: metadata.tags || [],
        categories: metadata.categories || [],
        language: processedContent.metadata.language || 'zh-CN',
        accessLevel: metadata.accessLevel || 'INTERNAL',
        authorId: metadata.authorId,
        metadata: {
          ...metadata,
          ...processedContent.metadata,
          structure: processedContent.structure,
          processedAt: new Date(),
        },
        createdAt: metadata.createdAt || new Date(),
        updatedAt: metadata.updatedAt || new Date(),
      };

      // Index with search engine
      await knowledgeSearchEngine.indexKnowledgeDocument(searchDocument, options);

      console.log(`Successfully indexed ${entityType} ${entityId}`);
    } catch (error) {
      console.error(`Failed to index content for ${entityType} ${entityId}:`, error);
      throw error;
    }
  }

  async batchIndexContent(
    items: Array<{
      entityId: string;
      entityType: string;
      content: string;
      metadata: Record<string, any>;
    }>,
    options: KnowledgeIndexingOptions = {}
  ): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
    const success: string[] = [];
    const failed: { id: string; error: string }[] = [];

    console.log(`Starting batch indexing of ${items.length} items...`);

    for (const item of items) {
      try {
        await this.indexContent(
          item.entityId,
          item.entityType,
          item.content,
          item.metadata,
          options
        );
        success.push(item.entityId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ id: item.entityId, error: errorMessage });
        console.error(`Failed to index item ${item.entityId}:`, error);
      }
    }

    console.log(`Batch indexing completed: ${success.length} successful, ${failed.length} failed`);
    return { success, failed };
  }

  async reindexEntityType(entityType: string, options: KnowledgeIndexingOptions = {}): Promise<void> {
    try {
      console.log(`Starting reindexing of entity type: ${entityType}`);

      let items: Array<{
        entityId: string;
        content: string;
        metadata: Record<string, any>;
      }> = [];

      switch (entityType) {
        case 'knowledge_article':
          const articles = await prisma.knowledgeBaseArticle.findMany({
            where: { status: 'PUBLISHED' },
          });
          items = articles.map(article => ({
            entityId: article.id,
            content: article.content,
            metadata: {
              title: article.title,
              tags: article.tags,
              categories: article.categories,
              contentType: article.contentType,
              accessLevel: article.accessLevel,
              authorId: article.authorId,
              language: article.language,
              summary: article.summary,
              slug: article.slug,
              status: article.status,
              publishedAt: article.publishedAt,
              viewCount: article.viewCount,
              likeCount: article.likeCount,
              isFeatured: article.isFeatured,
              createdAt: article.createdAt,
              updatedAt: article.updatedAt,
            },
          }));
          break;

        case 'document':
          const documents = await prisma.document.findMany({
            where: { status: 'ACTIVE' },
          });
          items = documents.map(document => ({
            entityId: document.id,
            content: document.content || document.extractedText || '',
            metadata: {
              title: document.originalName,
              tags: document.tags,
              categories: [document.category],
              contentType: document.mimeType,
              accessLevel: document.isConfidential ? 'CONFIDENTIAL' : 'INTERNAL',
              authorId: document.uploadedById,
              language: 'zh-CN',
              size: document.size,
              category: document.category,
              status: document.status,
              version: document.version,
              isConfidential: document.isConfidential,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            },
          }));
          break;

        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }

      const result = await this.batchIndexContent(
        items.map(item => ({ ...item, entityType })),
        options
      );

      console.log(`Reindexing completed for ${entityType}: ${result.success.length} successful, ${result.failed.length} failed`);
    } catch (error) {
      console.error(`Failed to reindex entity type ${entityType}:`, error);
      throw error;
    }
  }

  private getProcessor(contentType: string): ContentProcessor {
    const processor = this.processors.find(p => p.canProcess(contentType));
    if (!processor) {
      throw new Error(`No processor found for content type: ${contentType}`);
    }
    return processor;
  }
}

export const knowledgeBaseContentIndexer = new KnowledgeBaseContentIndexer();