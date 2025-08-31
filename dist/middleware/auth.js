"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.optionalAuth = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../utils/database");
const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const db = new database_1.Database();
        await db.connect();
        const user = await db.client.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                role: true,
                firstName: true,
                lastName: true,
            }
        });
        await db.disconnect();
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. User not authenticated.'
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }
        next();
    };
};
exports.authorize = authorize;
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const db = new database_1.Database();
            await db.connect();
            const user = await db.client.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    firstName: true,
                    lastName: true,
                }
            });
            await db.disconnect();
            if (user) {
                req.user = user;
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
exports.authMiddleware = exports.authenticate;
//# sourceMappingURL=auth.js.map