"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeSearchEngine = exports.KnowledgeSearchEngine = void 0;
const client_1 = require("@prisma/client");
const natural_1 = __importDefault(require("natural"));
const nodejieba_1 = require("nodejieba");
const prisma = new client_1.PrismaClient();
class KnowledgeSearchEngine {
    constructor() {
        this.stemmer = natural_1.default.PorterStemmer;
        this.tfidf = new natural_1.default.TfIdf();
        this.stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
            '那', '他', '她', '它', '们', '这', '那', '些', '什么', '怎么', '为什么', '哪里', '谁', '多少', '几'
        ]);
        this.legalKeywords = new Set([
            '合同', '协议', '诉讼', '起诉', '判决', '裁定', '证据', '当事人', '律师', '法庭', '法院',
            '法律', '法规', '条例', '司法解释', '案例', '判例', '原告', '被告', '第三人', '代理人',
            '管辖权', '时效', '执行', '上诉', '再审', '仲裁', '调解', '和解', '赔偿', '违约', '侵权',
            '犯罪', '刑罚', '有期徒刑', '罚金', '没收财产', '缓刑', '假释', '减刑', '保释',
            'contract', 'agreement', 'lawsuit', 'litigation', 'judgment', 'ruling', 'evidence', 'party',
            'lawyer', 'attorney', 'court', 'tribunal', 'law', 'regulation', 'case', 'precedent',
            'plaintiff', 'defendant', 'jurisdiction', 'statute', 'appeal', 'arbitration', 'mediation'
        ]);
    }
    async indexKnowledgeDocument(document, options = {}) {
        const defaultOptions = {
            extractKeywords: true,
            generateSummary: true,
            categorizeContent: true,
            analyzeReadability: true,
            extractLegalEntities: true,
            generateEmbeddings: true,
        };
        const finalOptions = { ...defaultOptions, ...options };
        try {
            const processedContent = await this.processKnowledgeContent(document.content, finalOptions);
            const searchIndex = {
                id: document.id,
                entityId: document.entityId,
                entityType: document.entityType,
                title: document.title,
                content: document.content,
                processedContent: processedContent.processedText,
                tags: document.tags,
                vector: await this.generateEmbeddings(processedContent.processedText),
                metadata: {
                    ...document.metadata,
                    summary: document.summary || processedContent.summary,
                    keywords: processedContent.keywords,
                    categories: document.categories,
                    contentType: document.contentType,
                    accessLevel: document.accessLevel,
                    authorId: document.authorId,
                    language: document.language,
                    readabilityScore: processedContent.readabilityScore,
                    legalEntities: processedContent.legalEntities,
                    contentLength: document.content.length,
                },
                language: document.language,
                relevanceScore: 0,
                viewCount: 0,
                isPublished: true,
                accessLevel: document.accessLevel,
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
            console.error(`Failed to index knowledge document ${document.id}:`, error);
            throw new Error(`Knowledge document indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async searchKnowledge(query) {
        const startTime = Date.now();
        try {
            const processedQuery = this.processKnowledgeQuery(query.query);
            const whereClause = await this.buildKnowledgeWhereClause(query.filters, processedQuery);
            const total = await prisma.searchIndex.count({ where: whereClause });
            const pagination = query.pagination || { page: 1, limit: 10 };
            const orderBy = this.buildKnowledgeOrderBy(query.sortBy);
            const documents = await prisma.searchIndex.findMany({
                where: whereClause,
                orderBy,
                skip: (pagination.page - 1) * pagination.limit,
                take: pagination.limit,
            });
            const scoredDocuments = await this.calculateKnowledgeRelevanceScores(documents, processedQuery);
            const facets = await this.generateKnowledgeFacets(whereClause);
            const suggestions = await this.getKnowledgeSuggestions(query.query);
            await this.logSearchAnalytics(query, total, Date.now() - startTime);
            const processingTime = Date.now() - startTime;
            return {
                documents: scoredDocuments,
                total,
                page: pagination.page,
                limit: pagination.limit,
                facets,
                query: query.query,
                processingTime,
                suggestions,
            };
        }
        catch (error) {
            console.error('Knowledge search failed:', error);
            throw new Error(`Knowledge search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async reindexKnowledgeContent() {
        try {
            const articles = await prisma.knowledgeBaseArticle.findMany({
                include: {
                    author: true,
                    reviewer: true,
                },
            });
            console.log(`Reindexing ${articles.length} knowledge base articles...`);
            for (const article of articles) {
                try {
                    const searchDocument = {
                        id: article.id,
                        entityId: article.id,
                        entityType: 'knowledge_article',
                        title: article.title,
                        content: article.content,
                        summary: article.summary,
                        tags: article.tags,
                        categories: article.categories,
                        language: article.language,
                        contentType: article.contentType,
                        accessLevel: article.accessLevel,
                        authorId: article.authorId,
                        metadata: {
                            slug: article.slug,
                            status: article.status,
                            publishedAt: article.publishedAt,
                            viewCount: article.viewCount,
                            likeCount: article.likeCount,
                            isFeatured: article.isFeatured,
                            authorName: `${article.author.firstName} ${article.author.lastName}`,
                            reviewerName: article.reviewer ? `${article.reviewer.firstName} ${article.reviewer.lastName}` : undefined,
                        },
                        createdAt: article.createdAt,
                        updatedAt: article.updatedAt,
                    };
                    await this.indexKnowledgeDocument(searchDocument);
                }
                catch (error) {
                    console.error(`Failed to reindex knowledge article ${article.id}:`, error);
                }
            }
            console.log('Knowledge base reindexing completed');
        }
        catch (error) {
            console.error('Knowledge base reindexing failed:', error);
            throw new Error(`Knowledge base reindexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getKnowledgeRecommendations(userId, documentId, limit = 5) {
        try {
            const userHistory = await prisma.searchAnalytics.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10,
            });
            const userInterests = this.extractUserInterests(userHistory);
            const whereClause = {
                isPublished: true,
                OR: [
                    ...userInterests.map(interest => ({
                        OR: [
                            { title: { contains: interest, mode: 'insensitive' } },
                            { content: { contains: interest, mode: 'insensitive' } },
                            { tags: { hasSome: [interest] } },
                        ]
                    })),
                    { viewCount: { gte: 10 } },
                    { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                ],
            };
            if (documentId) {
                whereClause.id = { not: documentId };
            }
            const recommendations = await prisma.searchIndex.findMany({
                where: whereClause,
                orderBy: [
                    { viewCount: 'desc' },
                    { createdAt: 'desc' },
                ],
                take: limit * 2,
            });
            const scoredRecommendations = await this.scoreRecommendations(recommendations, userInterests);
            return scoredRecommendations.slice(0, limit);
        }
        catch (error) {
            console.error('Failed to get knowledge recommendations:', error);
            return [];
        }
    }
    async processKnowledgeContent(content, options) {
        const chineseTokens = nodejieba_1.jieba.cut(content, true);
        const chineseText = chineseTokens.join(' ');
        const englishTokens = natural_1.default.WordTokenizer.prototype.tokenize(content) || [];
        const englishText = englishTokens.join(' ');
        const combinedText = `${chineseText} ${englishText}`.toLowerCase();
        const processedTokens = combinedText
            .split(/\s+/)
            .filter(token => token.length > 1 && !this.stopWords.has(token))
            .map(token => this.stemmer.stem(token));
        const processedText = processedTokens.join(' ');
        const keywords = options.extractKeywords ? this.extractLegalKeywords(processedText) : [];
        const summary = options.generateSummary ? this.generateChineseSummary(content) : '';
        const readabilityScore = options.analyzeReadability ? this.analyzeReadability(content) : 0;
        const legalEntities = options.extractLegalEntities ? this.extractLegalEntities(content) : [];
        return {
            processedText,
            keywords,
            summary,
            readabilityScore,
            legalEntities,
        };
    }
    extractLegalKeywords(text, count = 15) {
        const tfidf = new natural_1.default.TfIdf();
        tfidf.addDocument(text);
        const terms = tfidf.listTerms(0);
        const scoredTerms = terms.map(term => ({
            term: term.term,
            score: this.legalKeywords.has(term.term) ? term.tfidf * 1.5 : term.tfidf
        }));
        return scoredTerms
            .sort((a, b) => b.score - a.score)
            .slice(0, count)
            .map(item => item.term);
    }
    generateChineseSummary(content, maxLength = 200) {
        const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
        if (sentences.length === 0)
            return '';
        let summary = sentences[0];
        for (let i = 1; i < Math.min(sentences.length, 3); i++) {
            if (summary.length + sentences[i].length <= maxLength) {
                summary += '。' + sentences[i];
            }
            else {
                break;
            }
        }
        return summary + '。';
    }
    analyzeReadability(content) {
        const avgSentenceLength = content.split(/[。！？.!?]/).reduce((acc, sentence) => acc + sentence.length, 0) / content.split(/[。！？.!?]/).length;
        const complexWords = content.split(/\s+/).filter(word => word.length > 5).length;
        const totalWords = content.split(/\s+/).length;
        return Math.max(0, Math.min(100, 100 - (avgSentenceLength * 2) - (complexWords / totalWords * 50)));
    }
    extractLegalEntities(content) {
        const entities = [];
        const patterns = {
            amount: /[\d,]+\.?\d*\s*(元|万|千|百万|亿|人民币|美元|欧元)/g,
            date: /\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日/g,
            article: /第[一二三四五六七八九十百千万\d]+条/g,
            court: /.*法院/g,
            law: /.*法/g,
        };
        for (const [type, pattern] of Object.entries(patterns)) {
            const matches = content.match(pattern);
            if (matches) {
                entities.push(...matches.map(match => ({ type, value: match })));
            }
        }
        return entities;
    }
    async generateEmbeddings(text) {
        const tokens = text.split(/\s+/).slice(0, 128);
        const vector = new Array(128).fill(0);
        tokens.forEach((token, index) => {
            const hash = this.simpleHash(token);
            vector[index % 128] = hash / 1000;
        });
        return vector;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    processKnowledgeQuery(query) {
        const chineseTokens = nodejieba_1.jieba.cut(query, true);
        const chineseText = chineseTokens.join(' ');
        return `${chineseText} ${query}`
            .toLowerCase()
            .trim()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
            .replace(/\s+/g, ' ');
    }
    async buildKnowledgeWhereClause(filters, processedQuery) {
        const where = {
            isPublished: true,
        };
        if (filters?.contentType?.length) {
            where.metadata = {
                path: ['contentType'],
                in: filters.contentType,
            };
        }
        if (filters?.categories?.length) {
            where.metadata = {
                path: ['categories'],
                array_contains: filters.categories,
            };
        }
        if (filters?.tags?.length) {
            where.tags = { hasSome: filters.tags };
        }
        if (filters?.accessLevel?.length) {
            where.accessLevel = { in: filters.accessLevel };
        }
        if (filters?.authorId?.length) {
            where.metadata = {
                path: ['authorId'],
                in: filters.authorId,
            };
        }
        if (filters?.dateRange) {
            where.createdAt = {
                gte: filters.dateRange.start,
                lte: filters.dateRange.end,
            };
        }
        if (filters?.language?.length) {
            where.language = { in: filters.language };
        }
        if (processedQuery) {
            where.OR = [
                { title: { contains: processedQuery, mode: 'insensitive' } },
                { content: { contains: processedQuery, mode: 'insensitive' } },
                { processedContent: { contains: processedQuery, mode: 'insensitive' } },
                { tags: { hasSome: [processedQuery] } },
                {
                    metadata: {
                        path: ['summary'],
                        string_contains: processedQuery,
                    },
                },
            ];
        }
        return where;
    }
    buildKnowledgeOrderBy(sortBy) {
        if (!sortBy) {
            return [{ relevanceScore: 'desc' }, { createdAt: 'desc' }];
        }
        switch (sortBy.field) {
            case 'relevance':
                return [{ relevanceScore: sortBy.order }];
            case 'date':
                return [{ createdAt: sortBy.order }];
            case 'title':
                return [{ title: sortBy.order }];
            case 'views':
                return [{ metadata: { path: ['viewCount'], sort: sortBy.order } }];
            case 'likes':
                return [{ metadata: { path: ['likeCount'], sort: sortBy.order } }];
            default:
                return [{ relevanceScore: 'desc' }, { createdAt: 'desc' }];
        }
    }
    async calculateKnowledgeRelevanceScores(documents, processedQuery) {
        if (!processedQuery) {
            return documents.map(doc => this.mapToSearchDocument(doc));
        }
        return documents.map(doc => {
            let score = 0;
            if (doc.title.toLowerCase().includes(processedQuery.toLowerCase())) {
                score += 15;
            }
            if (doc.metadata?.summary?.toLowerCase().includes(processedQuery.toLowerCase())) {
                score += 12;
            }
            if (doc.content.toLowerCase().includes(processedQuery.toLowerCase())) {
                score += 8;
            }
            if (doc.processedContent?.toLowerCase().includes(processedQuery.toLowerCase())) {
                score += 10;
            }
            if (doc.tags?.some((tag) => tag.toLowerCase().includes(processedQuery.toLowerCase()))) {
                score += 12;
            }
            if (doc.metadata?.categories?.some((category) => category.toLowerCase().includes(processedQuery.toLowerCase()))) {
                score += 10;
            }
            if (doc.metadata?.keywords?.some((keyword) => {
                const match = keyword.toLowerCase().includes(processedQuery.toLowerCase());
                return match && this.legalKeywords.has(keyword) ? 1.5 : match;
            })) {
                score += this.legalKeywords.has(processedQuery) ? 11 : 7;
            }
            if (doc.metadata?.legalEntities?.some((entity) => entity.value.toLowerCase().includes(processedQuery.toLowerCase()))) {
                score += 9;
            }
            const viewBoost = Math.log(doc.metadata?.viewCount || 1) * 0.5;
            score += viewBoost;
            const daysSinceCreated = (Date.now() - doc.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            const recencyBoost = Math.max(0, 30 - daysSinceCreated) * 0.1;
            score += recencyBoost;
            return {
                id: doc.id,
                entityId: doc.entityId,
                entityType: doc.entityType,
                title: doc.title,
                content: doc.content,
                summary: doc.metadata?.summary,
                tags: doc.tags || [],
                categories: doc.metadata?.categories || [],
                language: doc.language,
                contentType: doc.metadata?.contentType,
                accessLevel: doc.accessLevel,
                authorId: doc.metadata?.authorId,
                metadata: { ...doc.metadata, relevanceScore: score },
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            };
        }).sort((a, b) => (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0));
    }
    mapToSearchDocument(doc) {
        return {
            id: doc.id,
            entityId: doc.entityId,
            entityType: doc.entityType,
            title: doc.title,
            content: doc.content,
            summary: doc.metadata?.summary,
            tags: doc.tags || [],
            categories: doc.metadata?.categories || [],
            language: doc.language,
            contentType: doc.metadata?.contentType,
            accessLevel: doc.accessLevel,
            authorId: doc.metadata?.authorId,
            metadata: doc.metadata || {},
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };
    }
    async generateKnowledgeFacets(whereClause) {
        const contentTypes = await prisma.searchIndex.groupBy({
            by: ['metadata'],
            where: whereClause,
            _count: { metadata: true },
        });
        const contentTypeFacets = {};
        contentTypes.forEach(item => {
            const contentType = item.metadata?.contentType;
            if (contentType) {
                contentTypeFacets[contentType] = (contentTypeFacets[contentType] || 0) + 1;
            }
        });
        const accessLevels = await prisma.searchIndex.groupBy({
            by: ['accessLevel'],
            where: whereClause,
            _count: { accessLevel: true },
        });
        const accessLevelFacets = {};
        accessLevels.forEach(item => {
            accessLevelFacets[item.accessLevel] = item._count.accessLevel;
        });
        const dateRange = await prisma.searchIndex.aggregate({
            where: whereClause,
            _min: { createdAt: true },
            _max: { createdAt: true },
        });
        return {
            contentType: contentTypeFacets,
            categories: {},
            tags: {},
            accessLevel: accessLevelFacets,
            authors: {},
            dateRange: {
                min: dateRange._min.createdAt || new Date(),
                max: dateRange._max.createdAt || new Date(),
            },
        };
    }
    async getKnowledgeSuggestions(query, limit = 10) {
        try {
            const processedQuery = this.processKnowledgeQuery(query);
            const documents = await prisma.searchIndex.findMany({
                where: {
                    isPublished: true,
                    OR: [
                        {
                            title: {
                                contains: query,
                                mode: 'insensitive',
                            },
                        },
                        {
                            tags: {
                                hasSome: [query],
                            },
                        },
                        {
                            metadata: {
                                path: ['keywords'],
                                array_contains: [query],
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
                doc.tags?.forEach((tag) => {
                    if (tag.toLowerCase().includes(query.toLowerCase())) {
                        suggestions.add(tag);
                    }
                });
                doc.metadata?.keywords?.forEach((keyword) => {
                    if (keyword.toLowerCase().includes(query.toLowerCase())) {
                        suggestions.add(keyword);
                    }
                });
            }
            return Array.from(suggestions).slice(0, limit);
        }
        catch (error) {
            console.error('Failed to get knowledge suggestions:', error);
            return [];
        }
    }
    extractUserInterests(searchHistory) {
        const interests = new Set();
        searchHistory.forEach(record => {
            const keywords = this.processKnowledgeQuery(record.query).split(/\s+/);
            keywords.forEach(keyword => {
                if (keyword.length > 2 && !this.stopWords.has(keyword)) {
                    interests.add(keyword);
                }
            });
        });
        return Array.from(interests);
    }
    async scoreRecommendations(recommendations, userInterests) {
        return recommendations.map(doc => {
            let score = 0;
            const content = `${doc.title} ${doc.content}`.toLowerCase();
            userInterests.forEach(interest => {
                if (content.includes(interest.toLowerCase())) {
                    score += 5;
                }
            });
            score += Math.log(doc.metadata?.viewCount || 1) * 2;
            score += (doc.metadata?.likeCount || 0) * 0.5;
            const daysSinceCreated = (Date.now() - doc.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 30 - daysSinceCreated) * 0.2;
            return {
                ...this.mapToSearchDocument(doc),
                metadata: { ...doc.metadata, recommendationScore: score },
            };
        }).sort((a, b) => (b.metadata.recommendationScore || 0) - (a.metadata.recommendationScore || 0));
    }
    async logSearchAnalytics(query, resultsCount, processingTime) {
        try {
            await prisma.searchAnalytics.create({
                data: {
                    query: query.query,
                    resultsCount,
                    processingTime,
                    userId: query.userId,
                    filters: query.filters,
                    sortBy: query.sortBy?.field,
                },
            });
        }
        catch (error) {
            console.error('Failed to log search analytics:', error);
        }
    }
}
exports.KnowledgeSearchEngine = KnowledgeSearchEngine;
exports.knowledgeSearchEngine = new KnowledgeSearchEngine();
//# sourceMappingURL=knowledgeSearchEngine.js.map