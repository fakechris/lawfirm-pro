import { Router } from 'express';
import { MessageController } from '../controllers/message';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';

const router = Router();
const messageController = new MessageController();

// Send message
router.post('/', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  AuditMiddleware.logUserAction('MESSAGE_SEND', 'message'),
  messageController.sendMessage.bind(messageController)
);

// Get messages for a specific case
router.get('/case/:caseId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  messageController.getCaseMessages.bind(messageController)
);

// Get messages between two users
router.get('/user/:userId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  messageController.getUserMessages.bind(messageController)
);

// Get unread messages for current user
router.get('/unread', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  messageController.getUnreadMessages.bind(messageController)
);

// Mark message as read
router.post('/:messageId/read', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  messageController.markMessageAsRead.bind(messageController)
);

// Mark all messages as read
router.post('/mark-all-read', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  messageController.markAllMessagesAsRead.bind(messageController)
);

// Delete message
router.delete('/:messageId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  AuditMiddleware.logUserAction('MESSAGE_DELETE', 'message'),
  messageController.deleteMessage.bind(messageController)
);

// Get message statistics
router.get('/stats', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  messageController.getMessageStats.bind(messageController)
);

// Search messages
router.get('/search', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  messageController.searchMessages.bind(messageController)
);

export default router;