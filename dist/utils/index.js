"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
class Utils {
    static async hashPassword(password) {
        const saltRounds = 12;
        return bcrypt_1.default.hash(password, saltRounds);
    }
    static async comparePassword(password, hash) {
        return bcrypt_1.default.compare(password, hash);
    }
    static generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    }
    static verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (error) {
            throw new Error('Invalid token');
        }
    }
    static generateId() {
        return (0, uuid_1.v4)();
    }
    static formatDate(date) {
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }
    static formatDateTime(date) {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    static generateInvoiceNumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `INV-${year}${month}-${random}`;
    }
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static validatePassword(password) {
        const errors = [];
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    static sanitizeUser(user) {
        const { password, ...sanitizedUser } = user;
        return sanitizedUser;
    }
    static getCaseTypeLabel(caseType) {
        const labels = {
            LABOR_DISPUTE: '劳动争议',
            MEDICAL_MALPRACTICE: '医疗纠纷',
            CRIMINAL_DEFENSE: '刑事辩护',
            DIVORCE_FAMILY: '离婚家事',
            INHERITANCE_DISPUTE: '继承纠纷',
            CONTRACT_DISPUTE: '合同纠纷',
            ADMINISTRATIVE_CASE: '行政诉讼',
            DEMOLITION_CASE: '拆迁类案件',
            SPECIAL_MATTERS: '特殊事项管理',
        };
        return labels[caseType] || caseType;
    }
    static getCaseStatusLabel(status) {
        const labels = {
            INTAKE: '受理中',
            ACTIVE: '进行中',
            PENDING: '待处理',
            COMPLETED: '已完成',
            CLOSED: '已结案',
            ARCHIVED: '已归档',
        };
        return labels[status] || status;
    }
    static getCasePhaseLabel(phase) {
        const labels = {
            INTAKE_RISK_ASSESSMENT: '受理与风险评估',
            PRE_PROCEEDING_PREPARATION: '诉前准备与立案',
            FORMAL_PROCEEDINGS: '正式程序',
            RESOLUTION_POST_PROCEEDING: '解决与后续程序',
            CLOSURE_REVIEW_ARCHIVING: '结案审查与归档',
        };
        return labels[phase] || phase;
    }
    static getUserRoleLabel(role) {
        const labels = {
            CLIENT: '客户',
            ATTORNEY: '律师',
            ADMIN: '管理员',
            ASSISTANT: '助理',
        };
        return labels[role] || role;
    }
    static calculateFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0)
            return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    static isValidFileType(filename, allowedTypes) {
        const extension = filename.split('.').pop()?.toLowerCase();
        return allowedTypes.includes(extension || '');
    }
    static removeSensitiveData(data, fields) {
        const sanitized = { ...data };
        fields.forEach(field => {
            delete sanitized[field];
        });
        return sanitized;
    }
}
exports.Utils = Utils;
//# sourceMappingURL=index.js.map