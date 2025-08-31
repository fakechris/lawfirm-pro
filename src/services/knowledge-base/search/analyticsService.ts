import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SearchMetrics {
  totalSearches: number;
  averageResponseTime: number;
  errorRate: number;
  topQueries: Array<{ query: string; count: number }>;
  searchDistribution: {
    byHour: number[];
    byDay: number[];
    byUser: Array<{ userId: string; count: number }>;
  };
  performanceMetrics: {
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}

export interface SearchPerformanceAlert {
  id: string;
  type: 'slow_response' | 'high_error_rate' | 'low_result_count' | 'system_overload';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface SearchHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  checks: {
    responseTime: boolean;
    errorRate: boolean;
    resultQuality: boolean;
    systemResources: boolean;
  };
  lastCheck: Date;
}

export interface SearchUsageReport {
  period: {
    start: Date;
    end: Date;
  };
  totalSearches: number;
  uniqueUsers: number;
  averageResultsPerSearch: number;
  clickThroughRate: number;
  topContentTypes: Array<{ type: string; count: number }>;
  userSatisfaction: number;
  recommendations: string[];
}

export class SearchAnalyticsService {
  private alerts: SearchPerformanceAlert[] = [];
  private metricsCache: Map<string, any> = new Map();
  private lastHealthCheck: Date = new Date();

  constructor() {
    this.startMonitoring();
    this.startPeriodicHealthChecks();
  }

  async recordSearch(searchData: {
    query: string;
    userId?: string;
    resultsCount: number;
    responseTime: number;
    success: boolean;
    filters?: any;
    sortBy?: string;
    clickedResults?: string[];
  }): Promise<void> {
    try {
      await prisma.searchAnalytics.create({
        data: {
          query: searchData.query,
          resultsCount: searchData.resultsCount,
          processingTime: searchData.responseTime,
          userId: searchData.userId,
          filters: searchData.filters,
          sortBy: searchData.sortBy,
        },
      });

      // Check for performance alerts
      await this.checkPerformanceAlerts(searchData);

      // Update cache
      this.updateMetricsCache(searchData);

    } catch (error) {
      console.error('Failed to record search analytics:', error);
    }
  }

  async getSearchMetrics(period: { start: Date; end: Date } = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date(),
  }): Promise<SearchMetrics> {
    try {
      // Get basic metrics
      const searches = await prisma.searchAnalytics.findMany({
        where: {
          createdAt: {
            gte: period.start,
            lte: period.end,
          },
        },
      });

      const totalSearches = searches.length;
      const averageResponseTime = searches.reduce((sum, s) => sum + s.processingTime, 0) / totalSearches || 0;
      
      // Calculate error rate (assuming failed searches are not recorded)
      const errorRate = 0; // This would need to be tracked separately

      // Get top queries
      const queryCounts = new Map<string, number>();
      searches.forEach(search => {
        queryCounts.set(search.query, (queryCounts.get(search.query) || 0) + 1);
      });

      const topQueries = Array.from(queryCounts.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get search distribution by hour
      const hourlyDistribution = new Array(24).fill(0);
      searches.forEach(search => {
        const hour = search.createdAt.getHours();
        hourlyDistribution[hour]++;
      });

      // Get search distribution by day
      const dailyDistribution = new Array(7).fill(0);
      searches.forEach(search => {
        const day = search.createdAt.getDay();
        dailyDistribution[day]++;
      });

      // Get search distribution by user
      const userCounts = new Map<string, number>();
      searches.forEach(search => {
        if (search.userId) {
          userCounts.set(search.userId, (userCounts.get(search.userId) || 0) + 1);
        }
      });

      const byUser = Array.from(userCounts.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate performance percentiles
      const responseTimes = searches.map(s => s.processingTime).sort((a, b) => a - b);
      const p50ResponseTime = this.getPercentile(responseTimes, 50);
      const p95ResponseTime = this.getPercentile(responseTimes, 95);
      const p99ResponseTime = this.getPercentile(responseTimes, 99);

      return {
        totalSearches,
        averageResponseTime,
        errorRate,
        topQueries,
        searchDistribution: {
          byHour: hourlyDistribution,
          byDay: dailyDistribution,
          byUser,
        },
        performanceMetrics: {
          p50ResponseTime,
          p95ResponseTime,
          p99ResponseTime,
        },
      };
    } catch (error) {
      console.error('Failed to get search metrics:', error);
      throw error;
    }
  }

  async getSearchHealthStatus(): Promise<SearchHealthStatus> {
    try {
      const now = new Date();
      const recentPeriod = {
        start: new Date(now.getTime() - 5 * 60 * 1000), // Last 5 minutes
        end: now,
      };

      const recentSearches = await prisma.searchAnalytics.findMany({
        where: {
          createdAt: {
            gte: recentPeriod.start,
            lte: recentPeriod.end,
          },
        },
      });

      // Calculate health score
      let score = 100;
      const checks = {
        responseTime: true,
        errorRate: true,
        resultQuality: true,
        systemResources: true,
      };

      // Check response time
      const avgResponseTime = recentSearches.length > 0
        ? recentSearches.reduce((sum, s) => sum + s.processingTime, 0) / recentSearches.length
        : 0;

      if (avgResponseTime > 2000) { // More than 2 seconds
        score -= 30;
        checks.responseTime = false;
      } else if (avgResponseTime > 1000) { // More than 1 second
        score -= 15;
      }

      // Check error rate (simplified)
      const errorRate = 0; // This would need to be tracked separately
      if (errorRate > 0.05) { // More than 5% error rate
        score -= 25;
        checks.errorRate = false;
      }

      // Check result quality
      const avgResults = recentSearches.length > 0
        ? recentSearches.reduce((sum, s) => sum + s.resultsCount, 0) / recentSearches.length
        : 0;

      if (avgResults < 1) {
        score -= 20;
        checks.resultQuality = false;
      } else if (avgResults < 3) {
        score -= 10;
      }

      // Check system resources (simplified)
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
      
      if (memoryUsageMB > 500) { // More than 500MB
        score -= 15;
        checks.systemResources = false;
      }

      // Determine overall status
      let status: SearchHealthStatus['status'] = 'healthy';
      if (score < 50) {
        status = 'unhealthy';
      } else if (score < 80) {
        status = 'degraded';
      }

      this.lastHealthCheck = now;

      return {
        status,
        score: Math.max(0, score),
        checks,
        lastCheck: now,
      };
    } catch (error) {
      console.error('Failed to get search health status:', error);
      return {
        status: 'unhealthy',
        score: 0,
        checks: {
          responseTime: false,
          errorRate: false,
          resultQuality: false,
          systemResources: false,
        },
        lastCheck: new Date(),
      };
    }
  }

  async getUsageReport(period: { start: Date; end: Date }): Promise<SearchUsageReport> {
    try {
      const searches = await prisma.searchAnalytics.findMany({
        where: {
          createdAt: {
            gte: period.start,
            lte: period.end,
          },
        },
      });

      const totalSearches = searches.length;
      const uniqueUsers = new Set(searches.map(s => s.userId).filter(Boolean)).size;
      const averageResultsPerSearch = searches.length > 0
        ? searches.reduce((sum, s) => sum + s.resultsCount, 0) / searches.length
        : 0;

      // Calculate click-through rate (simplified)
      const clickThroughRate = 0.25; // This would need actual click tracking

      // Get top content types
      const contentTypeCounts = new Map<string, number>();
      searches.forEach(search => {
        if (search.filters?.contentType) {
          const contentTypes = Array.isArray(search.filters.contentType) 
            ? search.filters.contentType 
            : [search.filters.contentType];
          
          contentTypes.forEach(type => {
            contentTypeCounts.set(type, (contentTypeCounts.get(type) || 0) + 1);
          });
        }
      });

      const topContentTypes = Array.from(contentTypeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate user satisfaction (simplified)
      const userSatisfaction = Math.min(100, 50 + (averageResultsPerSearch * 5) + (clickThroughRate * 100));

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        totalSearches,
        averageResponseTime: searches.reduce((sum, s) => sum + s.processingTime, 0) / searches.length,
        uniqueUsers,
        clickThroughRate,
      });

      return {
        period,
        totalSearches,
        uniqueUsers,
        averageResultsPerSearch,
        clickThroughRate,
        topContentTypes,
        userSatisfaction,
        recommendations,
      };
    } catch (error) {
      console.error('Failed to get usage report:', error);
      throw error;
    }
  }

  async getAlerts(activeOnly: boolean = true): Promise<SearchPerformanceAlert[]> {
    if (activeOnly) {
      return this.alerts.filter(alert => !alert.resolved);
    }
    return [...this.alerts];
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);
    if (alertIndex !== -1) {
      this.alerts[alertIndex].resolved = true;
      this.alerts[alertIndex].resolvedAt = new Date();
      return true;
    }
    return false;
  }

  private async checkPerformanceAlerts(searchData: {
    query: string;
    responseTime: number;
    resultsCount: number;
  }): Promise<void> {
    // Slow response alert
    if (searchData.responseTime > 5000) { // More than 5 seconds
      const alert: SearchPerformanceAlert = {
        id: `slow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'slow_response',
        severity: searchData.responseTime > 10000 ? 'high' : 'medium',
        message: `Slow search response: ${searchData.responseTime}ms for query "${searchData.query}"`,
        timestamp: new Date(),
        resolved: false,
      };
      this.alerts.push(alert);
      console.warn('Search performance alert:', alert.message);
    }

    // Low result count alert
    if (searchData.resultsCount === 0) {
      const alert: SearchPerformanceAlert = {
        id: `no_results_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'low_result_count',
        severity: 'medium',
        message: `No results found for query: "${searchData.query}"`,
        timestamp: new Date(),
        resolved: false,
      };
      this.alerts.push(alert);
      console.warn('Search result alert:', alert.message);
    }
  }

  private updateMetricsCache(searchData: {
    query: string;
    responseTime: number;
    resultsCount: number;
  }): void {
    const now = new Date();
    const cacheKey = `metrics_${now.toISOString().slice(0, 10)}`; // Daily cache key

    if (!this.metricsCache.has(cacheKey)) {
      this.metricsCache.set(cacheKey, {
        totalSearches: 0,
        totalResponseTime: 0,
        totalResults: 0,
        queries: new Map(),
      });
    }

    const cached = this.metricsCache.get(cacheKey);
    cached.totalSearches++;
    cached.totalResponseTime += searchData.responseTime;
    cached.totalResults += searchData.resultsCount;
    
    const queryCount = cached.queries.get(searchData.query) || 0;
    cached.queries.set(searchData.query, queryCount + 1);

    // Clean old cache entries
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    for (const [key] of this.metricsCache) {
      if (key < `metrics_${weekAgo.toISOString().slice(0, 10)}`) {
        this.metricsCache.delete(key);
      }
    }
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private generateRecommendations(metrics: {
    totalSearches: number;
    averageResponseTime: number;
    uniqueUsers: number;
    clickThroughRate: number;
  }): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (metrics.averageResponseTime > 2000) {
      recommendations.push('Consider optimizing search queries or adding caching to improve response times');
    }

    if (metrics.averageResponseTime > 5000) {
      recommendations.push('Search performance is critically slow - investigate database queries and indexing');
    }

    // Usage recommendations
    if (metrics.uniqueUsers === 0) {
      recommendations.push('No users are utilizing the search functionality - consider promoting its features');
    }

    if (metrics.totalSearches < 10) {
      recommendations.push('Search usage is low - consider improving search UI/UX');
    }

    // Click-through rate recommendations
    if (metrics.clickThroughRate < 0.1) {
      recommendations.push('Low click-through rate suggests poor search result relevance - consider improving ranking algorithms');
    }

    if (metrics.clickThroughRate < 0.05) {
      recommendations.push('Critically low click-through rate - review search result quality and relevance scoring');
    }

    return recommendations;
  }

  private startMonitoring(): void {
    // Clean up resolved alerts older than 7 days
    setInterval(() => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.alerts = this.alerts.filter(alert => 
        !alert.resolved || alert.resolvedAt && alert.resolvedAt > weekAgo
      );
    }, 24 * 60 * 60 * 1000); // Clean up daily
  }

  private startPeriodicHealthChecks(): void {
    // Perform health checks every minute
    setInterval(async () => {
      try {
        const healthStatus = await this.getSearchHealthStatus();
        
        if (healthStatus.status === 'unhealthy') {
          console.error('Search system health check failed:', healthStatus);
          
          // Create alert for unhealthy system
          const alert: SearchPerformanceAlert = {
            id: `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'system_overload',
            severity: 'critical',
            message: `Search system is unhealthy (score: ${healthStatus.score})`,
            timestamp: new Date(),
            resolved: false,
          };
          
          if (!this.alerts.some(a => a.type === 'system_overload' && !a.resolved)) {
            this.alerts.push(alert);
          }
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 60 * 1000); // Check every minute
  }

  async getRealTimeMetrics(): Promise<{
    activeSearches: number;
    averageResponseTime: number;
    errorRate: number;
    systemLoad: number;
  }> {
    // This would integrate with real-time monitoring systems
    // For now, return simplified metrics
    return {
      activeSearches: 0,
      averageResponseTime: 0,
      errorRate: 0,
      systemLoad: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
    };
  }
}

export const searchAnalyticsService = new SearchAnalyticsService();