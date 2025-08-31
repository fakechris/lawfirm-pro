import { RateLimitResult } from './types';
import integrationConfig from '../../config/integration';
import { IntegrationLoggerImplementation } from './logger';

interface RateLimitEntry {
  count: number;
  resetTime: Date;
}

export class RateLimiterImplementation {
  private service: string;
  private limits: Map<string, RateLimitEntry> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private logger: IntegrationLoggerImplementation;

  constructor(service: string) {
    this.service = service;
    this.logger = new IntegrationLoggerImplementation();
    
    const config = integrationConfig.rateLimit;
    this.windowMs = config.windowMs;
    this.maxRequests = config.max;

    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60000); // Clean up every minute
  }

  checkLimit(identifier: string): RateLimitResult {
    const now = new Date();
    const entry = this.limits.get(identifier);

    // Reset window if expired
    if (!entry || now > entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: new Date(now.getTime() + this.windowMs)
      };
      this.limits.set(identifier, newEntry);

      this.logger.debug('Rate limit window reset', {
        service: this.service,
        identifier,
        count: 1,
        resetTime: newEntry.resetTime
      });

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: newEntry.resetTime
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      this.logger.warn('Rate limit exceeded', {
        service: this.service,
        identifier,
        count: entry.count,
        maxRequests: this.maxRequests,
        resetTime: entry.resetTime
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        error: `Rate limit exceeded for ${this.service}. Try again after ${entry.resetTime.toISOString()}`
      };
    }

    // Increment counter
    entry.count++;
    this.limits.set(identifier, entry);

    this.logger.debug('Rate limit check passed', {
      service: this.service,
      identifier,
      count: entry.count,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    });

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    this.limits.forEach((entry, identifier) => {
      if (now > entry.resetTime) {
        keysToDelete.push(identifier);
      }
    });

    keysToDelete.forEach(identifier => {
      this.limits.delete(identifier);
    });

    if (keysToDelete.length > 0) {
      this.logger.debug('Rate limit cleanup completed', {
        service: this.service,
        cleanedEntries: keysToDelete.length,
        remainingEntries: this.limits.size
      });
    }
  }

  getStats(): {
    totalEntries: number;
    activeEntries: number;
    service: string;
  } {
    const now = new Date();
    let activeEntries = 0;

    this.limits.forEach((entry) => {
      if (now <= entry.resetTime) {
        activeEntries++;
      }
    });

    return {
      totalEntries: this.limits.size,
      activeEntries,
      service: this.service
    };
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.limits.delete(identifier);
      this.logger.debug('Rate limit reset for identifier', {
        service: this.service,
        identifier
      });
    } else {
      this.limits.clear();
      this.logger.debug('Rate limit reset for all identifiers', {
        service: this.service
      });
    }
  }
}