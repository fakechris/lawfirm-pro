import { Request, Response } from 'express';
export declare class UserProfileController {
    static getProfileByUserId(req: Request, res: Response): Promise<void>;
    static getFullProfileByUserId(req: Request, res: Response): Promise<void>;
    static createProfile(req: Request, res: Response): Promise<void>;
    static updateProfile(req: Request, res: Response): Promise<void>;
    static deleteProfile(req: Request, res: Response): Promise<void>;
    static getProfilesByDepartment(req: Request, res: Response): Promise<void>;
    static getProfilesBySpecialization(req: Request, res: Response): Promise<void>;
    static getDepartmentStats(req: Request, res: Response): Promise<void>;
    static getSpecializationStats(req: Request, res: Response): Promise<void>;
    static searchUsers(req: Request, res: Response): Promise<void>;
    static getUserDirectory(req: Request, res: Response): Promise<void>;
    static getNotificationPreferences(req: Request, res: Response): Promise<void>;
    static updateNotificationPreferences(req: Request, res: Response): Promise<void>;
    static getEmergencyContact(req: Request, res: Response): Promise<void>;
    static updateEmergencyContact(req: Request, res: Response): Promise<void>;
    static getProfessionalInfo(req: Request, res: Response): Promise<void>;
    static updateProfessionalInfo(req: Request, res: Response): Promise<void>;
    static getContactInfo(req: Request, res: Response): Promise<void>;
    static updateContactInfo(req: Request, res: Response): Promise<void>;
    static getUserPreferences(req: Request, res: Response): Promise<void>;
    static updateUserPreferences(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=UserProfileController.d.ts.map