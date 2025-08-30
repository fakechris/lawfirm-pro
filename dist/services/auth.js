"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../utils/database");
const utils_1 = require("../utils");
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    constructor(db) {
        this.db = db;
    }
    async login(loginRequest) {
        const { email, password } = loginRequest;
        const user = await this.db.client.user.findUnique({
            where: { email },
            include: {
                clientProfile: true,
                attorneyProfile: true,
            },
        });
        if (!user) {
            throw new Error('Invalid credentials');
        }
        const isPasswordValid = await utils_1.Utils.comparePassword(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }
        const token = utils_1.Utils.generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const userResponse = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
        return {
            token,
            user: userResponse,
        };
    }
    async register(registerRequest) {
        const { email, password, firstName, lastName, role, phone, address, company } = registerRequest;
        const existingUser = await this.db.client.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new Error('User already exists');
        }
        const passwordValidation = utils_1.Utils.validatePassword(password);
        if (!passwordValidation.isValid) {
            throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
        }
        if (!utils_1.Utils.validateEmail(email)) {
            throw new Error('Invalid email format');
        }
        const hashedPassword = await utils_1.Utils.hashPassword(password);
        const userData = {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role,
        };
        const user = await this.db.client.user.create({
            data: userData,
        });
        if (role === client_1.UserRole.CLIENT) {
            await this.db.client.clientProfile.create({
                data: {
                    userId: user.id,
                    phone,
                    address,
                    company,
                },
            });
        }
        else if (role === client_1.UserRole.ATTORNEY) {
            throw new Error('Attorney registration requires additional information');
        }
        const token = utils_1.Utils.generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const userResponse = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
        return {
            token,
            user: userResponse,
        };
    }
    async verifyToken(token) {
        const decoded = utils_1.Utils.verifyToken(token);
        const user = await this.db.client.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) {
            throw new Error('User not found');
        }
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
    async changePassword(userId, oldPassword, newPassword) {
        const user = await this.db.client.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const isOldPasswordValid = await utils_1.Utils.comparePassword(oldPassword, user.password);
        if (!isOldPasswordValid) {
            throw new Error('Invalid old password');
        }
        const passwordValidation = utils_1.Utils.validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
        }
        const hashedNewPassword = await utils_1.Utils.hashPassword(newPassword);
        await this.db.client.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword },
        });
    }
    async updateProfile(userId, updates) {
        const user = await this.db.client.user.findUnique({
            where: { id: userId },
            include: {
                clientProfile: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const updatedUser = await this.db.client.user.update({
            where: { id: userId },
            data: {
                firstName: updates.firstName,
                lastName: updates.lastName,
            },
        });
        if (user.clientProfile && (updates.phone || updates.address || updates.company)) {
            await this.db.client.clientProfile.update({
                where: { userId },
                data: {
                    phone: updates.phone,
                    address: updates.address,
                    company: updates.company,
                },
            });
        }
        return {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], AuthService);
//# sourceMappingURL=auth.js.map