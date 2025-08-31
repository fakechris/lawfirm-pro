import { Logger } from '../../utils/logger';

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface MetricAggregation {
  name: string;
  type: 'sum' | 'avg' | 'min' | 'max' | 'count';
  period: number; // in seconds
  tags: Record<string, string>;
}

export interface MetricQuery {
  name?: string;
  tags?: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  aggregation?: MetricAggregation;
}

export interface ServiceMetrics {
  serviceName: string;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
  errorRate: number;
  lastRequestTime: Date;
  uptime: number;
}

export interface SystemMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
}

export class MetricsCollector {
  private logger: Logger;
  private metrics: MetricData[];
  private aggregations: Map<string, MetricAggregation>;
  private serviceMetrics: Map<string, ServiceMetrics>;
  private startTime: Date;

  constructor() {
    this.logger = new Logger('MetricsCollector');
    this.metrics = [];
    this.aggregations = new Map();
    this.serviceMetrics = new Map();
    this.startTime = new Date();
    
    this.initializeServiceMetrics();
    this.startPeriodicTasks();
  }

  recordCounter(
    name: string, 
    value: number = 1, 
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    try {
      const metric: MetricData = {
        name,
        value,
        timestamp: new Date(),
        tags,
        metadata
      };

      this.metrics.push(metric);
      this.updateServiceMetrics(metric);
      
      // Keep only last 50,000 metrics to prevent memory issues
      if (this.metrics.length > 50000) {
        this.metrics = this.metrics.slice(-50000);
      }
      
      this.logger.debug('Counter metric recorded', { metric });
    } catch (error) {
      this.logger.error('Error recording counter metric', { error, name, value, tags });
    }
  }

  recordGauge(
    name: string, 
    value: number, 
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    try {
      const metric: MetricData = {
        name,
        value,
        timestamp: new Date(),
        tags,
        metadata
      };

      this.metrics.push(metric);
      
      // Keep only last 50,000 metrics
      if (this.metrics.length > 50000) {
        this.metrics = this.metrics.slice(-50000);
      }
      
      this.logger.debug('Gauge metric recorded', { metric });
    } catch (error) {
      this.logger.error('Error recording gauge metric', { error, name, value, tags });
    }
  }

  recordTiming(
    name: string, 
    value: number, 
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    try {
      const metric: MetricData = {
        name,
        value,
        timestamp: new Date(),
        tags,
        metadata
      };

      this.metrics.push(metric);
      this.updateServiceMetrics(metric);
      
      // Keep only last 50,000 metrics
      if (this.metrics.length > 50000) {
        this.metrics = this.metrics.slice(-50000);
      }
      
      this.logger.debug('Timing metric recorded', { metric });
    } catch (error) {
      this.logger.error('Error recording timing metric', { error, name, value, tags });
    }
  }

  incrementCounter(
    name: string, 
    value: number = 1, 
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    this.recordCounter(name, value, tags, metadata);
  }

  async queryMetrics(query: MetricQuery): Promise<MetricData[]> {
    try {
      let filteredMetrics = [...this.metrics];

      // Filter by name
      if (query.name) {
        filteredMetrics = filteredMetrics.filter(m => m.name === query.name);
      }

      // Filter by tags
      if (query.tags) {
        filteredMetrics = filteredMetrics.filter(m => {
          return Object.entries(query.tags!).every(([key, value]) => m.tags[key] === value);
        });
      }

      // Filter by time range
      if (query.startTime) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp >= query.startTime!);
      }
      if (query.endTime) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp <= query.endTime!);
      }

      // Apply aggregation if specified
      if (query.aggregation) {
        return this.aggregateMetrics(filteredMetrics, query.aggregation);
      }

      return filteredMetrics;
    } catch (error) {
      this.logger.error('Error querying metrics', { error, query });
      return [];
    }
  }

  async getServiceMetrics(serviceName: string): Promise<ServiceMetrics | null> {
    return this.serviceMetrics.get(serviceName) || null;
  }

  async getAllServiceMetrics(): Promise<ServiceMetrics[]> {
    return Array.from(this.serviceMetrics.values());
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const serviceMetrics = Array.from(this.serviceMetrics.values());
      const totalRequests = serviceMetrics.reduce((sum, m) => sum + m.requestCount, 0);
      const successfulRequests = totalRequests - serviceMetrics.reduce((sum, m) => sum + m.errorCount, 0);
      const failedRequests = totalRequests - successfulRequests;
      const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
      
      const avgResponseTime = serviceMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / serviceMetrics.length || 0;

      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: avgResponseTime,
        errorRate,
        activeConnections: serviceMetrics.length,
        memoryUsage: memUsage,
        cpuUsage,
        uptime: Date.now() - this.startTime.getTime()
      };
    } catch (error) {
      this.logger.error('Error getting system metrics', { error });
      throw error;
    }
  }

  async createAggregation(aggregation: MetricAggregation): Promise<void> {
    const key = this.getAggregationKey(aggregation);
    this.aggregations.set(key, aggregation);
    this.logger.info('Metric aggregation created', { aggregation });
  }

  async removeAggregation(name: string, tags: Record<string, string>): Promise<void> {
    const key = this.getAggregationKey({ name, type: 'sum', period: 0, tags });
    this.aggregations.delete(key);
    this.logger.info('Metric aggregation removed', { name, tags });
  }

  async getAggregations(): Promise<MetricAggregation[]> {
    return Array.from(this.aggregations.values());
  }

  async getTopMetrics(limit: number = 10): Promise<Array<{ name: string; count: number }>> {
    const metricCounts = new Map<string, number>();
    
    this.metrics.forEach(metric => {
      const count = metricCounts.get(metric.name) || 0;
      metricCounts.set(metric.name, count + 1);
    });

    return Array.from(metricCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getMetricsByTimeRange(
    startTime: Date, 
    endTime: Date,
    interval: number = 3600 // 1 hour default
  ): Promise<Array<{ time: Date; metrics: MetricData[] }>> {
    try {
      const timeBuckets = new Map<string, MetricData[]>();
      
      this.metrics.forEach(metric => {
        if (metric.timestamp >= startTime && metric.timestamp <= endTime) {
          const bucketKey = this.getTimeBucketKey(metric.timestamp, interval);
          if (!timeBuckets.has(bucketKey)) {
            timeBuckets.set(bucketKey, []);
          }
          timeBuckets.get(bucketKey)!.push(metric);
        }
      });

      return Array.from(timeBuckets.entries())
        .map(([bucketKey, metrics]) => ({
          time: new Date(parseInt(bucketKey) * 1000),
          metrics
        }))
        .sort((a, b) => a.time.getTime() - b.time.getTime());
    } catch (error) {
      this.logger.error('Error getting metrics by time range', { error, startTime, endTime });
      return [];
    }
  }

  private initializeServiceMetrics(): void {
    const services = [
      'pacer', 'stripe', 'paypal', 'lexisnexis', 'westlaw',
      'google_drive', 'dropbox', 'twilio', 'sendgrid'
    ];
    
    services.forEach(service => {
      this.serviceMetrics.set(service, {
        serviceName: service,
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        lastRequestTime: new Date(),
        uptime: 0
      });
    });
  }

  private startPeriodicTasks(): void {
    // Update system metrics every minute
    setInterval(() => {
      this.updateSystemMetrics();
    }, 60000);

    // Calculate percentiles every 5 minutes
    setInterval(() => {
      this.calculatePercentiles();
    }, 300000);

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  private updateServiceMetrics(metric: MetricData): void {
    const service = metric.tags.service;
    if (!service) return;

    const serviceMetrics = this.serviceMetrics.get(service);
    if (!serviceMetrics) return;

    serviceMetrics.requestCount++;
    serviceMetrics.lastRequestTime = metric.timestamp;

    if (metric.name === 'response_time') {
      // Update average response time
      const currentAvg = serviceMetrics.averageResponseTime;
      const currentCount = serviceMetrics.requestCount - 1;
      serviceMetrics.averageResponseTime = 
        (currentAvg * currentCount + metric.value) / serviceMetrics.requestCount;
    }

    if (metric.name === 'error_count') {
      serviceMetrics.errorCount++;
    }

    // Update error rate
    serviceMetrics.errorRate = serviceMetrics.requestCount > 0 
      ? serviceMetrics.errorCount / serviceMetrics.requestCount 
      : 0;

    // Update throughput (requests per second in last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentRequests = this.metrics.filter(m => 
      m.tags.service === service && 
      m.timestamp > oneMinuteAgo &&
      (m.name === 'request_count' || m.name === 'response_time')
    ).length;
    
    serviceMetrics.throughput = recentRequests / 60;

    this.serviceMetrics.set(service, serviceMetrics);
  }

  private updateSystemMetrics(): void {
    // Update uptime for all services
    const uptime = Date.now() - this.startTime.getTime();
    this.serviceMetrics.forEach(metrics => {
      metrics.uptime = uptime;
    });
  }

  private calculatePercentiles(): void {
    this.serviceMetrics.forEach(serviceMetrics => {
      const responseTimes = this.metrics
        .filter(m => m.tags.service === serviceMetrics.serviceName && m.name === 'response_time')
        .map(m => m.value)
        .sort((a, b) => a - b);

      if (responseTimes.length > 0) {
        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);
        
        serviceMetrics.p95ResponseTime = responseTimes[p95Index] || 0;
        serviceMetrics.p99ResponseTime = responseTimes[p99Index] || 0;
      }
    });
  }

  private cleanupOldMetrics(): void {
    // Keep only last 7 days of metrics
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);
    
    this.logger.info('Old metrics cleaned up', { 
      remainingMetrics: this.metrics.length,
      cutoffTime
    });
  }

  private aggregateMetrics(metrics: MetricData[], aggregation: MetricAggregation): MetricData[] {
    const grouped = new Map<string, MetricData[]>();
    
    metrics.forEach(metric => {
      const key = this.getAggregationKey({ ...aggregation, name: metric.name });
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });

    return Array.from(grouped.entries()).map(([key, groupMetrics]) => {
      const aggregatedValue = this.calculateAggregation(groupMetrics, aggregation.type);
      
      return {
        name: aggregation.name,
        value: aggregatedValue,
        timestamp: new Date(),
        tags: aggregation.tags,
        metadata: { 
          aggregation: aggregation.type,
          period: aggregation.period,
          count: groupMetrics.length
        }
      };
    });
  }

  private calculateAggregation(metrics: MetricData[], type: 'sum' | 'avg' | 'min' | 'max' | 'count'): number {
    switch (type) {
      case 'sum':
        return metrics.reduce((sum, m) => sum + m.value, 0);
      case 'avg':
        return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
      case 'min':
        return Math.min(...metrics.map(m => m.value));
      case 'max':
        return Math.max(...metrics.map(m => m.value));
      case 'count':
        return metrics.length;
      default:
        return 0;
    }
  }

  private getAggregationKey(aggregation: Omit<MetricAggregation, 'type'>): string {
    const tags = Object.entries(aggregation.tags || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${aggregation.name}:${tags}`;
  }

  private getTimeBucketKey(timestamp: Date, interval: number): string {
    return Math.floor(timestamp.getTime() / 1000 / interval).toString();
  }
}