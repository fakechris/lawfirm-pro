"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const createCaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    caseType: zod_1.z.enum([
        'LABOR_DISPUTE', 'MEDICAL_MALPRACTICE', 'CRIMINAL_DEFENSE',
        'DIVORCE_FAMILY', 'INHERITANCE_DISPUTE', 'CONTRACT_DISPUTE',
        'ADMINISTRATIVE_CASE', 'DEMOLITION_CASE', 'SPECIAL_MATTERS'
    ]),
    status: zod_1.z.enum(['INTAKE', 'ACTIVE', 'PENDING', 'COMPLETED', 'CLOSED', 'ARCHIVED']).optional().default('INTAKE'),
    phase: zod_1.z.enum([
        'INTAKE_RISK_ASSESSMENT', 'PRE_PROCEEDING_PREPARATION',
        'FORMAL_PROCEEDINGS', 'RESOLUTION_POST_PROCEEDING', 'CLOSURE_REVIEW_ARCHIVING'
    ]).optional().default('INTAKE_RISK_ASSESSMENT'),
    clientId: zod_1.z.string().min(1, 'Client ID is required'),
    attorneyId: zod_1.z.string().min(1, 'Attorney ID is required'),
});
const updateCaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').optional(),
    description: zod_1.z.string().optional(),
    caseType: zod_1.z.enum([
        'LABOR_DISPUTE', 'MEDICAL_MALPRACTICE', 'CRIMINAL_DEFENSE',
        'DIVORCE_FAMILY', 'INHERITANCE_DISPUTE', 'CONTRACT_DISPUTE',
        'ADMINISTRATIVE_CASE', 'DEMOLITION_CASE', 'SPECIAL_MATTERS'
    ]).optional(),
    status: zod_1.z.enum(['INTAKE', 'ACTIVE', 'PENDING', 'COMPLETED', 'CLOSED', 'ARCHIVED']).optional(),
    phase: zod_1.z.enum([
        'INTAKE_RISK_ASSESSMENT', 'PRE_PROCEEDING_PREPARATION',
        'FORMAL_PROCEEDINGS', 'RESOLUTION_POST_PROCEEDING', 'CLOSURE_REVIEW_ARCHIVING'
    ]).optional(),
    clientId: zod_1.z.string().min(1, 'Client ID is required').optional(),
    attorneyId: zod_1.z.string().min(1, 'Attorney ID is required').optional(),
});
router.get('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = new database_1.Database();
    await db.connect();
    let cases;
    if (req.user.role === 'ADMIN') {
        cases = await db.client.case.findMany({
            include: {
                client: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                },
                attorney: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                },
                documents: true,
                tasks: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    else if (req.user.role === 'ATTORNEY') {
        const attorneyProfile = await db.client.attorneyProfile.findUnique({
            where: { userId: req.user.id },
        });
        if (!attorneyProfile) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Attorney profile not found', 404);
        }
        cases = await db.client.case.findMany({
            where: { attorneyId: attorneyProfile.id },
            include: {
                client: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                },
                attorney: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                },
                documents: true,
                tasks: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    else if (req.user.role === 'CLIENT') {
        const clientProfile = await db.client.clientProfile.findUnique({
            where: { userId: req.user.id },
        });
        if (!clientProfile) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Client profile not found', 404);
        }
        cases = await db.client.case.findMany({
            where: { clientId: clientProfile.id },
            include: {
                client: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                },
                attorney: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                },
                documents: true,
                tasks: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    else {
        cases = [];
    }
    await db.disconnect();
    res.json({
        success: true,
        data: { cases },
    });
}));
router.get('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const caseRecord = await db.client.case.findUnique({
        where: { id },
        include: {
            client: {
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
            },
            attorney: {
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
            },
            documents: true,
            tasks: {
                include: {
                    assignee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    creator: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            },
        },
    });
    await db.disconnect();
    if (!caseRecord) {
        throw (0, errorHandler_1.createError)('Case not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        (req.user.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user.id) ||
        (req.user.role === 'CLIENT' && caseRecord.client.userId === req.user.id);
    if (!hasAccess) {
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    res.json({
        success: true,
        data: { case: caseRecord },
    });
}));
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'ATTORNEY']), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const validatedData = createCaseSchema.parse(req.body);
    const db = new database_1.Database();
    await db.connect();
    const client = await db.client.clientProfile.findUnique({
        where: { id: validatedData.clientId },
    });
    if (!client) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Client not found', 404);
    }
    const attorney = await db.client.attorneyProfile.findUnique({
        where: { id: validatedData.attorneyId },
    });
    if (!attorney) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Attorney not found', 404);
    }
    if (req.user.role === 'ATTORNEY' && attorney.userId !== req.user.id) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('You can only create cases for yourself', 403);
    }
    const caseRecord = await db.client.case.create({
        data: validatedData,
        include: {
            client: {
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
            },
            attorney: {
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });
    await db.disconnect();
    res.status(201).json({
        success: true,
        message: 'Case created successfully',
        data: { case: caseRecord },
    });
}));
router.put('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const validatedData = updateCaseSchema.parse(req.body);
    const db = new database_1.Database();
    await db.connect();
    const existingCase = await db.client.case.findUnique({
        where: { id },
        include: {
            attorney: {
                select: { userId: true },
            },
            client: {
                select: { userId: true },
            },
        },
    });
    if (!existingCase) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Case not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        (req.user.role === 'ATTORNEY' && existingCase.attorney.userId === req.user.id);
    if (!hasAccess) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    if (validatedData.attorneyId) {
        const attorney = await db.client.attorneyProfile.findUnique({
            where: { id: validatedData.attorneyId },
        });
        if (!attorney) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Attorney not found', 404);
        }
    }
    if (validatedData.clientId) {
        const client = await db.client.clientProfile.findUnique({
            where: { id: validatedData.clientId },
        });
        if (!client) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Client not found', 404);
        }
    }
    const caseRecord = await db.client.case.update({
        where: { id },
        data: validatedData,
        include: {
            client: {
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
            },
            attorney: {
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'Case updated successfully',
        data: { case: caseRecord },
    });
}));
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'ATTORNEY']), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const existingCase = await db.client.case.findUnique({
        where: { id },
        include: {
            attorney: {
                select: { userId: true },
            },
        },
    });
    if (!existingCase) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Case not found', 404);
    }
    if (req.user.role === 'ATTORNEY' && existingCase.attorney.userId !== req.user.id) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('You can only delete your own cases', 403);
    }
    await db.client.case.delete({
        where: { id },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'Case deleted successfully',
    });
}));
exports.default = router;
//# sourceMappingURL=cases.js.map