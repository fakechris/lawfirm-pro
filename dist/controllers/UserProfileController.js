"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileController = void 0;
const UserProfileService_1 = require("../services/UserProfileService");
class UserProfileController {
    static async getProfileByUserId(req, res) {
        try {
            const { userId } = req.params;
            const profile = await UserProfileService_1.UserProfileService.getProfileByUserId(userId);
            if (!profile) {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found',
                });
                return;
            }
            res.json({
                success: true,
                data: profile,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getFullProfileByUserId(req, res) {
        try {
            const { userId } = req.params;
            const fullProfile = await UserProfileService_1.UserProfileService.getFullProfileByUserId(userId);
            if (!fullProfile) {
                res.status(404).json({
                    success: false,
                    error: 'User profile not found',
                });
                return;
            }
            res.json({
                success: true,
                data: fullProfile,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async createProfile(req, res) {
        try {
            const { userId } = req.params;
            const data = req.body;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const profile = await UserProfileService_1.UserProfileService.createProfile(userId, data, ipAddress, userAgent);
            res.status(201).json({
                success: true,
                data: profile,
                message: 'Profile created successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updateProfile(req, res) {
        try {
            const { userId } = req.params;
            const data = req.body;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const profile = await UserProfileService_1.UserProfileService.updateProfile(userId, data, ipAddress, userAgent);
            if (!profile) {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found',
                });
                return;
            }
            res.json({
                success: true,
                data: profile,
                message: 'Profile updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async deleteProfile(req, res) {
        try {
            const { userId } = req.params;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const success = await UserProfileService_1.UserProfileService.deleteProfile(userId, ipAddress, userAgent);
            if (!success) {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Profile deleted successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getProfilesByDepartment(req, res) {
        try {
            const { department } = req.params;
            const profiles = await UserProfileService_1.UserProfileService.getProfilesByDepartment(department);
            res.json({
                success: true,
                data: profiles,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getProfilesBySpecialization(req, res) {
        try {
            const { specialization } = req.params;
            const profiles = await UserProfileService_1.UserProfileService.getProfilesBySpecialization(specialization);
            res.json({
                success: true,
                data: profiles,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getDepartmentStats(req, res) {
        try {
            const stats = await UserProfileService_1.UserProfileService.getDepartmentStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getSpecializationStats(req, res) {
        try {
            const stats = await UserProfileService_1.UserProfileService.getSpecializationStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async searchUsers(req, res) {
        try {
            const { department, specialization, minYearsOfExperience, maxYearsOfExperience, licenseNumber, isActive, } = req.query;
            const result = await UserProfileService_1.UserProfileService.searchUsers({
                department: department,
                specialization: specialization,
                yearsOfExperience: {
                    min: minYearsOfExperience ? parseInt(minYearsOfExperience) : undefined,
                    max: maxYearsOfExperience ? parseInt(maxYearsOfExperience) : undefined,
                },
                licenseNumber: licenseNumber,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserDirectory(req, res) {
        try {
            const { page = 1, limit = 20, search, department, specialization, isActive, sortBy = 'createdAt', sortOrder = 'desc', } = req.query;
            const result = await UserProfileService_1.UserProfileService.getUserDirectory({
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                department: department,
                specialization: specialization,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
                sortBy: sortBy,
                sortOrder: sortOrder,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getNotificationPreferences(req, res) {
        try {
            const { userId } = req.params;
            const preferences = await UserProfileService_1.UserProfileService.getNotificationPreferences(userId);
            res.json({
                success: true,
                data: preferences,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updateNotificationPreferences(req, res) {
        try {
            const { userId } = req.params;
            const { preferences } = req.body;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const profile = await UserProfileService_1.UserProfileService.updateNotificationPreferences(userId, preferences, ipAddress, userAgent);
            res.json({
                success: true,
                data: profile,
                message: 'Notification preferences updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getEmergencyContact(req, res) {
        try {
            const { userId } = req.params;
            const contact = await UserProfileService_1.UserProfileService.getEmergencyContact(userId);
            if (!contact) {
                res.status(404).json({
                    success: false,
                    error: 'Emergency contact not found',
                });
                return;
            }
            res.json({
                success: true,
                data: contact,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updateEmergencyContact(req, res) {
        try {
            const { userId } = req.params;
            const { contact, phone } = req.body;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const profile = await UserProfileService_1.UserProfileService.updateEmergencyContact(userId, contact, phone, ipAddress, userAgent);
            res.json({
                success: true,
                data: profile,
                message: 'Emergency contact updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getProfessionalInfo(req, res) {
        try {
            const { userId } = req.params;
            const info = await UserProfileService_1.UserProfileService.getProfessionalInfo(userId);
            if (!info) {
                res.status(404).json({
                    success: false,
                    error: 'Professional information not found',
                });
                return;
            }
            res.json({
                success: true,
                data: info,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updateProfessionalInfo(req, res) {
        try {
            const { userId } = req.params;
            const data = req.body;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const profile = await UserProfileService_1.UserProfileService.updateProfessionalInfo(userId, data, ipAddress, userAgent);
            res.json({
                success: true,
                data: profile,
                message: 'Professional information updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getContactInfo(req, res) {
        try {
            const { userId } = req.params;
            const info = await UserProfileService_1.UserProfileService.getContactInfo(userId);
            if (!info) {
                res.status(404).json({
                    success: false,
                    error: 'Contact information not found',
                });
                return;
            }
            res.json({
                success: true,
                data: info,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updateContactInfo(req, res) {
        try {
            const { userId } = req.params;
            const data = req.body;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const result = await UserProfileService_1.UserProfileService.updateContactInfo(userId, data, ipAddress, userAgent);
            res.json({
                success: true,
                data: result,
                message: 'Contact information updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserPreferences(req, res) {
        try {
            const { userId } = req.params;
            const preferences = await UserProfileService_1.UserProfileService.getUserPreferences(userId);
            res.json({
                success: true,
                data: preferences,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updateUserPreferences(req, res) {
        try {
            const { userId } = req.params;
            const data = req.body;
            const adminUserId = req.user?.userId;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            if (adminUserId && adminUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }
            const profile = await UserProfileService_1.UserProfileService.updateUserPreferences(userId, data, ipAddress, userAgent);
            res.json({
                success: true,
                data: profile,
                message: 'User preferences updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}
exports.UserProfileController = UserProfileController;
//# sourceMappingURL=UserProfileController.js.map