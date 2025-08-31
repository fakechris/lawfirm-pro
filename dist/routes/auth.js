"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    role: zod_1.z.enum(['CLIENT', 'ATTORNEY', 'ADMIN', 'ASSISTANT']).optional().default('CLIENT'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
router.post('/register', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, firstName, lastName, role } = validatedData;
    const db = new database_1.Database();
    await db.connect();
    const existingUser = await db.client.user.findUnique({
        where: { email },
    });
    if (existingUser) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('User already exists', 409);
    }
    const saltRounds = 12;
    const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
    const user = await db.client.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role,
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
        },
    });
    await db.disconnect();
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            user,
            token,
            refreshToken,
        },
    });
}));
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;
    const db = new database_1.Database();
    await db.connect();
    const user = await db.client.user.findUnique({
        where: { email },
    });
    if (!user) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Invalid credentials', 401);
    }
    const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Invalid credentials', 401);
    }
    await db.disconnect();
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            },
            token,
            refreshToken,
        },
    });
}));
router.post('/refresh', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        throw (0, errorHandler_1.createError)('Refresh token is required', 400);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const db = new database_1.Database();
        await db.connect();
        const user = await db.client.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
            },
        });
        await db.disconnect();
        if (!user) {
            throw (0, errorHandler_1.createError)('Invalid refresh token', 401);
        }
        const newToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: newToken,
                user,
            },
        });
    }
    catch (error) {
        throw (0, errorHandler_1.createError)('Invalid refresh token', 401);
    }
}));
router.get('/me', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        throw (0, errorHandler_1.createError)('No token provided', 401);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const db = new database_1.Database();
        await db.connect();
        const user = await db.client.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                clientProfile: {
                    select: {
                        phone: true,
                        address: true,
                        company: true,
                    },
                },
                attorneyProfile: {
                    select: {
                        licenseNumber: true,
                        specialization: true,
                        experience: true,
                        bio: true,
                    },
                },
            },
        });
        await db.disconnect();
        if (!user) {
            throw (0, errorHandler_1.createError)('User not found', 404);
        }
        res.json({
            success: true,
            data: { user },
        });
    }
    catch (error) {
        throw (0, errorHandler_1.createError)('Invalid token', 401);
    }
}));
exports.default = router;
//# sourceMappingURL=auth.js.map