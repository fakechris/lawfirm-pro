"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const updateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required').optional(),
    lastName: zod_1.z.string().min(1, 'Last name is required').optional(),
    email: zod_1.z.string().email('Invalid email address').optional(),
});
const createClientProfileSchema = zod_1.z.object({
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
});
const createAttorneyProfileSchema = zod_1.z.object({
    licenseNumber: zod_1.z.string().min(1, 'License number is required'),
    specialization: zod_1.z.string().min(1, 'Specialization is required'),
    experience: zod_1.z.number().min(0).optional(),
    bio: zod_1.z.string().optional(),
});
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = new database_1.Database();
    await db.connect();
    const users = await db.client.user.findMany({
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
        orderBy: { createdAt: 'desc' },
    });
    await db.disconnect();
    res.json({
        success: true,
        data: { users },
    });
}));
router.get('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    const db = new database_1.Database();
    await db.connect();
    const user = await db.client.user.findUnique({
        where: { id },
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
}));
router.put('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    const db = new database_1.Database();
    await db.connect();
    const existingUser = await db.client.user.findUnique({
        where: { id },
    });
    if (!existingUser) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('User not found', 404);
    }
    if (validatedData.email && validatedData.email !== existingUser.email) {
        const emailExists = await db.client.user.findUnique({
            where: { email: validatedData.email },
        });
        if (emailExists) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Email already taken', 409);
        }
    }
    const user = await db.client.user.update({
        where: { id },
        data: validatedData,
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'User updated successfully',
        data: { user },
    });
}));
router.post('/:id/client-profile', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const validatedData = createClientProfileSchema.parse(req.body);
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    const db = new database_1.Database();
    await db.connect();
    const user = await db.client.user.findUnique({
        where: { id },
    });
    if (!user) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('User not found', 404);
    }
    if (user.role !== 'CLIENT') {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Only clients can have client profiles', 400);
    }
    const existingProfile = await db.client.clientProfile.findUnique({
        where: { userId: id },
    });
    if (existingProfile) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Client profile already exists', 409);
    }
    const profile = await db.client.clientProfile.create({
        data: {
            userId: id,
            ...validatedData,
        },
    });
    await db.disconnect();
    res.status(201).json({
        success: true,
        message: 'Client profile created successfully',
        data: { profile },
    });
}));
router.post('/:id/attorney-profile', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const validatedData = createAttorneyProfileSchema.parse(req.body);
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    const db = new database_1.Database();
    await db.connect();
    const user = await db.client.user.findUnique({
        where: { id },
    });
    if (!user) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('User not found', 404);
    }
    if (user.role !== 'ATTORNEY') {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Only attorneys can have attorney profiles', 400);
    }
    const existingProfile = await db.client.attorneyProfile.findUnique({
        where: { userId: id },
    });
    if (existingProfile) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Attorney profile already exists', 409);
    }
    const profile = await db.client.attorneyProfile.create({
        data: {
            userId: id,
            ...validatedData,
        },
    });
    await db.disconnect();
    res.status(201).json({
        success: true,
        message: 'Attorney profile created successfully',
        data: { profile },
    });
}));
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const user = await db.client.user.findUnique({
        where: { id },
    });
    if (!user) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('User not found', 404);
    }
    await db.client.user.delete({
        where: { id },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'User deleted successfully',
    });
}));
exports.default = router;
//# sourceMappingURL=users.js.map