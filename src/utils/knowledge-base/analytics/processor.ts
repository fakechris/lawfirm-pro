import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AnalyticsFilter {
  dateRange?: {
    start: Date;
    end: Date;
  };
  contentType?: string[];
  categories?: string[];
  tags?: string[];
  users?: string[];
  interactionTypes?: string[];
}

export interface AnalyticsAggregation {
  groupBy: 'day' | 'week' | 'month' | 'year' | 'category' | 'contentType' | 'user';
  metric: 'views' | 'interactions' | 'searches' | 'users' | 'completionRate';
  aggregation: 'sum' | 'average' | 'count' | 'max' | 'min';
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  includeCharts?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  metrics: string[];
}

export interface ProcessedData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string;
  }>;
  summary: {
    total: number;
    average: number;
    min: number;
    max: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export class AnalyticsDataProcessor {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor() {
    this.startCacheCleanup();
  }

  async processTimeSeriesData(
    metric: 'views' | 'interactions' | 'searches' | 'users',
    filter: AnalyticsFilter,
    aggregation: AnalyticsAggregation
  ): Promise<ProcessedData> {
    const cacheKey = `timeseries_${metric}_${JSON.stringify(filter)}_${JSON.stringify(aggregation)}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    let data: any[] = [];
    
    switch (metric) {
      case 'views':
        data = await this.getViewData(filter, aggregation);
        break;
      case 'interactions':
        data = await this.getInteractionData(filter, aggregation);
        break;
      case 'searches':
        data = await this.getSearchData(filter, aggregation);
        break;
      case 'users':
        data = await this.getUserData(filter, aggregation);
        break;
    }

    const processed = this.aggregateTimeSeries(data, aggregation);
    
    // Cache the result
    this.setToCache(cacheKey, processed, 5 * 60 * 1000); // 5 minutes
    
    return processed;
  }

  async processCategoryData(filter: AnalyticsFilter): Promise<ProcessedData> {
    const cacheKey = `category_${JSON.stringify(filter)}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const views = await prisma.knowledgeBaseView.findMany({
      where: this.buildFilter(filter),
      include: {
        article: {
          select: { categories: true },
        },
      },
    });

    const categoryStats = new Map<string, number>();
    
    views.forEach(view => {
      if (view.article?.categories) {
        view.article.categories.forEach((category: string) => {
          categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
        });
      }
    });

    const sortedCategories = Array.from(categoryStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const processed: ProcessedData = {
      labels: sortedCategories.map(([category]) => category),
      datasets: [{
        label: 'Views by Category',
        data: sortedCategories.map(([, count]) => count),
        backgroundColor: this.generateColors(sortedCategories.length),
      }],
      summary: {
        total: sortedCategories.reduce((sum, [, count]) => sum + count, 0),
        average: sortedCategories.reduce((sum, [, count]) => sum + count, 0) / sortedCategories.length,
        min: Math.min(...sortedCategories.map(([, count]) => count)),
        max: Math.max(...sortedCategories.map(([, count]) => count)),
        trend: 'stable', // Would need historical data to calculate trend
      },
    };

    this.setToCache(cacheKey, processed, 10 * 60 * 1000); // 10 minutes
    
    return processed;
  }

  async processUserEngagementData(filter: AnalyticsFilter): Promise<ProcessedData> {
    const cacheKey = `engagement_${JSON.stringify(filter)}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const interactions = await prisma.knowledgeBaseInteraction.findMany({
      where: this.buildFilter(filter),
    });

    const interactionTypes = new Map<string, number>();
    
    interactions.forEach(interaction => {
      interactionTypes.set(
        interaction.interactionType,
        (interactionTypes.get(interaction.interactionType) || 0) + 1
      );
    });

    const sortedTypes = Array.from(interactionTypes.entries())
      .sort((a, b) => b[1] - a[1]);

    const processed: ProcessedData = {
      labels: sortedTypes.map(([type]) => type),
      datasets: [{
        label: 'User Interactions',
        data: sortedTypes.map(([, count]) => count),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
          '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ],
      }],
      summary: {
        total: sortedTypes.reduce((sum, [, count]) => sum + count, 0),
        average: sortedTypes.reduce((sum, [, count]) => sum + count, 0) / sortedTypes.length,
        min: Math.min(...sortedTypes.map(([, count]) => count)),
        max: Math.max(...sortedTypes.map(([, count]) => count)),
        trend: 'stable',
      },
    };

    this.setToCache(cacheKey, processed, 10 * 60 * 1000); // 10 minutes
    
    return processed;
  }

  async processSearchPerformanceData(filter: AnalyticsFilter): Promise<ProcessedData> {
    const cacheKey = `search_perf_${JSON.stringify(filter)}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const searches = await prisma.knowledgeBaseSearchActivity.findMany({
      where: this.buildFilter(filter),
    });

    // Group by response time ranges
    const timeRanges = [
      { label: '0-1s', min: 0, max: 1000 },
      { label: '1-2s', min: 1000, max: 2000 },
      { label: '2-5s', min: 2000, max: 5000 },
      { label: '5-10s', min: 5000, max: 10000 },
      { label: '10s+', min: 10000, max: Infinity },
    ];

    const responseTimeDistribution = timeRanges.map(range => {
      const count = searches.filter(
        search => search.responseTime >= range.min && search.responseTime < range.max
      ).length;
      
      return { label: range.label, count };
    });

    const processed: ProcessedData = {
      labels: responseTimeDistribution.map(item => item.label),
      datasets: [{
        label: 'Search Response Time Distribution',
        data: responseTimeDistribution.map(item => item.count),
        backgroundColor: ['#4BC0C0', '#36A2EB', '#FFCE56', '#FF9F40', '#FF6384'],
      }],
      summary: {
        total: searches.length,
        average: searches.length > 0 
          ? searches.reduce((sum, search) => sum + search.responseTime, 0) / searches.length 
          : 0,
        min: Math.min(...searches.map(search => search.responseTime)),
        max: Math.max(...searches.map(search => search.responseTime)),
        trend: 'stable',
      },
    };

    this.setToCache(cacheKey, processed, 5 * 60 * 1000); // 5 minutes
    
    return processed;
  }

  async exportData(options: ExportOptions): Promise<string | Buffer> {
    const data = await this.getExportData(options);

    switch (options.format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.convertToCSV(data);
      
      case 'xlsx':
        // Would need a library like xlsx
        return this.convertToXLSX(data);
      
      case 'pdf':
        // Would need a library like pdfkit or puppeteer
        return this.convertToPDF(data);
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  async generateInsights(filter: AnalyticsFilter): Promise<string[]> {
    const insights: string[] = [];

    // Get basic metrics
    const [totalViews, totalInteractions, totalSearches] = await Promise.all([
      prisma.knowledgeBaseView.count({ where: this.buildFilter(filter) }),
      prisma.knowledgeBaseInteraction.count({ where: this.buildFilter(filter) }),
      prisma.knowledgeBaseSearchActivity.count({ where: this.buildFilter(filter) }),
    ]);

    // View-based insights
    if (totalViews < 100) {
      insights.push('Knowledge base has low view count - consider promoting content or improving discoverability');
    }

    // Engagement insights
    const engagementRate = totalViews > 0 ? totalInteractions / totalViews : 0;
    if (engagementRate < 0.05) {
      insights.push('Low user engagement detected - consider adding more interactive content or improving content quality');
    }

    // Search insights
    if (totalSearches > 0) {
      const failedSearches = await prisma.knowledgeBaseSearchActivity.count({
        where: {
          ...this.buildFilter(filter),
          resultsCount: 0,
        },
      });

      const failureRate = failedSearches / totalSearches;
      if (failureRate > 0.2) {
        insights.push('High search failure rate detected - consider improving search functionality or content coverage');
      }
    }

    // Content freshness insights
    const recentArticles = await prisma.knowledgeBaseArticle.count({
      where: {
        status: 'PUBLISHED',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    if (recentArticles < 5) {
      insights.push('Few new articles published recently - consider updating content to keep it fresh');
    }

    return insights;
  }

  private async getViewData(filter: AnalyticsFilter, aggregation: AnalyticsAggregation): Promise<any[]> {
    return prisma.knowledgeBaseView.findMany({
      where: this.buildFilter(filter),
      include: {
        article: {
          select: { categories: true, contentType: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getInteractionData(filter: AnalyticsFilter, aggregation: AnalyticsAggregation): Promise<any[]> {
    return prisma.knowledgeBaseInteraction.findMany({
      where: this.buildFilter(filter),
      include: {
        article: {
          select: { categories: true, contentType: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getSearchData(filter: AnalyticsFilter, aggregation: AnalyticsAggregation): Promise<any[]> {
    return prisma.knowledgeBaseSearchActivity.findMany({
      where: this.buildFilter(filter),
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getUserData(filter: AnalyticsFilter, aggregation: AnalyticsAggregation): Promise<any[]> {
    const views = await prisma.knowledgeBaseView.findMany({
      where: this.buildFilter(filter),
      select: { userId: true, createdAt: true },
    });

    // Group by user and date
    const userActivity = new Map<string, Set<string>>();
    views.forEach(view => {
      if (view.userId) {
        const dateKey = view.createdAt.toISOString().split('T')[0];
        if (!userActivity.has(view.userId)) {
          userActivity.set(view.userId, new Set());
        }
        userActivity.get(view.userId)!.add(dateKey);
      }
    });

    return Array.from(userActivity.entries()).map(([userId, dates]) => ({
      userId,
      activityDays: dates.size,
      firstActivity: Math.min(...Array.from(dates).map(d => new Date(d).getTime())),
      lastActivity: Math.max(...Array.from(dates).map(d => new Date(d).getTime())),
    }));
  }

  private aggregateTimeSeries(data: any[], aggregation: AnalyticsAggregation): ProcessedData {
    const grouped = new Map<string, number[]>();

    data.forEach(item => {
      let key: string;
      
      switch (aggregation.groupBy) {
        case 'day':
          key = item.createdAt.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(item.createdAt);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = item.createdAt.toISOString().substring(0, 7);
          break;
        case 'year':
          key = item.createdAt.getFullYear().toString();
          break;
        default:
          key = item.createdAt.toISOString().split('T')[0];
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      let value: number;
      switch (aggregation.metric) {
        case 'views':
          value = 1;
          break;
        case 'interactions':
          value = 1;
          break;
        case 'searches':
          value = 1;
          break;
        case 'users':
          value = item.userId ? 1 : 0;
          break;
        case 'completionRate':
          value = item.completionPercentage || 0;
          break;
        default:
          value = 1;
      }

      grouped.get(key)!.push(value);
    });

    const sortedKeys = Array.from(grouped.keys()).sort();
    const aggregatedData = sortedKeys.map(key => {
      const values = grouped.get(key)!;
      
      switch (aggregation.aggregation) {
        case 'sum':
          return values.reduce((sum, val) => sum + val, 0);
        case 'average':
          return values.reduce((sum, val) => sum + val, 0) / values.length;
        case 'count':
          return values.length;
        case 'max':
          return Math.max(...values);
        case 'min':
          return Math.min(...values);
        default:
          return values.reduce((sum, val) => sum + val, 0);
      }
    });

    return {
      labels: sortedKeys,
      datasets: [{
        label: `${aggregation.metric} (${aggregation.aggregation})`,
        data: aggregatedData,
        borderColor: '#36A2EB',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
      }],
      summary: {
        total: aggregatedData.reduce((sum, val) => sum + val, 0),
        average: aggregatedData.reduce((sum, val) => sum + val, 0) / aggregatedData.length,
        min: Math.min(...aggregatedData),
        max: Math.max(...aggregatedData),
        trend: this.calculateTrend(aggregatedData),
      },
    };
  }

  private buildFilter(filter: AnalyticsFilter): any {
    const where: any = {};

    if (filter.dateRange) {
      where.createdAt = {
        gte: filter.dateRange.start,
        lte: filter.dateRange.end,
      };
    }

    if (filter.contentType) {
      where.article = {
        contentType: {
          in: filter.contentType,
        },
      };
    }

    if (filter.categories) {
      where.article = {
        ...where.article,
        categories: {
          hasSome: filter.categories,
        },
      };
    }

    if (filter.tags) {
      where.article = {
        ...where.article,
        tags: {
          hasSome: filter.tags,
        },
      };
    }

    if (filter.users) {
      where.userId = {
        in: filter.users,
      };
    }

    if (filter.interactionTypes) {
      where.interactionType = {
        in: filter.interactionTypes,
      };
    }

    return where;
  }

  private calculateTrend(data: number[]): 'up' | 'down' | 'stable' {
    if (data.length < 2) return 'stable';
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  private generateColors(count: number): string[] {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];
    
    return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
  }

  private async getExportData(options: ExportOptions): Promise<any> {
    // This would collect all the data needed for export
    const data: any = {
      generatedAt: new Date(),
      metrics: {},
    };

    for (const metric of options.metrics) {
      switch (metric) {
        case 'views':
          data.metrics.views = await prisma.knowledgeBaseView.count({
            where: this.buildFilter({ dateRange: options.dateRange }),
          });
          break;
        case 'interactions':
          data.metrics.interactions = await prisma.knowledgeBaseInteraction.count({
            where: this.buildFilter({ dateRange: options.dateRange }),
          });
          break;
        case 'searches':
          data.metrics.searches = await prisma.knowledgeBaseSearchActivity.count({
            where: this.buildFilter({ dateRange: options.dateRange }),
          });
          break;
        case 'users':
          const views = await prisma.knowledgeBaseView.findMany({
            where: this.buildFilter({ dateRange: options.dateRange }),
            select: { userId: true },
          });
          data.metrics.users = new Set(views.map(v => v.userId).filter(Boolean)).size;
          break;
      }
    }

    return data;
  }

  private convertToCSV(data: any): string {
    const rows = [];
    
    // Header
    rows.push('Metric,Value');
    
    // Data rows
    Object.entries(data.metrics).forEach(([key, value]) => {
      rows.push(`${key},${value}`);
    });
    
    return rows.join('\n');
  }

  private convertToXLSX(data: any): Buffer {
    // Simplified - would need xlsx library
    return Buffer.from(JSON.stringify(data));
  }

  private convertToPDF(data: any): Buffer {
    // Simplified - would need PDF library
    return Buffer.from(JSON.stringify(data));
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setToCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60 * 1000); // Clean up every minute
  }
}

export const analyticsDataProcessor = new AnalyticsDataProcessor();