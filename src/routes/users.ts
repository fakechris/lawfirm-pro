import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(AuthMiddleware.authenticate);

// User CRUD operations
router.get('/', 
  AuthMiddleware.requirePermission('users:read'),
  UserController.getAllUsers
);

router.get('/directory', 
  AuthMiddleware.requirePermission('users:read'),
  UserController.getUserDirectory
);

router.get('/stats', 
  AuthMiddleware.requirePermission('users:read'),
  UserController.getUserStats
);

router.get('/:id', 
  AuthMiddleware.requirePermission('users:read'),
  UserController.getUserById
);

router.post('/', 
  AuthMiddleware.requirePermission('users:create'),
  UserController.createUser
);

router.put('/:id', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.updateUser
);

router.delete('/:id', 
  AuthMiddleware.requirePermission('users:delete'),
  UserController.deleteUser
);

// User activation/deactivation
router.post('/:id/activate', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.activateUser
);

router.post('/:id/deactivate', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.deactivateUser
);

// User permissions
router.get('/:id/permissions', 
  AuthMiddleware.requirePermission('users:read'),
  UserController.getUserPermissions
);

router.post('/:id/permissions', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.addPermissionToUser
);

router.delete('/:id/permissions', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.removePermissionFromUser
);

// User roles
router.get('/:id/roles', 
  AuthMiddleware.requirePermission('users:read'),
  UserController.getUserRoles
);

router.post('/:id/roles', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.addRoleToUser
);

router.delete('/:id/roles', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.removeRoleFromUser
);

router.put('/:id/roles', 
  AuthMiddleware.requirePermission('users:update'),
  UserController.setUserRoles
);

export default router;