import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { MessageService } from '../services/message';
import { AuditMiddleware } from '../middleware/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateMessageRequest, MessageResponse, ApiResponse } from '../types';

export class MessageController {
  private messageService = container.resolve(MessageService);

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const messageRequest: CreateMessageRequest = req.body;

      if (!messageRequest.content || !messageRequest.caseId || !messageRequest.receiverId) {
        res.status(400).json({
          success: false,
          message: 'Content, case ID, and receiver ID are required',
        } as ApiResponse<null>);
        return;
      }

      const result: MessageResponse = await this.messageService.sendMessage(messageRequest, userId);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'MESSAGE_SEND',
        'message',
        result.id,
        null,
        { 
          content: result.content,
          caseId: result.caseId,
          receiverId: result.receiverId 
        }
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Message sent successfully',
      } as ApiResponse<MessageResponse>);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send message',
      } as ApiResponse<null>);
    }
  }

  async getCaseMessages(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      const messages: MessageResponse[] = await this.messageService.getMessagesByCaseId(caseId, userId);

      res.json({
        success: true,
        data: messages,
        message: 'Messages retrieved successfully',
      } as ApiResponse<MessageResponse[]>);
    } catch (error) {
      console.error('Get case messages error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve messages',
      } as ApiResponse<null>);
    }
  }

  async getUserMessages(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const currentUserId = (req as AuthenticatedRequest).user!.id;
      const currentUserRole = (req as AuthenticatedRequest).user!.role;

      // Users can only view their own conversations
      if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        } as ApiResponse<null>);
        return;
      }

      const messages: MessageResponse[] = await this.messageService.getMessagesBetweenUsers(
        currentUserId, 
        userId, 
        currentUserId
      );

      res.json({
        success: true,
        data: messages,
        message: 'Messages retrieved successfully',
      } as ApiResponse<MessageResponse[]>);
    } catch (error) {
      console.error('Get user messages error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve messages',
      } as ApiResponse<null>);
    }
  }

  async getUnreadMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;

      const messages: MessageResponse[] = await this.messageService.getUnreadMessages(userId);

      res.json({
        success: true,
        data: messages,
        message: 'Unread messages retrieved successfully',
      } as ApiResponse<MessageResponse[]>);
    } catch (error) {
      console.error('Get unread messages error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve unread messages',
      } as ApiResponse<null>);
    }
  }

  async markMessageAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      const result: MessageResponse = await this.messageService.markMessageAsRead(messageId, userId);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'MESSAGE_READ',
        'message',
        messageId,
        null,
        { readAt: new Date() }
      );

      res.json({
        success: true,
        data: result,
        message: 'Message marked as read',
      } as ApiResponse<MessageResponse>);
    } catch (error) {
      console.error('Mark message as read error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark message as read',
      } as ApiResponse<null>);
    }
  }

  async markAllMessagesAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const { caseId } = req.query;

      await this.messageService.markAllMessagesAsRead(userId, caseId as string);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'MESSAGES_READ_ALL',
        'message',
        undefined,
        null,
        { userId, caseId }
      );

      res.json({
        success: true,
        message: 'All messages marked as read',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('Mark all messages as read error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark all messages as read',
      } as ApiResponse<null>);
    }
  }

  async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      await this.messageService.deleteMessage(messageId, userId);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'MESSAGE_DELETE',
        'message',
        messageId,
        null,
        { deletedBy: userId }
      );

      res.json({
        success: true,
        message: 'Message deleted successfully',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete message',
      } as ApiResponse<null>);
    }
  }

  async getMessageStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;

      const stats = await this.messageService.getMessageStats(userId);

      res.json({
        success: true,
        data: stats,
        message: 'Message statistics retrieved successfully',
      } as ApiResponse<any>);
    } catch (error) {
      console.error('Get message stats error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve message statistics',
      } as ApiResponse<null>);
    }
  }

  async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, caseId } = req.query;
      const userId = (req as AuthenticatedRequest).user!.id;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        } as ApiResponse<null>);
        return;
      }

      const messages: MessageResponse[] = await this.messageService.searchMessages(
        userId, 
        query, 
        caseId as string
      );

      res.json({
        success: true,
        data: messages,
        message: 'Messages searched successfully',
      } as ApiResponse<MessageResponse[]>);
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to search messages',
      } as ApiResponse<null>);
    }
  }
}