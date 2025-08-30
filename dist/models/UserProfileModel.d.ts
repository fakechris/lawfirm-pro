import { UserProfile, CreateUserProfileRequest } from '../types';
export declare class UserProfileModel {
    static create(data: CreateUserProfileRequest & {
        userId: string;
    }): Promise<UserProfile>;
    static findByUserId(userId: string): Promise<UserProfile | null>;
    static update(userId: string, data: Partial<CreateUserProfileRequest>): Promise<UserProfile | null>;
    static delete(userId: string): Promise<boolean>;
    static findByDepartment(department: string): Promise<UserProfile[]>;
    static findBySpecialization(specialization: string): Promise<UserProfile[]>;
    static getDepartmentStats(): Promise<{
        department: string;
        count: number;
    }[]>;
    static getSpecializationStats(): Promise<{
        specialization: string;
        count: number;
    }[]>;
}
//# sourceMappingURL=UserProfileModel.d.ts.map