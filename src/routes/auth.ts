import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/refresh', AuthController.refreshToken);
router.post('/verify', AuthController.verifyToken);

// Protected routes
router.post('/logout', AuthMiddleware.authenticate, AuthController.logout);
router.post('/logout-all', AuthMiddleware.authenticate, AuthController.logoutAll);
router.post('/change-password', AuthMiddleware.authenticate, AuthController.changePassword);
router.get('/current-user', AuthMiddleware.authenticate, AuthController.getCurrentUser);
router.get('/sessions', AuthMiddleware.authenticate, AuthController.getUserSessions);
router.delete('/sessions/:sessionId', AuthMiddleware.authenticate, AuthController.revokeSession);

// Admin routes
router.post('/reset-password', 
  AuthMiddleware.authenticate,
  AuthMiddleware.requirePermission('users:update'),
  AuthController.resetPassword
);

router.post('/create-user', 
  AuthMiddleware.authenticate,
  AuthMiddleware.requirePermission('users:create'),
  AuthController.createUser
);

router.post('/initialize', 
  AuthMiddleware.authenticate,
  AuthMiddleware.requirePermission('system:configure'),
  AuthController.initialize
);

export default router;