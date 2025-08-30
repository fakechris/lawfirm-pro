import { UserRole } from '@prisma/client';
export declare class Utils {
    static hashPassword(password: string): Promise<string>;
    static comparePassword(password: string, hash: string): Promise<boolean>;
    static generateToken(payload: any): string;
    static verifyToken(token: string): any;
    static generateId(): string;
    static formatDate(date: Date): string;
    static formatDateTime(date: Date): string;
    static generateInvoiceNumber(): string;
    static validateEmail(email: string): boolean;
    static validatePassword(password: string): {
        isValid: boolean;
        errors: string[];
    };
    static sanitizeUser(user: any): any;
    static getCaseTypeLabel(caseType: string): string;
    static getCaseStatusLabel(status: string): string;
    static getCasePhaseLabel(phase: string): string;
    static getUserRoleLabel(role: UserRole): string;
    static calculateFileSize(bytes: number): string;
    static isValidFileType(filename: string, allowedTypes: string[]): boolean;
    static removeSensitiveData(data: any, fields: string[]): any;
}
//# sourceMappingURL=index.d.ts.map