import { Logger } from '../../utils/logger';

export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  parameters: Record<string, any>;
  state: Record<string, any>;
  startTime: Date;
  userId?: string;
}

export interface WorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
  steps: WorkflowStepResult[];
  duration: number;
  context: WorkflowContext;
}

export interface WorkflowStepResult {
  stepId: string;
  serviceName: string;
  operation: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  retryCount: number;
}

export interface ServiceCall {
  service: string;
  operation: string;
  parameters: Record<string, any>;
  timeout?: number;
  retryConfig?: RetryConfig;
}

export interface CoordinationResult {
  success: boolean;
  results: ServiceResult[];
  errors: string[];
  duration: number;
}

export interface ServiceResult {
  service: string;
  operation: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface TransactionalOperation {
  id: string;
  service: string;
  operation: string;
  parameters: Record<string, any>;
  compensation?: {
    service: string;
    operation: string;
    parameters: Record<string, any>;
  };
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  results: ServiceResult[];
  compensations: ServiceResult[];
  error?: string;
  duration: number;
}

export class IntegrationOrchestrator {
  private logger: Logger;
  private workflows: Map<string, WorkflowDefinition>;
  private executionHistory: Map<string, WorkflowExecution>;

  constructor() {
    this.logger = new Logger('IntegrationOrchestrator');
    this.workflows = new Map();
    this.executionHistory = new Map();
    this.initializeWorkflows();
  }

  async executeWorkflow(workflowId: string, context: WorkflowContext): Promise<WorkflowResult> {
    try {
      this.logger.info('Executing workflow', { workflowId, executionId: context.executionId });

      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const startTime = Date.now();
      const execution: WorkflowExecution = {
        id: context.executionId,
        workflowId,
        context,
        steps: [],
        startTime: new Date(),
        status: 'RUNNING'
      };

      this.executionHistory.set(context.executionId, execution);

      try {
        const result = await this.executeWorkflowSteps(workflow, context);
        
        execution.status = result.success ? 'COMPLETED' : 'FAILED';
        execution.endTime = new Date();
        execution.duration = Date.now() - startTime;

        return result;
      } catch (error) {
        execution.status = 'FAILED';
        execution.endTime = new Date();
        execution.duration = Date.now() - startTime;
        execution.error = error instanceof Error ? error.message : 'Unknown error';

        throw error;
      } finally {
        this.executionHistory.set(context.executionId, execution);
      }
    } catch (error) {
      this.logger.error('Error executing workflow', { error, workflowId, executionId: context.executionId });
      throw error;
    }
  }

  async coordinateServices(
    services: ServiceCall[],
    strategy: CoordinationStrategy = 'SEQUENTIAL'
  ): Promise<CoordinationResult> {
    try {
      this.logger.info('Coordinating services', { serviceCount: services.length, strategy });

      const startTime = Date.now();
      const results: ServiceResult[] = [];
      const errors: string[] = [];

      switch (strategy) {
        case 'SEQUENTIAL':
          for (const serviceCall of services) {
            try {
              const result = await this.executeServiceCall(serviceCall);
              results.push(result);
              
              if (!result.success) {
                errors.push(`Service ${serviceCall.service} failed: ${result.error}`);
                break; // Stop on first failure in sequential mode
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              errors.push(`Service ${serviceCall.service} failed: ${errorMsg}`);
              results.push({
                service: serviceCall.service,
                operation: serviceCall.operation,
                success: false,
                error: errorMsg,
                duration: 0
              });
              break;
            }
          }
          break;

        case 'PARALLEL':
          const promises = services.map(serviceCall => 
            this.executeServiceCall(serviceCall).catch(error => ({
              service: serviceCall.service,
              operation: serviceCall.operation,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              duration: 0
            }))
          );

          const parallelResults = await Promise.all(promises);
          results.push(...parallelResults);
          
          parallelResults.forEach(result => {
            if (!result.success) {
              errors.push(`Service ${result.service} failed: ${result.error}`);
            }
          });
          break;

        case 'FAN_OUT_FAN_IN':
          // Execute all services in parallel, then aggregate results
          const fanOutPromises = services.map(serviceCall => 
            this.executeServiceCall(serviceCall).catch(error => ({
              service: serviceCall.service,
              operation: serviceCall.operation,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              duration: 0
            }))
          );

          const fanOutResults = await Promise.all(fanOutPromises);
          results.push(...fanOutResults);
          
          // Aggregate results (custom logic would go here)
          const aggregationResult = await this.aggregateResults(fanOutResults);
          if (aggregationResult) {
            results.push(aggregationResult);
          }
          
          fanOutResults.forEach(result => {
            if (!result.success) {
              errors.push(`Service ${result.service} failed: ${result.error}`);
            }
          });
          break;
      }

      return {
        success: errors.length === 0,
        results,
        errors,
        duration: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Error coordinating services', { error, services, strategy });
      throw error;
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    }
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === config.maxAttempts) {
          break;
        }
        
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        this.logger.warn('Operation failed, retrying', { 
          attempt, 
          maxAttempts: config.maxAttempts,
          delay,
          error: lastError.message 
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  async executeTransaction(operations: TransactionalOperation[]): Promise<TransactionResult> {
    try {
      this.logger.info('Executing transaction', { operationCount: operations.length });

      const transactionId = this.generateTransactionId();
      const startTime = Date.now();
      const results: ServiceResult[] = [];
      const compensations: ServiceResult[] = [];

      try {
        // Execute operations in sequence
        for (const operation of operations) {
          const result = await this.executeServiceCall({
            service: operation.service,
            operation: operation.operation,
            parameters: operation.parameters
          });
          
          results.push(result);
          
          if (!result.success) {
            throw new Error(`Operation ${operation.id} failed: ${result.error}`);
          }
        }

        return {
          success: true,
          transactionId,
          results,
          compensations,
          duration: Date.now() - startTime
        };
      } catch (error) {
        // Execute compensations in reverse order
        for (let i = operations.length - 1; i >= 0; i--) {
          const operation = operations[i];
          if (operation.compensation) {
            try {
              const compensationResult = await this.executeServiceCall({
                service: operation.compensation.service,
                operation: operation.compensation.operation,
                parameters: operation.compensation.parameters
              });
              
              compensations.push(compensationResult);
            } catch (compError) {
              this.logger.error('Compensation failed', { 
                operationId: operation.id,
                error: compError instanceof Error ? compError.message : 'Unknown error'
              });
            }
          }
        }

        return {
          success: false,
          transactionId,
          results,
          compensations,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      this.logger.error('Error executing transaction', { error, operations });
      throw error;
    }
  }

  private async executeWorkflowSteps(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const steps: WorkflowStepResult[] = [];

    for (const step of workflow.steps) {
      try {
        const stepStartTime = Date.now();
        
        // Execute step with retry logic
        const result = await this.executeWithRetry(async () => {
          return await this.executeServiceCall({
            service: step.service,
            operation: step.operation,
            parameters: { ...step.parameters, ...context.parameters },
            timeout: step.timeout,
            retryConfig: step.retryConfig
          });
        }, step.retryConfig);

        const stepDuration = Date.now() - stepStartTime;
        
        const stepResult: WorkflowStepResult = {
          stepId: step.id,
          serviceName: step.service,
          operation: step.operation,
          success: result.success,
          data: result.data,
          error: result.error,
          duration: stepDuration,
          retryCount: 0 // Would be tracked in retry logic
        };

        steps.push(stepResult);

        // Update context with step result
        if (result.success) {
          context.state[step.id] = result.data;
        }

        // Handle step failure
        if (!result.success && !step.optional) {
          return {
            success: false,
            error: `Step ${step.id} failed: ${result.error}`,
            steps,
            duration: Date.now() - startTime,
            context
          };
        }
      } catch (error) {
        const stepDuration = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        steps.push({
          stepId: step.id,
          serviceName: step.service,
          operation: step.operation,
          success: false,
          error: errorMsg,
          duration: stepDuration,
          retryCount: 0
        });

        if (!step.optional) {
          return {
            success: false,
            error: `Step ${step.id} failed: ${errorMsg}`,
            steps,
            duration: Date.now() - startTime,
            context
          };
        }
      }
    }

    return {
      success: true,
      steps,
      duration: Date.now() - startTime,
      context
    };
  }

  private async executeServiceCall(serviceCall: ServiceCall): Promise<ServiceResult> {
    // Placeholder for actual service execution
    this.logger.info('Executing service call', { 
      service: serviceCall.service,
      operation: serviceCall.operation
    });

    const startTime = Date.now();
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      // Simulate occasional failures
      if (Math.random() < 0.1) {
        throw new Error('Simulated service failure');
      }

      return {
        service: serviceCall.service,
        operation: serviceCall.operation,
        success: true,
        data: { message: 'Service call successful' },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        service: serviceCall.service,
        operation: serviceCall.operation,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private async aggregateResults(results: ServiceResult[]): Promise<ServiceResult | null> {
    // Placeholder for result aggregation logic
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return null;
    }

    return {
      service: 'aggregator',
      operation: 'aggregate',
      success: true,
      data: {
        aggregated: true,
        resultCount: successfulResults.length,
        timestamp: new Date()
      },
      duration: 0
    };
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeWorkflows(): void {
    // Example workflows would be defined here
    this.workflows.set('case-filing', {
      id: 'case-filing',
      name: 'Case Filing Workflow',
      description: 'File a case with court system and update internal records',
      steps: [
        {
          id: 'validate-case',
          service: 'internal',
          operation: 'validateCase',
          parameters: {},
          optional: false
        },
        {
          id: 'file-with-court',
          service: 'pacer',
          operation: 'fileCase',
          parameters: {},
          optional: false,
          retryConfig: {
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 5000,
            backoffMultiplier: 2
          }
        },
        {
          id: 'update-internal-records',
          service: 'internal',
          operation: 'updateCaseRecord',
          parameters: {},
          optional: false
        }
      ]
    });
  }
}

// Type definitions
type CoordinationStrategy = 'SEQUENTIAL' | 'PARALLEL' | 'FAN_OUT_FAN_IN';

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  service: string;
  operation: string;
  parameters: Record<string, any>;
  optional?: boolean;
  timeout?: number;
  retryConfig?: RetryConfig;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  context: WorkflowContext;
  steps: WorkflowStepResult[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
}