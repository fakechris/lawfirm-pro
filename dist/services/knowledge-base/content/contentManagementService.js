"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentManagementService = void 0;
const documentService_1 = require("../../documents/documentService");
const searchService_1 = require("../../documents/searchService");
class ContentManagementService {
    constructor(prisma) {
        this.prisma = prisma;
        this.documentService = new documentService_1.DocumentService(prisma);
        this.searchService = new searchService_1.SearchService(prisma);
    }
    async createContent(input) {
        const content = await this.prisma.knowledgeBaseContent.create({
            data: {
                title: input.title,
                description: input.description,
                content: input.content,
                contentType: input.contentType,
                category: input.category,
                tags: input.tags,
                status: 'draft',
                visibility: input.visibility,
                authorId: input.authorId,
                version: 1,
                metadata: input.metadata || {},
                searchVector: this.generateSearchVector(input.title, input.description, input.content, input.tags)
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        await this.createContentVersion({
            contentId: content.id,
            title: input.title,
            description: input.description,
            content: input.content,
            changeLog: 'Initial version',
            createdById: input.authorId
        });
        return content;
    }
    async getContentById(id) {
        return await this.prisma.knowledgeBaseContent.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                versions: {
                    where: { isCurrent: true },
                    take: 1
                },
                parentContent: {
                    select: {
                        id: true,
                        title: true,
                        contentType: true
                    }
                },
                childContents: {
                    select: {
                        id: true,
                        title: true,
                        contentType: true,
                        status: true
                    }
                }
            }
        });
    }
    async updateContent(id, input, userId) {
        const currentContent = await this.getContentById(id);
        if (!currentContent) {
            throw new Error('Content not found');
        }
        if (input.content || input.title || input.description) {
            await this.createContentVersion({
                contentId: id,
                title: input.title || currentContent.title,
                description: input.description || currentContent.description,
                content: input.content || currentContent.content,
                changeLog: 'Content updated',
                createdById: userId
            });
        }
        const updatedContent = await this.prisma.knowledgeBaseContent.update({
            where: { id },
            data: {
                ...input,
                version: input.content || input.title || input.description ? currentContent.version + 1 : currentContent.version,
                searchVector: this.generateSearchVector(input.title || currentContent.title, input.description || currentContent.description, input.content || currentContent.content, input.tags || currentContent.tags),
                updatedAt: new Date()
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        return updatedContent;
    }
    async deleteContent(id) {
        await this.prisma.knowledgeBaseContent.update({
            where: { id },
            data: {
                status: 'archived',
                archivedAt: new Date()
            }
        });
    }
    async queryContent(query, pagination = {}) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.id)
            where.id = query.id;
        if (query.title)
            where.title = { contains: query.title, mode: 'insensitive' };
        if (query.contentType)
            where.contentType = query.contentType;
        if (query.category)
            where.category = query.category;
        if (query.tags)
            where.tags = { hasSome: query.tags };
        if (query.status)
            where.status = query.status;
        if (query.visibility)
            where.visibility = query.visibility;
        if (query.authorId)
            where.authorId = query.authorId;
        if (query.fromDate || query.toDate) {
            where.createdAt = {};
            if (query.fromDate)
                where.createdAt.gte = query.fromDate;
            if (query.toDate)
                where.createdAt.lte = query.toDate;
        }
        const [data, total] = await Promise.all([
            this.prisma.knowledgeBaseContent.findMany({
                where,
                include: {
                    author: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    reviewer: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    approver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limit
            }),
            this.prisma.knowledgeBaseContent.count({ where })
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
    async searchContent(query, filters = {}) {
        const searchResults = await this.prisma.knowledgeBaseContent.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { title: { contains: query, mode: 'insensitive' } },
                            { description: { contains: query, mode: 'insensitive' } },
                            { content: { contains: query, mode: 'insensitive' } },
                            { tags: { hasSome: [query] } }
                        ]
                    },
                    filters
                ]
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        return searchResults.map(content => ({
            id: content.id,
            title: content.title,
            description: content.description,
            contentType: content.contentType,
            category: content.category,
            tags: content.tags,
            excerpt: this.generateExcerpt(content.content, query),
            score: this.calculateRelevanceScore(content, query),
            highlights: this.generateHighlights(content, query),
            author: content.author ? {
                id: content.author.id,
                firstName: content.author.firstName,
                lastName: content.author.lastName
            } : undefined,
            status: content.status,
            publishedAt: content.publishedAt,
            metadata: content.metadata
        }));
    }
    async createContentVersion(input) {
        await this.prisma.knowledgeBaseContentVersion.updateMany({
            where: { contentId: input.contentId },
            data: { isCurrent: false }
        });
        const latestVersion = await this.prisma.knowledgeBaseContentVersion.findFirst({
            where: { contentId: input.contentId },
            orderBy: { version: 'desc' }
        });
        const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
        return await this.prisma.knowledgeBaseContentVersion.create({
            data: {
                contentId: input.contentId,
                version: nextVersion,
                title: input.title,
                description: input.description,
                content: input.content,
                changeLog: input.changeLog,
                createdById: input.createdById,
                isCurrent: true
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
    }
    async getContentVersions(contentId) {
        return await this.prisma.knowledgeBaseContentVersion.findMany({
            where: { contentId },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { version: 'desc' }
        });
    }
    async getContentVersion(contentId, version) {
        return await this.prisma.knowledgeBaseContentVersion.findFirst({
            where: { contentId, version },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
    }
    async revertToVersion(contentId, version, userId) {
        const targetVersion = await this.getContentVersion(contentId, version);
        if (!targetVersion) {
            throw new Error('Version not found');
        }
        const updatedContent = await this.prisma.knowledgeBaseContent.update({
            where: { id: contentId },
            data: {
                title: targetVersion.title,
                description: targetVersion.description,
                content: targetVersion.content,
                searchVector: this.generateSearchVector(targetVersion.title, targetVersion.description, targetVersion.content, []),
                updatedAt: new Date()
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        await this.createContentVersion({
            contentId,
            title: targetVersion.title,
            description: targetVersion.description,
            content: targetVersion.content,
            changeLog: `Reverted to version ${version}`,
            createdById: userId
        });
        return updatedContent;
    }
    async createCategory(name, description, parentId) {
        return await this.prisma.knowledgeBaseCategory.create({
            data: {
                name,
                description,
                parentId,
                sortOrder: 0,
                isActive: true,
                metadata: {}
            }
        });
    }
    async getCategories() {
        return await this.prisma.knowledgeBaseCategory.findMany({
            where: { isActive: true },
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                children: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        contents: true
                    }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });
    }
    async updateCategory(id, updates) {
        return await this.prisma.knowledgeBaseCategory.update({
            where: { id },
            data: { ...updates, updatedAt: new Date() }
        });
    }
    async createTag(name, description) {
        return await this.prisma.knowledgeBaseTag.create({
            data: {
                name,
                description,
                usageCount: 0,
                isActive: true
            }
        });
    }
    async getTags() {
        return await this.prisma.knowledgeBaseTag.findMany({
            where: { isActive: true },
            orderBy: { usageCount: 'desc' }
        });
    }
    async updateTagUsage(tagName) {
        await this.prisma.knowledgeBaseTag.updateMany({
            where: { name: tagName },
            data: {
                usageCount: { increment: 1 },
                updatedAt: new Date()
            }
        });
    }
    generateSearchVector(title, description, content, tags = []) {
        const searchText = [title, description, content, ...tags].filter(Boolean).join(' ');
        return {
            text: searchText.toLowerCase(),
            keywords: searchText.split(/\s+/).filter(word => word.length > 2)
        };
    }
    generateExcerpt(content, query) {
        const queryLower = query.toLowerCase();
        const contentLower = content.toLowerCase();
        const index = contentLower.indexOf(queryLower);
        if (index === -1) {
            return content.substring(0, 200) + '...';
        }
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + query.length + 100);
        const excerpt = content.substring(start, end);
        return (start > 0 ? '...' : '') + excerpt + (end < content.length ? '...' : '');
    }
    calculateRelevanceScore(content, query) {
        let score = 0;
        const queryLower = query.toLowerCase();
        if (content.title.toLowerCase().includes(queryLower)) {
            score += 10;
        }
        if (content.description?.toLowerCase().includes(queryLower)) {
            score += 5;
        }
        if (content.content.toLowerCase().includes(queryLower)) {
            score += 2;
        }
        if (content.tags?.some((tag) => tag.toLowerCase().includes(queryLower))) {
            score += 5;
        }
        return score;
    }
    generateHighlights(content, query) {
        const highlights = [];
        const queryLower = query.toLowerCase();
        const highlightText = (text) => {
            const regex = new RegExp(`(${query})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        };
        if (content.title.toLowerCase().includes(queryLower)) {
            highlights.push(highlightText(content.title));
        }
        if (content.description?.toLowerCase().includes(queryLower)) {
            highlights.push(highlightText(content.description));
        }
        return highlights;
    }
    async getContentAnalytics(contentId) {
        const [views, interactions, versions] = await Promise.all([
            this.prisma.userContentInteraction.count({
                where: { contentId, action: 'view' }
            }),
            this.prisma.userContentInteraction.count({
                where: { contentId }
            }),
            this.prisma.knowledgeBaseContentVersion.count({
                where: { contentId }
            })
        ]);
        return {
            views,
            interactions,
            versions,
            lastUpdated: await this.prisma.knowledgeBaseContent.findUnique({
                where: { id: contentId },
                select: { updatedAt: true }
            })
        };
    }
    async getGlobalAnalytics() {
        const [totalContent, totalViews, topContent, categoryStats] = await Promise.all([
            this.prisma.knowledgeBaseContent.count({
                where: { status: 'published' }
            }),
            this.prisma.userContentInteraction.count({
                where: { action: 'view' }
            }),
            this.prisma.userContentInteraction.groupBy({
                by: ['contentId'],
                _count: { contentId: true },
                orderBy: { _count: { contentId: 'desc' } },
                take: 10
            }),
            this.prisma.knowledgeBaseContent.groupBy({
                by: ['category'],
                _count: { category: true },
                orderBy: { _count: { category: 'desc' } }
            })
        ]);
        return {
            totalContent,
            totalViews,
            topContent,
            categoryStats
        };
    }
}
exports.ContentManagementService = ContentManagementService;
//# sourceMappingURL=contentManagementService.js.map