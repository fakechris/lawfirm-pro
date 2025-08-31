import { PrismaClient } from '@prisma/client';
import { 
  KnowledgeBaseContent,
  KnowledgeBaseContentVersion,
  KnowledgeBaseCategory,
  KnowledgeBaseTag,
  CreateContentInput,
  UpdateContentInput,
  CreateContentVersionInput,
  ContentQuery,
  PaginationParams,
  PaginatedResult,
  ContentSearchResult
} from '../../../models/knowledge-base';
import { DocumentService } from '../../documents/documentService';
import { SearchService } from '../../documents/searchService';

export class ContentManagementService {
  private prisma: PrismaClient;
  private documentService: DocumentService;
  private searchService: SearchService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.documentService = new DocumentService(prisma);
    this.searchService = new SearchService(prisma);
  }

  // Content CRUD Operations
  async createContent(input: CreateContentInput): Promise<KnowledgeBaseContent> {
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

    // Create initial version
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

  async getContentById(id: string): Promise<KnowledgeBaseContent | null> {
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

  async updateContent(id: string, input: UpdateContentInput, userId: string): Promise<KnowledgeBaseContent> {
    const currentContent = await this.getContentById(id);
    if (!currentContent) {
      throw new Error('Content not found');
    }

    // Create new version if content is being updated
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
        searchVector: this.generateSearchVector(
          input.title || currentContent.title,
          input.description || currentContent.description,
          input.content || currentContent.content,
          input.tags || currentContent.tags
        ),
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

  async deleteContent(id: string): Promise<void> {
    await this.prisma.knowledgeBaseContent.update({
      where: { id },
      data: {
        status: 'archived',
        archivedAt: new Date()
      }
    });
  }

  async queryContent(query: ContentQuery, pagination: PaginationParams = {}): Promise<PaginatedResult<KnowledgeBaseContent>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (query.id) where.id = query.id;
    if (query.title) where.title = { contains: query.title, mode: 'insensitive' };
    if (query.contentType) where.contentType = query.contentType;
    if (query.category) where.category = query.category;
    if (query.tags) where.tags = { hasSome: query.tags };
    if (query.status) where.status = query.status;
    if (query.visibility) where.visibility = query.visibility;
    if (query.authorId) where.authorId = query.authorId;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = query.fromDate;
      if (query.toDate) where.createdAt.lte = query.toDate;
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

  async searchContent(query: string, filters: any = {}): Promise<ContentSearchResult[]> {
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

  // Content Version Management
  async createContentVersion(input: CreateContentVersionInput): Promise<KnowledgeBaseContentVersion> {
    // Mark previous versions as not current
    await this.prisma.knowledgeBaseContentVersion.updateMany({
      where: { contentId: input.contentId },
      data: { isCurrent: false }
    });

    // Get the next version number
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

  async getContentVersions(contentId: string): Promise<KnowledgeBaseContentVersion[]> {
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

  async getContentVersion(contentId: string, version: number): Promise<KnowledgeBaseContentVersion | null> {
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

  async revertToVersion(contentId: string, version: number, userId: string): Promise<KnowledgeBaseContent> {
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
        searchVector: this.generateSearchVector(
          targetVersion.title,
          targetVersion.description,
          targetVersion.content,
          [] // Will be updated from current content tags
        ),
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

    // Create new version for the revert
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

  // Category Management
  async createCategory(name: string, description?: string, parentId?: string): Promise<KnowledgeBaseCategory> {
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

  async getCategories(): Promise<KnowledgeBaseCategory[]> {
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

  async updateCategory(id: string, updates: any): Promise<KnowledgeBaseCategory> {
    return await this.prisma.knowledgeBaseCategory.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() }
    });
  }

  // Tag Management
  async createTag(name: string, description?: string): Promise<KnowledgeBaseTag> {
    return await this.prisma.knowledgeBaseTag.create({
      data: {
        name,
        description,
        usageCount: 0,
        isActive: true
      }
    });
  }

  async getTags(): Promise<KnowledgeBaseTag[]> {
    return await this.prisma.knowledgeBaseTag.findMany({
      where: { isActive: true },
      orderBy: { usageCount: 'desc' }
    });
  }

  async updateTagUsage(tagName: string): Promise<void> {
    await this.prisma.knowledgeBaseTag.updateMany({
      where: { name: tagName },
      data: { 
        usageCount: { increment: 1 },
        updatedAt: new Date()
      }
    });
  }

  // Utility Methods
  private generateSearchVector(title: string, description?: string, content?: string, tags: string[] = []): any {
    const searchText = [title, description, content, ...tags].filter(Boolean).join(' ');
    // This would typically use PostgreSQL's full-text search capabilities
    // For now, we'll return a simple object that can be stored in JSONB
    return {
      text: searchText.toLowerCase(),
      keywords: searchText.split(/\s+/).filter(word => word.length > 2)
    };
  }

  private generateExcerpt(content: string, query: string): string {
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

  private calculateRelevanceScore(content: any, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Title match (highest weight)
    if (content.title.toLowerCase().includes(queryLower)) {
      score += 10;
    }
    
    // Description match (medium weight)
    if (content.description?.toLowerCase().includes(queryLower)) {
      score += 5;
    }
    
    // Content match (lower weight)
    if (content.content.toLowerCase().includes(queryLower)) {
      score += 2;
    }
    
    // Tag match (medium weight)
    if (content.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))) {
      score += 5;
    }
    
    return score;
  }

  private generateHighlights(content: any, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    
    const highlightText = (text: string) => {
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

  // Content Analytics
  async getContentAnalytics(contentId: string): Promise<any> {
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

  async getGlobalAnalytics(): Promise<any> {
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