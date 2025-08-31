"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerImplementation = void 0;
const integration_1 = __importDefault(require("../../config/integration"));
const logger_1 = require("./logger");
class CircuitBreakerImplementation {
    constructor(service) {
        this.service = service;
        this.logger = new logger_1.IntegrationLoggerImplementation();
        const config = integration_1.default.circuitBreaker;
        this.failureThreshold = config.errorThresholdPercentage;
        this.timeout = config.timeout;
        this.resetTimeout = config.resetTimeout;
        this.state = {
            isOpen: false,
            failureCount: 0
        };
    }
    async execute(operation) {
        if (this.state.isOpen) {
            if (this.shouldAttemptReset()) {
                this.logger.info('Circuit breaker attempting reset', { service: this.service });
                return this.attemptReset(operation);
            }
            else {
                throw new Error(`Circuit breaker is open for service: ${this.service}`);
            }
        }
        try {
            const result = await this.executeWithTimeout(operation);
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    async executeWithTimeout(operation) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Operation timeout for service: ${this.service}`));
            }, this.timeout);
            operation()
                .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }
    shouldAttemptReset() {
        if (!this.state.nextAttemptTime) {
            return false;
        }
        return new Date() >= this.state.nextAttemptTime;
    }
    async attemptReset(operation) {
        try {
            const result = await this.executeWithTimeout(operation);
            this.reset();
            this.logger.info('Circuit breaker reset successful', { service: this.service });
            return result;
        }
        catch (error) {
            this.state.nextAttemptTime = new Date(Date.now() + this.resetTimeout);
            this.logger.warn('Circuit breaker reset failed', { service: this.service, error });
            throw error;
        }
    }
    onSuccess() {
        this.state.failureCount = 0;
        if (this.state.isOpen) {
            this.logger.info('Circuit breaker closed', { service: this.service });
            this.state.isOpen = false;
        }
    }
    onFailure() {
        this.state.failureCount++;
        this.state.lastFailureTime = new Date();
        if (this.state.failureCount >= this.failureThreshold) {
            this.open();
        }
    }
    open() {
        this.state.isOpen = true;
        this.state.nextAttemptTime = new Date(Date.now() + this.resetTimeout);
        this.logger.warn('Circuit breaker opened', {
            service: this.service,
            failureCount: this.state.failureCount,
            nextAttemptTime: this.state.nextAttemptTime
        });
    }
    getState() {
        return { ...this.state };
    }
    reset() {
        this.state = {
            isOpen: false,
            failureCount: 0
        };
        this.logger.info('Circuit breaker manually reset', { service: this.service });
    }
    forceOpen() {
        this.state.isOpen = true;
        this.state.nextAttemptTime = new Date(Date.now() + this.resetTimeout);
        this.logger.info('Circuit breaker manually opened', { service: this.service });
    }
    forceClose() {
        this.reset();
        this.logger.info('Circuit breaker manually closed', { service: this.service });
    }
}
exports.CircuitBreakerImplementation = CircuitBreakerImplementation;
//# sourceMappingURL=circuitBreaker.js.map