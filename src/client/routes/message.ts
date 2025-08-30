import { Router } from 'express';
import { MessageController } from '../controllers/message';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';

const router = Router();
const messageController = new MessageController();

// Client-specific message routes
router.post('/', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  AuditMiddleware.logUserAction('CLIENT_MESSAGE_SEND', 'client_message'),
  messageController.sendMessage.bind(messageController)
);

router.get('/case/:caseId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  messageController.getCaseMessages.bind(messageController)
);

router.get('/unread', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  messageController.getUnreadMessages.bind(messageController)
);

router.post('/:messageId/read', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  messageController.markMessageAsRead.bind(messageController)
);

router.post('/mark-all-read', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  messageController.markAllMessagesAsRead.bind(messageController)
);

router.delete('/:messageId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  AuditMiddleware.logUserAction('CLIENT_MESSAGE_DELETE', 'client_message'),
  messageController.deleteMessage.bind(messageController)
);

router.get('/stats', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  messageController.getMessageStats.bind(messageController)
);

router.get('/search', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  messageController.searchMessages.bind(messageController)
);

export default router;