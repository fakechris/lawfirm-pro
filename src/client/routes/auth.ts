import { Router } from 'express';
import { AuthController } from '../controllers/auth';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';

const router = Router();
const authController = new AuthController();

router.post('/login', 
  AuditMiddleware.logUserAction('CLIENT_LOGIN', 'client_auth'),
  authController.login.bind(authController)
);

router.post('/register', 
  AuditMiddleware.logUserAction('CLIENT_REGISTER', 'client_auth'),
  authController.register.bind(authController)
);

router.post('/verify', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  authController.verify.bind(authController)
);

router.post('/change-password', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  authController.changePassword.bind(authController)
);

router.put('/profile', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  authController.updateProfile.bind(authController)
);

router.post('/logout', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  AuditMiddleware.logUserAction('CLIENT_LOGOUT', 'client_auth'),
  authController.logout.bind(authController)
);

export default router;