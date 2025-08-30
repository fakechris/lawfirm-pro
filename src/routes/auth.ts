import { Router } from 'express';
import { AuthController } from '../controllers/auth';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';

const router = Router();
const authController = new AuthController();

router.post('/login', 
  AuditMiddleware.logUserAction('USER_LOGIN', 'auth'),
  authController.login.bind(authController)
);

router.post('/register', 
  AuditMiddleware.logUserAction('USER_REGISTER', 'auth'),
  authController.register.bind(authController)
);

router.post('/verify', 
  AuthMiddleware.authenticate,
  authController.verify.bind(authController)
);

router.post('/change-password', 
  AuthMiddleware.authenticate,
  authController.changePassword.bind(authController)
);

router.put('/profile', 
  AuthMiddleware.authenticate,
  authController.updateProfile.bind(authController)
);

router.post('/logout', 
  AuthMiddleware.authenticate,
  AuditMiddleware.logUserAction('USER_LOGOUT', 'auth'),
  authController.logout.bind(authController)
);

export default router;