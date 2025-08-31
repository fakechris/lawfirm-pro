import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Database } from '../utils/database';

export class WebSocketService {
  private io: SocketIOServer;
  private db: Database;

  constructor(server: HTTPServer, db: Database) {
    this.db = db;
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join case-specific rooms
      socket.on('join-case', (caseId: string) => {
        socket.join(`case-${caseId}`);
        console.log(`Client ${socket.id} joined case ${caseId}`);
      });

      // Handle case updates
      socket.on('case-update', (data: { caseId: string; update: any }) => {
        this.io.to(`case-${data.caseId}`).emit('case-updated', data.update);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  // Broadcast case updates to all clients in the case room
  public broadcastCaseUpdate(caseId: string, update: any): void {
    this.io.to(`case-${caseId}`).emit('case-updated', update);
  }

  // Broadcast task updates to all clients in the case room
  public broadcastTaskUpdate(caseId: string, update: any): void {
    this.io.to(`case-${caseId}`).emit('task-updated', update);
  }

  // Broadcast document updates to all clients in the case room
  public broadcastDocumentUpdate(caseId: string, update: any): void {
    this.io.to(`case-${caseId}`).emit('document-updated', update);
  }
}