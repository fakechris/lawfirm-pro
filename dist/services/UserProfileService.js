"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileService = void 0;
const UserProfileModel_1 = require("../models/UserProfileModel");
const UserModel_1 = require("../models/UserModel");
const AuditLogModel_1 = require("../models/AuditLogModel");
class UserProfileService {
    static async createProfile(userId, data, ipAddress, userAgent) {
        const user = await UserModel_1.UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const existingProfile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (existingProfile) {
            throw new Error('User profile already exists');
        }
        const profile = await UserProfileModel_1.UserProfileModel.create({
            userId,
            ...data,
        });
        await AuditLogModel_1.AuditLogModel.create({
            userId,
            action: 'profile_create',
            resource: 'user_profiles',
            resourceId: profile.id,
            metadata: {
                fields: Object.keys(data),
            },
            ipAddress,
            userAgent,
        });
        return profile;
    }
    static async getProfileByUserId(userId) {
        return UserProfileModel_1.UserProfileModel.findByUserId(userId);
    }
    static async getFullProfileByUserId(userId) {
        const user = await UserModel_1.UserModel.findById(userId);
        if (!user) {
            return null;
        }
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        return {
            user,
            profile,
        };
    }
    static async updateProfile(userId, data, ipAddress, userAgent) {
        const user = await UserModel_1.UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const profile = await UserProfileModel_1.UserProfileModel.update(userId, data);
        if (!profile) {
            throw new Error('Profile not found');
        }
        await AuditLogModel_1.AuditLogModel.create({
            userId,
            action: 'profile_update',
            resource: 'user_profiles',
            resourceId: profile.id,
            metadata: {
                updatedFields: Object.keys(data),
            },
            ipAddress,
            userAgent,
        });
        return profile;
    }
    static async deleteProfile(userId, ipAddress, userAgent) {
        const user = await UserModel_1.UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (!profile) {
            throw new Error('Profile not found');
        }
        const success = await UserProfileModel_1.UserProfileModel.delete(userId);
        if (success) {
            await AuditLogModel_1.AuditLogModel.create({
                userId,
                action: 'profile_delete',
                resource: 'user_profiles',
                resourceId: profile.id,
                ipAddress,
                userAgent,
            });
        }
        return success;
    }
    static async getProfilesByDepartment(department) {
        return UserProfileModel_1.UserProfileModel.findByDepartment(department);
    }
    static async getProfilesBySpecialization(specialization) {
        return UserProfileModel_1.UserProfileModel.findBySpecialization(specialization);
    }
    static async getDepartmentStats() {
        return UserProfileModel_1.UserProfileModel.getDepartmentStats();
    }
    static async getSpecializationStats() {
        return UserProfileModel_1.UserProfileModel.getSpecializationStats();
    }
    static async searchUsers(filters) {
        const where = {};
        if (filters.department) {
            where.profile = {
                ...where.profile,
                department: filters.department,
            };
        }
        if (filters.specialization) {
            where.profile = {
                ...where.profile,
                specialization: filters.specialization,
            };
        }
        if (filters.yearsOfExperience) {
            where.profile = {
                ...where.profile,
                yearsOfExperience: {},
            };
            if (filters.yearsOfExperience.min !== undefined) {
                where.profile.yearsOfExperience.gte = filters.yearsOfExperience.min;
            }
            if (filters.yearsOfExperience.max !== undefined) {
                where.profile.yearsOfExperience.lte = filters.yearsOfExperience.max;
            }
        }
        if (filters.licenseNumber) {
            where.profile = {
                ...where.profile,
                licenseNumber: { contains: filters.licenseNumber, mode: 'insensitive' },
            };
        }
        if (filters.isActive !== undefined) {
            where.isActive = filters.isActive;
        }
        const result = await UserModel_1.UserModel.findAll(1, 1000, filters);
        return {
            users: result.users,
            total: result.total,
        };
    }
    static async getUserDirectory(params) {
        const { page = 1, limit = 20, search, department, specialization, isActive, sortBy = 'createdAt', sortOrder = 'desc', } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (department) {
            where.profile = {
                ...where.profile,
                department,
            };
        }
        if (specialization) {
            where.profile = {
                ...where.profile,
                specialization,
            };
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }
        const total = await UserModel_1.UserModel.findAll(1, 1000, {
            search,
            department,
            isActive
        }).then(result => result.total);
        const totalPages = Math.ceil(total / limit);
        const result = await UserModel_1.UserModel.findAll(page, limit, {
            search,
            department,
            isActive
        });
        let users = result.users;
        if (sortBy === 'name') {
            users.sort((a, b) => {
                const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            });
        }
        else if (sortBy === 'email') {
            users.sort((a, b) => {
                return sortOrder === 'asc'
                    ? a.email.localeCompare(b.email)
                    : b.email.localeCompare(a.email);
            });
        }
        return {
            users,
            total,
            page,
            limit,
            totalPages,
        };
    }
    static async updateNotificationPreferences(userId, preferences, ipAddress, userAgent) {
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (!profile) {
            throw new Error('Profile not found');
        }
        const updatedPreferences = {
            ...profile.notifications,
            ...preferences,
        };
        return this.updateProfile(userId, { notifications: updatedPreferences }, ipAddress, userAgent);
    }
    static async getNotificationPreferences(userId) {
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (!profile) {
            return {};
        }
        return profile.notifications || {};
    }
    static async getEmergencyContact(userId) {
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (!profile || !profile.emergencyContact || !profile.emergencyPhone) {
            return null;
        }
        return {
            contact: profile.emergencyContact,
            phone: profile.emergencyPhone,
        };
    }
    static async updateEmergencyContact(userId, contact, phone, ipAddress, userAgent) {
        return this.updateProfile(userId, {
            emergencyContact: contact,
            emergencyPhone: phone
        }, ipAddress, userAgent);
    }
    static async getProfessionalInfo(userId) {
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (!profile) {
            return null;
        }
        return {
            title: profile.title,
            department: profile.department,
            specialization: profile.specialization,
            licenseNumber: profile.licenseNumber,
            yearsOfExperience: profile.yearsOfExperience,
            bio: profile.bio,
        };
    }
    static async updateProfessionalInfo(userId, data, ipAddress, userAgent) {
        return this.updateProfile(userId, data, ipAddress, userAgent);
    }
    static async getContactInfo(userId) {
        const user = await UserModel_1.UserModel.findById(userId);
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (!user) {
            return null;
        }
        return {
            address: profile?.address,
            city: profile?.city,
            province: profile?.province,
            country: profile?.country,
            postalCode: profile?.postalCode,
            phone: user.phone,
            email: user.email,
        };
    }
    static async updateContactInfo(userId, data, ipAddress, userAgent) {
        if (data.phone) {
            await UserModel_1.UserModel.update(userId, { phone: data.phone });
        }
        const profile = await this.updateProfile(userId, {
            address: data.address,
            city: data.city,
            province: data.province,
            country: data.country,
            postalCode: data.postalCode,
        }, ipAddress, userAgent);
        const user = await UserModel_1.UserModel.findById(userId);
        return {
            user: user,
            profile,
        };
    }
    static async getUserPreferences(userId) {
        const profile = await UserProfileModel_1.UserProfileModel.findByUserId(userId);
        if (!profile) {
            return {
                language: 'zh-CN',
                timezone: 'Asia/Shanghai',
                notifications: {},
            };
        }
        return {
            language: profile.language,
            timezone: profile.timezone,
            notifications: profile.notifications || {},
        };
    }
    static async updateUserPreferences(userId, preferences, ipAddress, userAgent) {
        return this.updateProfile(userId, preferences, ipAddress, userAgent);
    }
}
exports.UserProfileService = UserProfileService;
//# sourceMappingURL=UserProfileService.js.map