import { PrismaClient } from '@prisma/client';
export interface SecurityTestResult {
    test: string;
    status: 'PASSED' | 'FAILED' | 'WARNING';
    details: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendations: string[];
    timestamp: Date;
}
export interface VulnerabilityScan {
    type: 'SQL_INJECTION' | 'XSS' | 'CSRF' | 'AUTH_BYPASS' | 'FILE_UPLOAD' | 'DIRECTORY_TRAVERSAL';
    target: string;
    found: boolean;
    description: string;
    evidence?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export interface SecurityAudit {
    overallScore: number;
    results: SecurityTestResult[];
    vulnerabilities: VulnerabilityScan[];
    recommendations: string[];
    testedAt: Date;
}
export declare class DocumentSecurityService {
    private prisma;
    constructor(prisma: PrismaClient);
    performSecurityAudit(): Promise<SecurityAudit>;
    private testSqlInjectionProtection;
    private testXssProtection;
    private testAuthentication;
    private testAuthorization;
    private testFileUploadSecurity;
    private testDataEncryption;
    private testAccessControls;
    private testInputValidation;
    private testSessionManagement;
    private testLoggingAndMonitoring;
    private scanForSqlInjection;
    private scanForXss;
    private scanForFileUploadVulnerabilities;
    private scanForAuthenticationBypass;
    private isFileTypeAllowed;
    private validateInput;
    private generateRecommendations;
}
export declare const documentSecurityService: DocumentSecurityService;
//# sourceMappingURL=securityService.d.ts.map