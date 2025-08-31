import { CircuitState, CircuitBreaker } from './types';
import integrationConfig from '../../config/integration';
import { IntegrationLoggerImplementation } from './logger';

export class CircuitBreakerImplementation implements CircuitBreaker {
  private service: string;
  private state: CircuitState;
  private failureThreshold: number;
  private timeout: number;
  private resetTimeout: number;
  private logger: IntegrationLoggerImplementation;

  constructor(service: string) {
    this.service = service;
    this.logger = new IntegrationLoggerImplementation();
    
    const config = integrationConfig.circuitBreaker;
    this.failureThreshold = config.errorThresholdPercentage;
    this.timeout = config.timeout;
    this.resetTimeout = config.resetTimeout;
    
    this.state = {
      isOpen: false,
      failureCount: 0
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.isOpen) {
      if (this.shouldAttemptReset()) {
        this.logger.info('Circuit breaker attempting reset', { service: this.service });
        return this.attemptReset(operation);
      } else {
        throw new Error(`Circuit breaker is open for service: ${this.service}`);
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
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

  private shouldAttemptReset(): boolean {
    if (!this.state.nextAttemptTime) {
      return false;
    }
    return new Date() >= this.state.nextAttemptTime;
  }

  private async attemptReset<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await this.executeWithTimeout(operation);
      this.reset();
      this.logger.info('Circuit breaker reset successful', { service: this.service });
      return result;
    } catch (error) {
      this.state.nextAttemptTime = new Date(Date.now() + this.resetTimeout);
      this.logger.warn('Circuit breaker reset failed', { service: this.service, error });
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failureCount = 0;
    if (this.state.isOpen) {
      this.logger.info('Circuit breaker closed', { service: this.service });
      this.state.isOpen = false;
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = new Date();

    if (this.state.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    this.state.isOpen = true;
    this.state.nextAttemptTime = new Date(Date.now() + this.resetTimeout);
    this.logger.warn('Circuit breaker opened', { 
      service: this.service, 
      failureCount: this.state.failureCount,
      nextAttemptTime: this.state.nextAttemptTime
    });
  }

  getState(): CircuitState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      isOpen: false,
      failureCount: 0
    };
    this.logger.info('Circuit breaker manually reset', { service: this.service });
  }

  forceOpen(): void {
    this.state.isOpen = true;
    this.state.nextAttemptTime = new Date(Date.now() + this.resetTimeout);
    this.logger.info('Circuit breaker manually opened', { service: this.service });
  }

  forceClose(): void {
    this.reset();
    this.logger.info('Circuit breaker manually closed', { service: this.service });
  }
}