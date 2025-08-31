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
export declare class IntegrationOrchestrator {
    private logger;
    private workflows;
    private executionHistory;
    constructor();
    executeWorkflow(workflowId: string, context: WorkflowContext): Promise<WorkflowResult>;
    coordinateServices(services: ServiceCall[], strategy?: CoordinationStrategy): Promise<CoordinationResult>;
    executeWithRetry<T>(operation: () => Promise<T>, config?: RetryConfig): Promise<T>;
    executeTransaction(operations: TransactionalOperation[]): Promise<TransactionResult>;
    private executeWorkflowSteps;
    private executeServiceCall;
    private aggregateResults;
    private generateTransactionId;
    private initializeWorkflows;
}
type CoordinationStrategy = 'SEQUENTIAL' | 'PARALLEL' | 'FAN_OUT_FAN_IN';
export {};
//# sourceMappingURL=IntegrationOrchestrator.d.ts.map