"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileModel = void 0;
const database_1 = require("../utils/database");
class UserProfileModel {
    static async create(data) {
        const profile = await database_1.prisma.userProfile.create({
            data: {
                userId: data.userId,
                title: data.title,
                department: data.department,
                specialization: data.specialization,
                licenseNumber: data.licenseNumber,
                yearsOfExperience: data.yearsOfExperience,
                bio: data.bio,
                address: data.address,
                city: data.city,
                province: data.province,
                country: data.country,
                postalCode: data.postalCode,
                emergencyContact: data.emergencyContact,
                emergencyPhone: data.emergencyPhone,
                language: data.language || 'zh-CN',
                timezone: data.timezone || 'Asia/Shanghai',
                notifications: data.notifications || {},
            },
        });
        return profile;
    }
    static async findByUserId(userId) {
        return database_1.prisma.userProfile.findUnique({
            where: { userId },
        });
    }
    static async update(userId, data) {
        const profile = await database_1.prisma.userProfile.update({
            where: { userId },
            data: {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.department !== undefined && { department: data.department }),
                ...(data.specialization !== undefined && { specialization: data.specialization }),
                ...(data.licenseNumber !== undefined && { licenseNumber: data.licenseNumber }),
                ...(data.yearsOfExperience !== undefined && { yearsOfExperience: data.yearsOfExperience }),
                ...(data.bio !== undefined && { bio: data.bio }),
                ...(data.address !== undefined && { address: data.address }),
                ...(data.city !== undefined && { city: data.city }),
                ...(data.province !== undefined && { province: data.province }),
                ...(data.country !== undefined && { country: data.country }),
                ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
                ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact }),
                ...(data.emergencyPhone !== undefined && { emergencyPhone: data.emergencyPhone }),
                ...(data.language !== undefined && { language: data.language }),
                ...(data.timezone !== undefined && { timezone: data.timezone }),
                ...(data.notifications !== undefined && { notifications: data.notifications }),
            },
        });
        return profile;
    }
    static async delete(userId) {
        try {
            await database_1.prisma.userProfile.delete({
                where: { userId },
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    static async findByDepartment(department) {
        return database_1.prisma.userProfile.findMany({
            where: { department },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                    },
                },
            },
        });
    }
    static async findBySpecialization(specialization) {
        return database_1.prisma.userProfile.findMany({
            where: { specialization },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                    },
                },
            },
        });
    }
    static async getDepartmentStats() {
        const stats = await database_1.prisma.userProfile.groupBy({
            by: ['department'],
            where: {
                department: {
                    not: null,
                },
                user: {
                    isActive: true,
                },
            },
            _count: {
                department: true,
            },
        });
        return stats.map(stat => ({
            department: stat.department || 'Unknown',
            count: stat._count.department,
        }));
    }
    static async getSpecializationStats() {
        const stats = await database_1.prisma.userProfile.groupBy({
            by: ['specialization'],
            where: {
                specialization: {
                    not: null,
                },
                user: {
                    isActive: true,
                },
            },
            _count: {
                specialization: true,
            },
        });
        return stats.map(stat => ({
            specialization: stat.specialization || 'Unknown',
            count: stat._count.specialization,
        }));
    }
}
exports.UserProfileModel = UserProfileModel;
//# sourceMappingURL=UserProfileModel.js.map