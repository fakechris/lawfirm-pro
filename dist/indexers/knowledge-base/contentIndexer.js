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
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeBaseContentIndexer = exports.KnowledgeBaseContentIndexer = exports.JSONContentProcessor = exports.MarkdownContentProcessor = exports.HTMLContentProcessor = exports.DocumentContentProcessor = void 0;
const client_1 = require("@prisma/client");
const knowledgeSearchEngine_1 = require("../search/knowledgeSearchEngine");
const documentProcessor_1 = require("../../documents/documentProcessor");
const prisma = new client_1.PrismaClient();
class DocumentContentProcessor {
    canProcess(contentType) {
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
    async process(content, options) {
        try {
            const processed = await documentProcessor_1.documentProcessor.processText(content);
            return {
                text: processed.content,
                metadata: {
                    ...processed.metadata,
                    wordCount: processed.content.split(/\s+/).length,
                    characterCount: processed.content.length,
                    language: 'zh-CN',
                },
            };
        }
        catch (error) {
            console.error('Document processing failed:', error);
            throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.DocumentContentProcessor = DocumentContentProcessor;
class HTMLContentProcessor {
    canProcess(contentType) {
        return contentType === 'text/html' || contentType === 'application/xhtml+xml';
    }
    async process(content, options) {
        try {
            const { JSDOM } = await Promise.resolve().then(() => __importStar(require('jsdom')));
            const dom = new JSDOM(content);
            const document = dom.window.document;
            const text = document.body?.textContent || '';
            const structure = {
                sections: this.extractSections(document),
                headings: this.extractHeadings(document),
                links: this.extractLinks(document),
                tables: this.extractTables(document),
                images: this.extractImages(document),
            };
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
        }
        catch (error) {
            console.error('HTML processing failed:', error);
            throw new Error(`Failed to process HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    extractSections(document) {
        const sections = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headingElements.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            const title = heading.textContent || '';
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
    extractHeadings(document) {
        const headings = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headingElements.forEach(heading => {
            const text = heading.textContent?.trim();
            if (text) {
                headings.push(text);
            }
        });
        return headings;
    }
    extractLinks(document) {
        const links = [];
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
    extractTables(document) {
        const tables = [];
        const tableElements = document.querySelectorAll('table');
        tableElements.forEach(table => {
            const headers = [];
            const rows = [];
            const headerRow = table.querySelector('tr');
            if (headerRow) {
                const headerCells = headerRow.querySelectorAll('th, td');
                headerCells.forEach(cell => {
                    headers.push(cell.textContent?.trim() || '');
                });
            }
            const dataRows = table.querySelectorAll('tr:not(:first-child)');
            dataRows.forEach(row => {
                const rowData = [];
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
    extractImages(document) {
        const images = [];
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
    getMetaContent(document, name) {
        const meta = document.querySelector(`meta[name="${name}"]`);
        return meta?.getAttribute('content') || '';
    }
}
exports.HTMLContentProcessor = HTMLContentProcessor;
class MarkdownContentProcessor {
    canProcess(contentType) {
        return contentType === 'text/markdown' || contentType === 'text/x-markdown';
    }
    async process(content, options) {
        try {
            const { marked } = await Promise.resolve().then(() => __importStar(require('marked')));
            const html = marked(content);
            const htmlProcessor = new HTMLContentProcessor();
            const result = await htmlProcessor.process(html);
            result.metadata.format = 'markdown';
            return result;
        }
        catch (error) {
            console.error('Markdown processing failed:', error);
            throw new Error(`Failed to process markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.MarkdownContentProcessor = MarkdownContentProcessor;
class JSONContentProcessor {
    canProcess(contentType) {
        return contentType === 'application/json' || contentType === 'text/json';
    }
    async process(content, options) {
        try {
            const data = JSON.parse(content);
            const text = JSON.stringify(data, null, 2);
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
        }
        catch (error) {
            console.error('JSON processing failed:', error);
            throw new Error(`Failed to process JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    extractJSONStructure(data) {
        const sections = [];
        const traverse = (obj, path = '', depth = 0) => {
            if (depth > 5)
                return;
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
                    }
                    else if (typeof value === 'object' && value !== null) {
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
    extractKeys(data) {
        const keys = new Set();
        const traverse = (obj) => {
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
    calculateDepth(data) {
        const traverse = (obj, depth = 0) => {
            if (typeof obj !== 'object' || obj === null)
                return depth;
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
exports.JSONContentProcessor = JSONContentProcessor;
class KnowledgeBaseContentIndexer {
    constructor() {
        this.processors = [];
        this.processors = [
            new HTMLContentProcessor(),
            new MarkdownContentProcessor(),
            new JSONContentProcessor(),
            new DocumentContentProcessor(),
        ];
    }
    async indexContent(entityId, entityType, content, metadata, options = {}) {
        try {
            const processor = this.getProcessor(metadata.contentType || 'text/plain');
            const processedContent = await processor.process(content, options);
            const searchDocument = {
                id: entityId,
                entityId,
                entityType: entityType,
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
            await knowledgeSearchEngine_1.knowledgeSearchEngine.indexKnowledgeDocument(searchDocument, options);
            console.log(`Successfully indexed ${entityType} ${entityId}`);
        }
        catch (error) {
            console.error(`Failed to index content for ${entityType} ${entityId}:`, error);
            throw error;
        }
    }
    async batchIndexContent(items, options = {}) {
        const success = [];
        const failed = [];
        console.log(`Starting batch indexing of ${items.length} items...`);
        for (const item of items) {
            try {
                await this.indexContent(item.entityId, item.entityType, item.content, item.metadata, options);
                success.push(item.entityId);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                failed.push({ id: item.entityId, error: errorMessage });
                console.error(`Failed to index item ${item.entityId}:`, error);
            }
        }
        console.log(`Batch indexing completed: ${success.length} successful, ${failed.length} failed`);
        return { success, failed };
    }
    async reindexEntityType(entityType, options = {}) {
        try {
            console.log(`Starting reindexing of entity type: ${entityType}`);
            let items = [];
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
            const result = await this.batchIndexContent(items.map(item => ({ ...item, entityType })), options);
            console.log(`Reindexing completed for ${entityType}: ${result.success.length} successful, ${result.failed.length} failed`);
        }
        catch (error) {
            console.error(`Failed to reindex entity type ${entityType}:`, error);
            throw error;
        }
    }
    getProcessor(contentType) {
        const processor = this.processors.find(p => p.canProcess(contentType));
        if (!processor) {
            throw new Error(`No processor found for content type: ${contentType}`);
        }
        return processor;
    }
}
exports.KnowledgeBaseContentIndexer = KnowledgeBaseContentIndexer;
exports.knowledgeBaseContentIndexer = new KnowledgeBaseContentIndexer();
//# sourceMappingURL=contentIndexer.js.map