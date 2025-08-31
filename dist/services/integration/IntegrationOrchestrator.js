"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationOrchestrator = void 0;
const logger_1 = require("../../utils/logger");
class IntegrationOrchestrator {
    constructor() {
        this.logger = new logger_1.Logger('IntegrationOrchestrator');
        this.workflows = new Map();
        this.executionHistory = new Map();
        this.initializeWorkflows();
    }
    async executeWorkflow(workflowId, context) {
        try {
            this.logger.info('Executing workflow', { workflowId, executionId: context.executionId });
            const workflow = this.workflows.get(workflowId);
            if (!workflow) {
                throw new Error(`Workflow ${workflowId} not found`);
            }
            const startTime = Date.now();
            const execution = {
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
            }
            catch (error) {
                execution.status = 'FAILED';
                execution.endTime = new Date();
                execution.duration = Date.now() - startTime;
                execution.error = error instanceof Error ? error.message : 'Unknown error';
                throw error;
            }
            finally {
                this.executionHistory.set(context.executionId, execution);
            }
        }
        catch (error) {
            this.logger.error('Error executing workflow', { error, workflowId, executionId: context.executionId });
            throw error;
        }
    }
    async coordinateServices(services, strategy = 'SEQUENTIAL') {
        try {
            this.logger.info('Coordinating services', { serviceCount: services.length, strategy });
            const startTime = Date.now();
            const results = [];
            const errors = [];
            switch (strategy) {
                case 'SEQUENTIAL':
                    for (const serviceCall of services) {
                        try {
                            const result = await this.executeServiceCall(serviceCall);
                            results.push(result);
                            if (!result.success) {
                                errors.push(`Service ${serviceCall.service} failed: ${result.error}`);
                                break;
                            }
                        }
                        catch (error) {
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
                    const promises = services.map(serviceCall => this.executeServiceCall(serviceCall).catch(error => ({
                        service: serviceCall.service,
                        operation: serviceCall.operation,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        duration: 0
                    })));
                    const parallelResults = await Promise.all(promises);
                    results.push(...parallelResults);
                    parallelResults.forEach(result => {
                        if (!result.success) {
                            errors.push(`Service ${result.service} failed: ${result.error}`);
                        }
                    });
                    break;
                case 'FAN_OUT_FAN_IN':
                    const fanOutPromises = services.map(serviceCall => this.executeServiceCall(serviceCall).catch(error => ({
                        service: serviceCall.service,
                        operation: serviceCall.operation,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        duration: 0
                    })));
                    const fanOutResults = await Promise.all(fanOutPromises);
                    results.push(...fanOutResults);
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
        }
        catch (error) {
            this.logger.error('Error coordinating services', { error, services, strategy });
            throw error;
        }
    }
    async executeWithRetry(operation, config = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
    }) {
        let lastError = null;
        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (attempt === config.maxAttempts) {
                    break;
                }
                const delay = Math.min(config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1), config.maxDelay);
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
    async executeTransaction(operations) {
        try {
            this.logger.info('Executing transaction', { operationCount: operations.length });
            const transactionId = this.generateTransactionId();
            const startTime = Date.now();
            const results = [];
            const compensations = [];
            try {
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
            }
            catch (error) {
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
                        }
                        catch (compError) {
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
        }
        catch (error) {
            this.logger.error('Error executing transaction', { error, operations });
            throw error;
        }
    }
    async executeWorkflowSteps(workflow, context) {
        const startTime = Date.now();
        const steps = [];
        for (const step of workflow.steps) {
            try {
                const stepStartTime = Date.now();
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
                const stepResult = {
                    stepId: step.id,
                    serviceName: step.service,
                    operation: step.operation,
                    success: result.success,
                    data: result.data,
                    error: result.error,
                    duration: stepDuration,
                    retryCount: 0
                };
                steps.push(stepResult);
                if (result.success) {
                    context.state[step.id] = result.data;
                }
                if (!result.success && !step.optional) {
                    return {
                        success: false,
                        error: `Step ${step.id} failed: ${result.error}`,
                        steps,
                        duration: Date.now() - startTime,
                        context
                    };
                }
            }
            catch (error) {
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
    async executeServiceCall(serviceCall) {
        this.logger.info('Executing service call', {
            service: serviceCall.service,
            operation: serviceCall.operation
        });
        const startTime = Date.now();
        try {
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
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
        }
        catch (error) {
            return {
                service: serviceCall.service,
                operation: serviceCall.operation,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime
            };
        }
    }
    async aggregateResults(results) {
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
    generateTransactionId() {
        return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    initializeWorkflows() {
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
exports.IntegrationOrchestrator = IntegrationOrchestrator;
//# sourceMappingURL=IntegrationOrchestrator.js.map