"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const tsyringe_1 = require("tsyringe");
const database_1 = require("./utils/database");
const websocket_1 = require("./services/websocket");
const auth_1 = __importDefault(require("./routes/auth"));
const case_1 = __importDefault(require("./routes/case"));
const message_1 = __importDefault(require("./routes/message"));
const document_1 = __importDefault(require("./routes/document"));
const financial_1 = __importDefault(require("./routes/financial"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const auth_2 = __importDefault(require("./client/routes/auth"));
const case_2 = __importDefault(require("./client/routes/case"));
const message_2 = __importDefault(require("./client/routes/message"));
const document_2 = __importDefault(require("./client/routes/document"));
tsyringe_1.container.registerSingleton(database_1.Database);
tsyringe_1.container.register(database_1.Database, database_1.Database);
class App {
    constructor() {
        this.app = (0, express_1.default)();
        this.db = tsyringe_1.container.resolve(database_1.Database);
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        this.app.use((0, helmet_1.default)());
        this.app.use((0, cors_1.default)({
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            credentials: true,
        }));
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many requests from this IP, please try again later.',
        });
        this.app.use('/api/', limiter);
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }
    setupRoutes() {
        this.app.get('/health', async (req, res) => {
            try {
                const health = await this.db.healthCheck();
                res.status(health.status === 'healthy' ? 200 : 503).json(health);
            }
            catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    message: 'Health check failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        this.app.use('/api/auth', auth_1.default);
        this.app.use('/api/cases', case_1.default);
        this.app.use('/api/messages', message_1.default);
        this.app.use('/api/documents', document_1.default);
        this.app.use('/api/financial', financial_1.default);
        this.app.use('/api/webhooks', webhooks_1.default);
        this.app.use('/api/client/auth', auth_2.default);
        this.app.use('/api/client/cases', case_2.default);
        this.app.use('/api/client/messages', message_2.default);
        this.app.use('/api/client/documents', document_2.default);
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Route not found',
            });
        });
    }
    setupErrorHandling() {
        this.app.use((err, req, res, next) => {
            console.error('Error:', err);
            if (err.type === 'entity.parse.failed') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid JSON payload',
                });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'File size exceeds limit',
                });
            }
            res.status(err.status || 500).json({
                success: false,
                message: err.message || 'Internal server error',
            });
        });
    }
    async start() {
        try {
            await this.db.connect();
            this.server = (0, http_1.createServer)(this.app);
            this.wsService = new websocket_1.WebSocketService(this.server, this.db);
            const port = process.env.PORT || 3001;
            this.server.listen(port, () => {
                console.log(`🚀 Law Firm Pro API server running on port ${port}`);
                console.log(`📡 WebSocket server ready for real-time updates`);
                console.log(`🔒 Security features enabled`);
            });
            process.on('SIGTERM', this.gracefulShutdown.bind(this));
            process.on('SIGINT', this.gracefulShutdown.bind(this));
        }
        catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
    async gracefulShutdown() {
        console.log('Starting graceful shutdown...');
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(() => {
                    console.log('HTTP server closed');
                    resolve(true);
                });
            });
        }
        await this.db.disconnect();
        console.log('Database disconnected');
        console.log('Graceful shutdown completed');
        process.exit(0);
    }
}
const app = new App();
app.start().catch(console.error);
exports.default = app;
//# sourceMappingURL=index.js.map