"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchIndexingService = exports.SearchIndexingService = void 0;
const client_1 = require("@prisma/client");
const natural_1 = __importDefault(require("natural"));
const documentProcessor_1 = require("./documentProcessor");
const prisma = new client_1.PrismaClient();
class SearchIndexingService {
    constructor() {
        this.tokenizer = new natural_1.default.SentenceTokenizer();
        this.stemmer = natural_1.default.PorterStemmer;
        this.tfidf = new natural_1.default.TfIdf();
        this.stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
        ]);
    }
    async indexDocument(document, options = {}) {
        const defaultOptions = {
            extractKeywords: true,
            generateSummary: true,
            analyzeSentiment: true,
            extractEntities: true,
            categorizeContent: true,
        };
        const finalOptions = { ...defaultOptions, ...options };
        try {
            const processedContent = await this.processContent(document.content, finalOptions);
            const searchIndex = {
                id: document.id,
                entityId: document.entityId,
                entityType: document.entityType,
                content: document.content,
                processedContent: processedContent.processedText,
                title: document.title,
                metadata: {
                    ...document.metadata,
                    keywords: processedContent.keywords,
                    summary: processedContent.summary,
                    sentiment: processedContent.sentiment,
                    entities: processedContent.entities,
                    category: processedContent.category,
                    language: document.language,
                },
                tags: document.tags,
                vector: await this.generateVector(processedContent.processedText),
                createdAt: document.createdAt,
                updatedAt: document.updatedAt,
            };
            await prisma.searchIndex.upsert({
                where: { id: document.id },
                update: searchIndex,
                create: searchIndex,
            });
            this.tfidf.addDocument(processedContent.processedText, document.id);
        }
        catch (error) {
            console.error(`Failed to index document ${document.id}:`, error);
            throw new Error(`Document indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async search(query) {
        const startTime = Date.now();
        try {
            const processedQuery = this.processSearchQuery(query.query);
            const whereClause = this.buildWhereClause(query.filters, processedQuery);
            const total = await prisma.searchIndex.count({ where: whereClause });
            const pagination = query.pagination || { page: 1, limit: 10 };
            const orderBy = this.buildOrderBy(query.sortBy);
            const documents = await prisma.searchIndex.findMany({
                where: whereClause,
                orderBy,
                skip: (pagination.page - 1) * pagination.limit,
                take: pagination.limit,
            });
            const scoredDocuments = await this.calculateRelevanceScores(documents, processedQuery);
            const facets = await this.generateFacets(whereClause);
            const processingTime = Date.now() - startTime;
            return {
                documents: scoredDocuments,
                total,
                page: pagination.page,
                limit: pagination.limit,
                facets,
                query: query.query,
                processingTime,
            };
        }
        catch (error) {
            console.error('Search failed:', error);
            throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async reindexAllDocuments() {
        try {
            const documents = await prisma.document.findMany({
                include: {
                    uploadedBy: true,
                    case: true,
                    client: true,
                },
            });
            console.log(`Reindexing ${documents.length} documents...`);
            for (const document of documents) {
                try {
                    let content = document.content || document.extractedText || '';
                    if (!content && document.path) {
                        try {
                            const processed = await documentProcessor_1.documentProcessor.processFile(document.path);
                            content = processed.content;
                        }
                        catch (error) {
                            console.warn(`Failed to extract content from document ${document.id}:`, error);
                        }
                    }
                    const searchDocument = {
                        id: document.id,
                        entityId: document.id,
                        entityType: 'document',
                        title: document.originalName,
                        content,
                        metadata: {
                            size: document.size,
                            mimeType: document.mimeType,
                            category: document.category,
                            status: document.status,
                            version: document.version,
                            isConfidential: document.isConfidential,
                            uploadedBy: document.uploadedBy?.username,
                            caseTitle: document.case?.title,
                            clientName: document.client ? `${document.client.firstName} ${document.client.lastName}` : undefined,
                        },
                        tags: document.tags,
                        language: 'zh-CN',
                        createdAt: document.createdAt,
                        updatedAt: document.updatedAt,
                    };
                    await this.indexDocument(searchDocument);
                }
                catch (error) {
                    console.error(`Failed to reindex document ${document.id}:`, error);
                }
            }
            console.log('Reindexing completed');
        }
        catch (error) {
            console.error('Reindexing failed:', error);
            throw new Error(`Reindexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async deleteFromIndex(documentId) {
        try {
            await prisma.searchIndex.delete({
                where: { id: documentId },
            });
        }
        catch (error) {
            console.error(`Failed to delete document ${documentId} from index:`, error);
            throw new Error(`Failed to delete from index: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getSearchSuggestions(query, limit = 10) {
        try {
            const processedQuery = this.processSearchQuery(query);
            const documents = await prisma.searchIndex.findMany({
                where: {
                    OR: [
                        {
                            title: {
                                contains: query,
                                mode: 'insensitive',
                            },
                        },
                        {
                            content: {
                                contains: query,
                                mode: 'insensitive',
                            },
                        },
                        {
                            tags: {
                                hasSome: [query],
                            },
                        },
                    ],
                },
                take: limit * 2,
            });
            const suggestions = new Set();
            for (const doc of documents) {
                const titleWords = doc.title.split(/\s+/).filter(word => word.toLowerCase().includes(query.toLowerCase()));
                titleWords.forEach(word => suggestions.add(word));
                doc.tags.forEach(tag => {
                    if (tag.toLowerCase().includes(query.toLowerCase())) {
                        suggestions.add(tag);
                    }
                });
            }
            return Array.from(suggestions).slice(0, limit);
        }
        catch (error) {
            console.error('Failed to get search suggestions:', error);
            return [];
        }
    }
    async processContent(content, options) {
        const tokens = this.tokenizer.tokenize(content) || [];
        const processedTokens = tokens
            .map(token => token.toLowerCase().trim())
            .filter(token => token.length > 2 && !this.stopWords.has(token))
            .map(token => this.stemmer.stem(token));
        const processedText = processedTokens.join(' ');
        const keywords = options.extractKeywords ? this.extractKeywords(processedText) : [];
        const summary = options.generateSummary ? this.generateSummary(content) : '';
        const sentiment = options.analyzeSentiment ? this.analyzeSentiment(content) : 'neutral';
        const entities = options.extractEntities ? this.extractEntities(content) : [];
        const category = options.categorizeContent ? this.categorizeContent(content) : 'general';
        return {
            processedText,
            keywords,
            summary,
            sentiment,
            entities,
            category,
        };
    }
    extractKeywords(text, count = 10) {
        const tfidf = new natural_1.default.TfIdf();
        tfidf.addDocument(text);
        const terms = tfidf.listTerms(0);
        return terms.slice(0, count).map(term => term.term);
    }
    generateSummary(content, maxLength = 200) {
        const sentences = this.tokenizer.tokenize(content) || [];
        if (sentences.length === 0)
            return '';
        let summary = sentences[0];
        for (let i = 1; i < Math.min(sentences.length, 3); i++) {
            if (summary.length + sentences[i].length <= maxLength) {
                summary += ' ' + sentences[i];
            }
            else {
                break;
            }
        }
        return summary;
    }
    analyzeSentiment(content) {
        const analyzer = new natural_1.default.SentimentAnalyzer('English', natural_1.default.PorterStemmer, ['negation']);
        const tokens = natural_1.default.WordTokenizer.prototype.tokenize(content);
        const score = analyzer.getSentiment(tokens);
        if (score > 0.1)
            return 'positive';
        if (score < -0.1)
            return 'negative';
        return 'neutral';
    }
    extractEntities(content) {
        const entities = [];
        const datePattern = /\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4}/g;
        const dates = content.match(datePattern);
        if (dates) {
            entities.push(...dates.map(date => ({ type: 'date', value: date })));
        }
        const moneyPattern = /[\d,]+\.?\d*\s*(元|万|千|百万|亿)/g;
        const amounts = content.match(moneyPattern);
        if (amounts) {
            entities.push(...amounts.map(amount => ({ type: 'amount', value: amount })));
        }
        return entities;
    }
    categorizeContent(content) {
        const legalKeywords = {
            'contract': ['合同', '协议', 'Agreement', 'Contract'],
            'lawsuit': ['诉讼', '起诉', 'Lawsuit', 'Litigation'],
            'evidence': ['证据', 'Evidence', 'Exhibit'],
            'judgment': ['判决', '裁定', 'Judgment', 'Order'],
            'legal_opinion': ['法律意见', 'Legal Opinion', 'Memorandum'],
        };
        const contentLower = content.toLowerCase();
        for (const [category, keywords] of Object.entries(legalKeywords)) {
            if (keywords.some(keyword => contentLower.includes(keyword.toLowerCase()))) {
                return category;
            }
        }
        return 'general';
    }
    async generateVector(text) {
        const tokens = text.split(/\s+/).slice(0, 100);
        const vector = new Array(100).fill(0);
        tokens.forEach((token, index) => {
            vector[index % 100] = token.length / 10;
        });
        return vector;
    }
    processSearchQuery(query) {
        return query
            .toLowerCase()
            .trim()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
            .replace(/\s+/g, ' ');
    }
    buildWhereClause(filters, processedQuery) {
        const where = {};
        if (filters?.entityType?.length) {
            where.entityType = { in: filters.entityType };
        }
        if (filters?.tags?.length) {
            where.tags = { hasSome: filters.tags };
        }
        if (filters?.dateRange) {
            where.createdAt = {
                gte: filters.dateRange.start,
                lte: filters.dateRange.end,
            };
        }
        if (filters?.mimeType?.length) {
            where.metadata = {
                path: ['mimeType'],
                in: filters.mimeType,
            };
        }
        if (filters?.sizeRange) {
            where.metadata = {
                path: ['size'],
                gte: filters.sizeRange.min,
                lte: filters.sizeRange.max,
            };
        }
        if (processedQuery) {
            where.OR = [
                { title: { contains: processedQuery, mode: 'insensitive' } },
                { content: { contains: processedQuery, mode: 'insensitive' } },
                { processedContent: { contains: processedQuery, mode: 'insensitive' } },
                { tags: { hasSome: [processedQuery] } },
            ];
        }
        return where;
    }
    buildOrderBy(sortBy) {
        if (!sortBy) {
            return [{ createdAt: 'desc' }];
        }
        switch (sortBy.field) {
            case 'relevance':
                return [{ relevance: sortBy.order }];
            case 'date':
                return [{ createdAt: sortBy.order }];
            case 'title':
                return [{ title: sortBy.order }];
            case 'size':
                return [{ metadata: { path: ['size'], sort: sortBy.order } }];
            default:
                return [{ createdAt: 'desc' }];
        }
    }
    async calculateRelevanceScores(documents, processedQuery) {
        if (!processedQuery) {
            return documents.map(doc => ({
                id: doc.id,
                entityId: doc.entityId,
                entityType: doc.entityType,
                title: doc.title,
                content: doc.content,
                metadata: doc.metadata,
                tags: doc.tags,
                language: doc.metadata.language,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            }));
        }
        return documents.map(doc => {
            let score = 0;
            if (doc.title.toLowerCase().includes(processedQuery.toLowerCase())) {
                score += 10;
            }
            if (doc.content.toLowerCase().includes(processedQuery.toLowerCase())) {
                score += 5;
            }
            if (doc.tags.some((tag) => tag.toLowerCase().includes(processedQuery.toLowerCase()))) {
                score += 8;
            }
            if (doc.metadata.keywords?.some((keyword) => keyword.toLowerCase().includes(processedQuery.toLowerCase()))) {
                score += 7;
            }
            return {
                id: doc.id,
                entityId: doc.entityId,
                entityType: doc.entityType,
                title: doc.title,
                content: doc.content,
                metadata: { ...doc.metadata, relevanceScore: score },
                tags: doc.tags,
                language: doc.metadata.language,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            };
        }).sort((a, b) => (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0));
    }
    async generateFacets(whereClause) {
        const entityTypes = await prisma.searchIndex.groupBy({
            by: ['entityType'],
            where: whereClause,
            _count: { entityType: true },
        });
        const entityTypeFacets = {};
        entityTypes.forEach(item => {
            entityTypeFacets[item.entityType] = item._count.entityType;
        });
        const dateRange = await prisma.searchIndex.aggregate({
            where: whereClause,
            _min: { createdAt: true },
            _max: { createdAt: true },
        });
        return {
            entityType: entityTypeFacets,
            tags: {},
            mimeType: {},
            dateRange: {
                min: dateRange._min.createdAt || new Date(),
                max: dateRange._max.createdAt || new Date(),
            },
        };
    }
}
exports.SearchIndexingService = SearchIndexingService;
exports.searchIndexingService = new SearchIndexingService();
//# sourceMappingURL=searchIndexingService.js.map