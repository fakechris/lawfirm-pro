import { UserProfile, CreateUserProfileRequest } from '../types';
export declare class UserProfileService {
    static createProfile(userId: string, data: CreateUserProfileRequest, ipAddress?: string, userAgent?: string): Promise<UserProfile>;
    static getProfileByUserId(userId: string): Promise<UserProfile | null>;
    static getFullProfileByUserId(userId: string): Promise<{
        user: any;
        profile: UserProfile | null;
    } | null>;
    static updateProfile(userId: string, data: Partial<CreateUserProfileRequest>, ipAddress?: string, userAgent?: string): Promise<UserProfile | null>;
    static deleteProfile(userId: string, ipAddress?: string, userAgent?: string): Promise<boolean>;
    static getProfilesByDepartment(department: string): Promise<UserProfile[]>;
    static getProfilesBySpecialization(specialization: string): Promise<UserProfile[]>;
    static getDepartmentStats(): Promise<{
        department: string;
        count: number;
    }[]>;
    static getSpecializationStats(): Promise<{
        specialization: string;
        count: number;
    }[]>;
    static searchUsers(filters: {
        department?: string;
        specialization?: string;
        yearsOfExperience?: {
            min?: number;
            max?: number;
        };
        licenseNumber?: string;
        isActive?: boolean;
    }): Promise<{
        users: any[];
        total: number;
    }>;
    static getUserDirectory(params: {
        page?: number;
        limit?: number;
        search?: string;
        department?: string;
        specialization?: string;
        isActive?: boolean;
        sortBy?: 'name' | 'email' | 'department' | 'createdAt';
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        users: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    static updateNotificationPreferences(userId: string, preferences: Record<string, any>, ipAddress?: string, userAgent?: string): Promise<UserProfile | null>;
    static getNotificationPreferences(userId: string): Promise<Record<string, any>>;
    static getEmergencyContact(userId: string): Promise<{
        contact: string;
        phone: string;
    } | null>;
    static updateEmergencyContact(userId: string, contact: string, phone: string, ipAddress?: string, userAgent?: string): Promise<UserProfile | null>;
    static getProfessionalInfo(userId: string): Promise<{
        title?: string;
        department?: string;
        specialization?: string;
        licenseNumber?: string;
        yearsOfExperience?: number;
        bio?: string;
    } | null>;
    static updateProfessionalInfo(userId: string, data: {
        title?: string;
        department?: string;
        specialization?: string;
        licenseNumber?: string;
        yearsOfExperience?: number;
        bio?: string;
    }, ipAddress?: string, userAgent?: string): Promise<UserProfile | null>;
    static getContactInfo(userId: string): Promise<{
        address?: string;
        city?: string;
        province?: string;
        country?: string;
        postalCode?: string;
        phone?: string;
        email?: string;
    } | null>;
    static updateContactInfo(userId: string, data: {
        address?: string;
        city?: string;
        province?: string;
        country?: string;
        postalCode?: string;
        phone?: string;
    }, ipAddress?: string, userAgent?: string): Promise<{
        user: any;
        profile: UserProfile | null;
    }>;
    static getUserPreferences(userId: string): Promise<{
        language: string;
        timezone: string;
        notifications: Record<string, any>;
    }>;
    static updateUserPreferences(userId: string, preferences: {
        language?: string;
        timezone?: string;
        notifications?: Record<string, any>;
    }, ipAddress?: string, userAgent?: string): Promise<UserProfile | null>;
}
//# sourceMappingURL=UserProfileService.d.ts.map