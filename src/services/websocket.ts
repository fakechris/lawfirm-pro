import { Server as WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { Database } from '../utils/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';

interface WebSocketClient {
  id: string;
  userId: string;
  userRole: UserRole;
  ws: WebSocket;
  caseIds: string[];
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private db: Database;

  constructor(server: HTTPServer, db: Database) {
    this.wss = new WebSocketServer({ server });
    this.db = db;
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      
      // Extract token from query parameters
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      try {
        const decoded = this.verifyToken(token);
        
        const client: WebSocketClient = {
          id: clientId,
          userId: decoded.userId,
          userRole: decoded.role,
          ws,
          caseIds: [],
        };

        this.clients.set(clientId, client);

        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            await this.handleClientMessage(client, message);
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
            this.sendToClient(client, {
              type: 'error',
              message: 'Invalid message format',
              timestamp: new Date(),
            });
          }
        });

        ws.on('close', () => {
          this.clients.delete(clientId);
          console.log(`Client disconnected: ${clientId}`);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket error for client ${clientId}:`, error);
          this.clients.delete(clientId);
        });

        // Send initial connection confirmation
        this.sendToClient(client, {
          type: 'connection_established',
          clientId,
          timestamp: new Date(),
        });

        console.log(`Client connected: ${clientId} (User: ${decoded.userId}, Role: ${decoded.role})`);
      } catch (error) {
        console.error('WebSocket authentication failed:', error);
        ws.close(1008, 'Invalid token');
      }
    });
  }

  private async handleClientMessage(client: WebSocketClient, message: any) {
    switch (message.type) {
      case 'subscribe_case':
        await this.subscribeToCase(client, message.caseId);
        break;
      case 'unsubscribe_case':
        await this.unsubscribeFromCase(client, message.caseId);
        break;
      case 'heartbeat':
        this.sendToClient(client, {
          type: 'heartbeat_response',
          timestamp: new Date(),
        });
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async subscribeToCase(client: WebSocketClient, caseId: string) {
    try {
      // Verify client has access to this case
      const hasAccess = await this.verifyCaseAccess(caseId, client.userId, client.userRole);
      
      if (!hasAccess) {
        this.sendToClient(client, {
          type: 'error',
          message: 'Access denied to this case',
          timestamp: new Date(),
        });
        return;
      }

      if (!client.caseIds.includes(caseId)) {
        client.caseIds.push(caseId);
        
        this.sendToClient(client, {
          type: 'subscribed',
          caseId,
          timestamp: new Date(),
        });

        console.log(`Client ${client.id} subscribed to case ${caseId}`);
      }
    } catch (error) {
      console.error('Error subscribing to case:', error);
      this.sendToClient(client, {
        type: 'error',
        message: 'Failed to subscribe to case',
        timestamp: new Date(),
      });
    }
  }

  private async unsubscribeFromCase(client: WebSocketClient, caseId: string) {
    const index = client.caseIds.indexOf(caseId);
    if (index > -1) {
      client.caseIds.splice(index, 1);
      
      this.sendToClient(client, {
        type: 'unsubscribed',
        caseId,
        timestamp: new Date(),
      });

      console.log(`Client ${client.id} unsubscribed from case ${caseId}`);
    }
  }

  private async verifyCaseAccess(caseId: string, userId: string, userRole: UserRole): Promise<boolean> {
    try {
      if (userRole === UserRole.CLIENT) {
        const client = await this.db.client.clientProfile.findUnique({
          where: { userId }
        });

        if (!client) return false;

        const caseAccess = await this.db.client.case.findFirst({
          where: { 
            id: caseId,
            clientId: client.id 
          }
        });

        return !!caseAccess;
      } else if (userRole === UserRole.ATTORNEY) {
        const attorney = await this.db.client.attorneyProfile.findUnique({
          where: { userId }
        });

        if (!attorney) return false;

        const caseAccess = await this.db.client.case.findFirst({
          where: { 
            id: caseId,
            attorneyId: attorney.id 
          }
        });

        return !!caseAccess;
      }

      return false;
    } catch (error) {
      console.error('Error verifying case access:', error);
      return false;
    }
  }

  // Public methods for broadcasting updates
  public broadcastCaseUpdate(caseId: string, update: any) {
    this.broadcastToCaseSubscribers(caseId, {
      type: 'case_update',
      caseId,
      data: update,
      timestamp: new Date(),
    });
  }

  public broadcastMessage(caseId: string, message: any) {
    this.broadcastToCaseSubscribers(caseId, {
      type: 'message',
      caseId,
      data: message,
      timestamp: new Date(),
    });
  }

  public broadcastAppointment(caseId: string, appointment: any) {
    this.broadcastToCaseSubscribers(caseId, {
      type: 'appointment',
      caseId,
      data: appointment,
      timestamp: new Date(),
    });
  }

  public broadcastDocument(caseId: string, document: any) {
    this.broadcastToCaseSubscribers(caseId, {
      type: 'document',
      caseId,
      data: document,
      timestamp: new Date(),
    });
  }

  public broadcastToUser(userId: string, message: any) {
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        this.sendToClient(client, {
          ...message,
          timestamp: new Date(),
        });
      }
    });
  }

  private broadcastToCaseSubscribers(caseId: string, message: any) {
    this.clients.forEach((client) => {
      if (client.caseIds.includes(caseId)) {
        this.sendToClient(client, message);
      }
    });
  }

  private sendToClient(client: WebSocketClient, message: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to client ${client.id}:`, error);
      }
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private verifyToken(token: string): any {
    // This should use the same JWT verification as the auth middleware
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, process.env.JWT_SECRET!);
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getClientInfo() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      userId: client.userId,
      userRole: client.userRole,
      caseIds: client.caseIds,
    }));
  }
}