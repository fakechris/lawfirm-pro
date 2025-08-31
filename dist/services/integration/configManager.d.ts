export declare class ConfigManagerImplementation {
    private logger;
    private encryptedFields;
    constructor();
    getServiceConfig(service: string): any;
    getGatewayConfig(): any;
    getCircuitBreakerConfig(): any;
    getRateLimitConfig(): any;
    getCacheConfig(): any;
    getWebhookConfig(): any;
    encryptValue(value: string, service: string): Promise<string>;
    decryptValue(encryptedValue: string, service: string): Promise<string>;
    secureConfig(config: any, service: string): Promise<any>;
    revealConfig(securedConfig: any, service: string): Promise<any>;
    validateConfig(config: any, service: string): {
        valid: boolean;
        errors: string[];
    };
    private getEncryptionKey;
    private getRequiredFields;
    private getUrlFields;
    private isValidUrl;
    rotateApiKey(service: string, oldKey: string, newKey: string): Promise<boolean>;
    getActiveServices(): Promise<string[]>;
}
//# sourceMappingURL=configManager.d.ts.map