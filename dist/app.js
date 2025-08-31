"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("./config");
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const roles_1 = __importDefault(require("./routes/roles"));
const profiles_1 = __importDefault(require("./routes/profiles"));
const audit_1 = __importDefault(require("./routes/audit"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)(config_1.config.cors));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimit.windowMs,
    max: config_1.config.rateLimit.max,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
    },
});
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger_1.requestLogger);
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Law Firm Pro API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/roles', roles_1.default);
app.use('/api/profiles', profiles_1.default);
app.use('/api/audit', audit_1.default);
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
});
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map