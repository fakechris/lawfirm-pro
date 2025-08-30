import { Router } from 'express';
import { RoleController, PermissionController } from '../controllers/RolePermissionController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// All role/permission routes require authentication
router.use(AuthMiddleware.authenticate);

// Role routes
router.get('/roles', 
  AuthMiddleware.requirePermission('roles:read'),
  RoleController.getAllRoles
);

router.get('/roles/hierarchy', 
  AuthMiddleware.requirePermission('roles:read'),
  RoleController.getRoleHierarchy
);

router.get('/roles/stats', 
  AuthMiddleware.requirePermission('roles:read'),
  RoleController.getRoleStats
);

router.get('/roles/:id', 
  AuthMiddleware.requirePermission('roles:read'),
  RoleController.getRoleById
);

router.get('/roles/name/:name', 
  AuthMiddleware.requirePermission('roles:read'),
  RoleController.getRoleByName
);

router.post('/roles', 
  AuthMiddleware.requirePermission('roles:create'),
  RoleController.createRole
);

router.put('/roles/:id', 
  AuthMiddleware.requirePermission('roles:update'),
  RoleController.updateRole
);

router.delete('/roles/:id', 
  AuthMiddleware.requirePermission('roles:delete'),
  RoleController.deleteRole
);

router.get('/roles/:id/permissions', 
  AuthMiddleware.requirePermission('roles:read'),
  RoleController.getRolePermissions
);

router.post('/roles/:id/permissions', 
  AuthMiddleware.requirePermission('roles:update'),
  RoleController.addPermissionToRole
);

router.delete('/roles/:id/permissions', 
  AuthMiddleware.requirePermission('roles:update'),
  RoleController.removePermissionFromRole
);

router.put('/roles/:id/permissions', 
  AuthMiddleware.requirePermission('roles:update'),
  RoleController.setRolePermissions
);

router.post('/roles/initialize', 
  AuthMiddleware.requirePermission('system:configure'),
  RoleController.initializeSystemRoles
);

// Permission routes
router.get('/permissions', 
  AuthMiddleware.requirePermission('permissions:read'),
  PermissionController.getAllPermissions
);

router.get('/permissions/stats', 
  AuthMiddleware.requirePermission('permissions:read'),
  PermissionController.getPermissionStats
);

router.get('/permissions/resources', 
  AuthMiddleware.requirePermission('permissions:read'),
  PermissionController.getAllResources
);

router.get('/permissions/actions', 
  AuthMiddleware.requirePermission('permissions:read'),
  PermissionController.getAllActions
);

router.get('/permissions/:id', 
  AuthMiddleware.requirePermission('permissions:read'),
  PermissionController.getPermissionById
);

router.get('/permissions/name/:name', 
  AuthMiddleware.requirePermission('permissions:read'),
  PermissionController.getPermissionByName
);

router.get('/permissions/resource/:resource', 
  AuthMiddleware.requirePermission('permissions:read'),
  PermissionController.getPermissionsByResource
);

router.post('/permissions', 
  AuthMiddleware.requirePermission('permissions:create'),
  PermissionController.createPermission
);

router.put('/permissions/:id', 
  AuthMiddleware.requirePermission('permissions:update'),
  PermissionController.updatePermission
);

router.delete('/permissions/:id', 
  AuthMiddleware.requirePermission('permissions:delete'),
  PermissionController.deletePermission
);

router.post('/permissions/initialize', 
  AuthMiddleware.requirePermission('system:configure'),
  PermissionController.initializeSystemPermissions
);

router.get('/permissions/validate', 
  AuthMiddleware.requirePermission('system:configure'),
  PermissionController.validateRoleStructure
);

export default router;