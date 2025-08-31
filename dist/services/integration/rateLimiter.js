"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterImplementation = void 0;
const integration_1 = __importDefault(require("../../config/integration"));
const logger_1 = require("./logger");
class RateLimiterImplementation {
    constructor(service) {
        this.limits = new Map();
        this.service = service;
        this.logger = new logger_1.IntegrationLoggerImplementation();
        const config = integration_1.default.rateLimit;
        this.windowMs = config.windowMs;
        this.maxRequests = config.max;
        setInterval(() => this.cleanup(), 60000);
    }
    checkLimit(identifier) {
        const now = new Date();
        const entry = this.limits.get(identifier);
        if (!entry || now > entry.resetTime) {
            const newEntry = {
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
    cleanup() {
        const now = new Date();
        const keysToDelete = [];
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
    getStats() {
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
    reset(identifier) {
        if (identifier) {
            this.limits.delete(identifier);
            this.logger.debug('Rate limit reset for identifier', {
                service: this.service,
                identifier
            });
        }
        else {
            this.limits.clear();
            this.logger.debug('Rate limit reset for all identifiers', {
                service: this.service
            });
        }
    }
}
exports.RateLimiterImplementation = RateLimiterImplementation;
//# sourceMappingURL=rateLimiter.js.map