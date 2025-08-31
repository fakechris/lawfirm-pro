"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeUser = exports.isValidPassword = exports.isValidEmail = exports.generateRandomString = exports.verifyToken = exports.generateRefreshToken = exports.generateAccessToken = exports.comparePassword = exports.hashPassword = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const hashPassword = async (password) => {
    return bcrypt_1.default.hash(password, config_1.config.bcrypt.saltRounds);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hashedPassword) => {
    return bcrypt_1.default.compare(password, hashedPassword);
};
exports.comparePassword = comparePassword;
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.expiresIn,
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.refreshExpiresIn,
    });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
    }
    catch (error) {
        throw new Error('Invalid token');
    }
};
exports.verifyToken = verifyToken;
const generateRandomString = (length = 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
exports.generateRandomString = generateRandomString;
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
const isValidPassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};
exports.isValidPassword = isValidPassword;
const sanitizeUser = (user) => {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
};
exports.sanitizeUser = sanitizeUser;
//# sourceMappingURL=auth.js.map