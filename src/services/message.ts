import { injectable, inject } from 'tsyringe';
import { Database } from '../utils/database';
import { WebSocketService } from './websocket';
import { UserRole } from '@prisma/client';
import { CreateMessageRequest, MessageResponse } from '../types';

@injectable()
export class MessageService {
  constructor(
    @inject(Database) private db: Database,
    @inject(WebSocketService) private wsService: WebSocketService
  ) {}

  async sendMessage(messageRequest: CreateMessageRequest, senderId: string): Promise<MessageResponse> {
    const { content, caseId, receiverId } = messageRequest;

    if (!content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    // Verify sender has access to the case
    await this.verifyCaseAccess(caseId, senderId);

    // Verify receiver exists and has appropriate role
    const receiver = await this.db.client.user.findUnique({
      where: { id: receiverId },
      include: {
        clientProfile: true,
        attorneyProfile: true,
      },
    });

    if (!receiver) {
      throw new Error('Receiver not found');
    }

    // Verify receiver has access to the case
    await this.verifyCaseAccess(caseId, receiverId);

    // Create message
    const message = await this.db.client.message.create({
      data: {
        content: content.trim(),
        caseId,
        senderId,
        receiverId,
      },
      include: {
        sender: true,
        receiver: true,
        case: true,
      },
    });

    const messageResponse = this.transformMessageResponse(message);

    // Broadcast real-time update
    this.wsService.broadcastMessage(caseId, messageResponse);
    this.wsService.broadcastToUser(receiverId, {
      type: 'new_message',
      data: messageResponse,
    });

    return messageResponse;
  }

  async getMessagesByCaseId(caseId: string, userId: string): Promise<MessageResponse[]> {
    // Verify user has access to the case
    await this.verifyCaseAccess(caseId, userId);

    const messages = await this.db.client.message.findMany({
      where: { caseId },
      include: {
        sender: true,
        receiver: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(message => this.transformMessageResponse(message));
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string, userId: string): Promise<MessageResponse[]> {
    // Verify the requesting user is one of the participants
    if (userId !== user1Id && userId !== user2Id) {
      throw new Error('Access denied');
    }

    const messages = await this.db.client.message.findMany({
      where: {
        OR: [
          {
            senderId: user1Id,
            receiverId: user2Id,
          },
          {
            senderId: user2Id,
            receiverId: user1Id,
          },
        ],
      },
      include: {
        sender: true,
        receiver: true,
        case: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 messages
    });

    return messages.reverse().map(message => this.transformMessageResponse(message));
  }

  async getUnreadMessages(userId: string): Promise<MessageResponse[]> {
    const messages = await this.db.client.message.findMany({
      where: {
        receiverId: userId,
        isRead: false,
      },
      include: {
        sender: true,
        receiver: true,
        case: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return messages.map(message => this.transformMessageResponse(message));
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<MessageResponse> {
    const message = await this.db.client.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.receiverId !== userId) {
      throw new Error('Access denied');
    }

    if (message.isRead) {
      return this.transformMessageResponse(message);
    }

    const updatedMessage = await this.db.client.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        sender: true,
        receiver: true,
        case: true,
      },
    });

    return this.transformMessageResponse(updatedMessage);
  }

  async markAllMessagesAsRead(userId: string, caseId?: string): Promise<void> {
    const where: any = {
      receiverId: userId,
      isRead: false,
    };

    if (caseId) {
      where.caseId = caseId;
    }

    await this.db.client.message.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.db.client.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can delete their own messages
    if (message.senderId !== userId) {
      throw new Error('Access denied');
    }

    await this.db.client.message.delete({
      where: { id: messageId },
    });
  }

  async getMessageStats(userId: string): Promise<{
    total: number;
    unread: number;
    sent: number;
    received: number;
  }> {
    const [total, unread, sent, received] = await Promise.all([
      this.db.client.message.count({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
      }),
      this.db.client.message.count({
        where: {
          receiverId: userId,
          isRead: false,
        },
      }),
      this.db.client.message.count({
        where: {
          senderId: userId,
        },
      }),
      this.db.client.message.count({
        where: {
          receiverId: userId,
        },
      }),
    ]);

    return { total, unread, sent, received };
  }

  async searchMessages(userId: string, query: string, caseId?: string): Promise<MessageResponse[]> {
    const where: any = {
      AND: [
        {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
        {
          content: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    };

    if (caseId) {
      where.AND.push({ caseId });
    }

    const messages = await this.db.client.message.findMany({
      where,
      include: {
        sender: true,
        receiver: true,
        case: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit search results
    });

    return messages.map(message => this.transformMessageResponse(message));
  }

  private async verifyCaseAccess(caseId: string, userId: string): Promise<void> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
        attorneyProfile: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let hasAccess = false;

    if (user.role === UserRole.CLIENT && user.clientProfile) {
      const caseAccess = await this.db.client.case.findFirst({
        where: {
          id: caseId,
          clientId: user.clientProfile.id,
        },
      });
      hasAccess = !!caseAccess;
    } else if (user.role === UserRole.ATTORNEY && user.attorneyProfile) {
      const caseAccess = await this.db.client.case.findFirst({
        where: {
          id: caseId,
          attorneyId: user.attorneyProfile.id,
        },
      });
      hasAccess = !!caseAccess;
    }

    if (!hasAccess) {
      throw new Error('Access denied to this case');
    }
  }

  private transformMessageResponse(message: any): MessageResponse {
    return {
      id: message.id,
      content: message.content,
      caseId: message.caseId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      isRead: message.isRead,
      createdAt: message.createdAt,
      readAt: message.readAt,
      sender: {
        id: message.sender.id,
        email: message.sender.email,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        role: message.sender.role,
        createdAt: message.sender.createdAt,
        updatedAt: message.sender.updatedAt,
      },
      receiver: {
        id: message.receiver.id,
        email: message.receiver.email,
        firstName: message.receiver.firstName,
        lastName: message.receiver.lastName,
        role: message.receiver.role,
        createdAt: message.receiver.createdAt,
        updatedAt: message.receiver.updatedAt,
      },
    };
  }
}