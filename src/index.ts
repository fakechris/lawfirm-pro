import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { container } from 'tsyringe';
import { Database } from './utils/database';
import { WebSocketService } from './services/websocket';

// Import routes
import authRoutes from './routes/auth';
import caseRoutes from './routes/case';
import messageRoutes from './routes/message';
import documentRoutes from './routes/document';

// Import client portal routes
import clientAuthRoutes from './client/routes/auth';
import clientCaseRoutes from './client/routes/case';
import clientMessageRoutes from './client/routes/message';
import clientDocumentRoutes from './client/routes/document';

// Register dependencies
container.registerSingleton(Database);
container.register(Database, Database);

class App {
  private app: express.Application;
  private server: any;
  private db: Database;
  private wsService: WebSocketService;

  constructor() {
    this.app = express();
    this.db = container.resolve(Database);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.db.healthCheck();
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          message: 'Health check failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/cases', caseRoutes);
    this.app.use('/api/messages', messageRoutes);
    this.app.use('/api/documents', documentRoutes);

    // Client portal routes
    this.app.use('/api/client/auth', clientAuthRoutes);
    this.app.use('/api/client/cases', clientCaseRoutes);
    this.app.use('/api/client/messages', clientMessageRoutes);
    this.app.use('/api/client/documents', clientDocumentRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.db.connect();

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket service
      this.wsService = new WebSocketService(this.server, this.db);

      // Start server
      const port = process.env.PORT || 3001;
      this.server.listen(port, () => {
        console.log(`🚀 Law Firm Pro API server running on port ${port}`);
        console.log(`📡 WebSocket server ready for real-time updates`);
        console.log(`🔒 Security features enabled`);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('Starting graceful shutdown...');

    // Close HTTP server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          console.log('HTTP server closed');
          resolve(true);
        });
      });
    }

    // Disconnect from database
    await this.db.disconnect();
    console.log('Database disconnected');

    console.log('Graceful shutdown completed');
    process.exit(0);
  }
}

// Start the application
const app = new App();
app.start().catch(console.error);

export default app;