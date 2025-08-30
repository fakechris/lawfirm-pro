import { Request, Response } from 'express';
import { RolePermissionService } from '../services/RolePermissionService';
import { AuditLogModel } from '../models/AuditLogModel';
import { Role, Permission } from '../types';

export class RoleController {
  /**
   * Get all roles
   */
  static async getAllRoles(req: Request, res: Response): Promise<void> {
    try {
      const roles = await RolePermissionService.getAllRoles();

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get role by ID
   */
  static async getRoleById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const role = await RolePermissionService.getRoleById(id);
      if (!role) {
        res.status(404).json({
          success: false,
          error: 'Role not found',
        });
        return;
      }

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get role by name
   */
  static async getRoleByName(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      const role = await RolePermissionService.getRoleByName(name);
      if (!role) {
        res.status(404).json({
          success: false,
          error: 'Role not found',
        });
        return;
      }

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create new role
   */
  static async createRole(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const data = req.body as Omit<Role, 'id' | 'createdAt' | 'updatedAt'>;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const role = await RolePermissionService.createRole(data);

      // Log the role creation
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'role_create',
        resource: 'roles',
        resourceId: role.id,
        metadata: {
          roleName: role.name,
          roleLevel: role.level,
        },
        ipAddress,
        userAgent,
      });

      res.status(201).json({
        success: true,
        data: role,
        message: 'Role created successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update role
   */
  static async updateRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const data = req.body as Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const role = await RolePermissionService.updateRole(id, data);
      if (!role) {
        res.status(404).json({
          success: false,
          error: 'Role not found',
        });
        return;
      }

      // Log the role update
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'role_update',
        resource: 'roles',
        resourceId: id,
        metadata: {
          updatedFields: Object.keys(data),
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        data: role,
        message: 'Role updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Delete role
   */
  static async deleteRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Get role info before deletion
      const role = await RolePermissionService.getRoleById(id);
      if (!role) {
        res.status(404).json({
          success: false,
          error: 'Role not found',
        });
        return;
      }

      // Don't allow deletion of system roles
      if (role.isSystem) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete system roles',
        });
        return;
      }

      const success = await RolePermissionService.deleteRole(id);
      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to delete role',
        });
        return;
      }

      // Log the role deletion
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'role_delete',
        resource: 'roles',
        resourceId: id,
        metadata: {
          roleName: role.name,
          roleLevel: role.level,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get role permissions
   */
  static async getRolePermissions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const permissions = await RolePermissionService.getRolePermissions(id);

      res.json({
        success: true,
        data: permissions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Add permission to role
   */
  static async addPermissionToRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { permissionId } = req.body;
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await RolePermissionService.addPermissionToRole(id, permissionId);

      // Log the permission assignment
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'role_permission_add',
        resource: 'roles',
        resourceId: id,
        metadata: {
          permissionId,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Permission added to role successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Remove permission from role
   */
  static async removePermissionFromRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { permissionId } = req.body;
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await RolePermissionService.removePermissionFromRole(id, permissionId);

      // Log the permission removal
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'role_permission_remove',
        resource: 'roles',
        resourceId: id,
        metadata: {
          permissionId,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Permission removed from role successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Set role permissions
   */
  static async setRolePermissions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { permissionIds } = req.body;
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await RolePermissionService.setRolePermissions(id, permissionIds);

      // Log the permission update
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'role_permissions_set',
        resource: 'roles',
        resourceId: id,
        metadata: {
          permissionIds,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Role permissions updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get role hierarchy
   */
  static async getRoleHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const roles = await RolePermissionService.getRoleHierarchy();

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get role statistics
   */
  static async getRoleStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await RolePermissionService.getRoleStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Initialize system roles
   */
  static async initializeSystemRoles(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await RolePermissionService.initializeSystemRoles();

      // Log the initialization
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'system_roles_initialize',
        resource: 'roles',
        metadata: {
          method: 'admin_initiated',
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'System roles initialized successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}

export class PermissionController {
  /**
   * Get all permissions
   */
  static async getAllPermissions(req: Request, res: Response): Promise<void> {
    try {
      const permissions = await RolePermissionService.getAllPermissions();

      res.json({
        success: true,
        data: permissions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get permission by ID
   */
  static async getPermissionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const permission = await RolePermissionService.getPermissionById(id);
      if (!permission) {
        res.status(404).json({
          success: false,
          error: 'Permission not found',
        });
        return;
      }

      res.json({
        success: true,
        data: permission,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get permission by name
   */
  static async getPermissionByName(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      const permission = await RolePermissionService.getPermissionByName(name);
      if (!permission) {
        res.status(404).json({
          success: false,
          error: 'Permission not found',
        });
        return;
      }

      res.json({
        success: true,
        data: permission,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get permissions by resource
   */
  static async getPermissionsByResource(req: Request, res: Response): Promise<void> {
    try {
      const { resource } = req.params;

      const permissions = await RolePermissionService.getPermissionsByResource(resource);

      res.json({
        success: true,
        data: permissions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create new permission
   */
  static async createPermission(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const data = req.body as Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const permission = await RolePermissionService.createPermission(data);

      // Log the permission creation
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'permission_create',
        resource: 'permissions',
        resourceId: permission.id,
        metadata: {
          permissionName: permission.name,
          resource: permission.resource,
          action: permission.action,
        },
        ipAddress,
        userAgent,
      });

      res.status(201).json({
        success: true,
        data: permission,
        message: 'Permission created successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update permission
   */
  static async updatePermission(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const data = req.body as Partial<Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>>;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const permission = await RolePermissionService.updatePermission(id, data);
      if (!permission) {
        res.status(404).json({
          success: false,
          error: 'Permission not found',
        });
        return;
      }

      // Log the permission update
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'permission_update',
        resource: 'permissions',
        resourceId: id,
        metadata: {
          updatedFields: Object.keys(data),
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        data: permission,
        message: 'Permission updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Delete permission
   */
  static async deletePermission(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Get permission info before deletion
      const permission = await RolePermissionService.getPermissionById(id);
      if (!permission) {
        res.status(404).json({
          success: false,
          error: 'Permission not found',
        });
        return;
      }

      // Don't allow deletion of system permissions
      if (permission.isSystem) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete system permissions',
        });
        return;
      }

      const success = await RolePermissionService.deletePermission(id);
      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to delete permission',
        });
        return;
      }

      // Log the permission deletion
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'permission_delete',
        resource: 'permissions',
        resourceId: id,
        metadata: {
          permissionName: permission.name,
          resource: permission.resource,
          action: permission.action,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Permission deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get all resources
   */
  static async getAllResources(req: Request, res: Response): Promise<void> {
    try {
      const resources = await RolePermissionService.getAllResources();

      res.json({
        success: true,
        data: resources,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get all actions
   */
  static async getAllActions(req: Request, res: Response): Promise<void> {
    try {
      const actions = await RolePermissionService.getAllActions();

      res.json({
        success: true,
        data: actions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get permission usage statistics
   */
  static async getPermissionStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await RolePermissionService.getPermissionStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Initialize system permissions
   */
  static async initializeSystemPermissions(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await RolePermissionService.initializeSystemPermissions();

      // Log the initialization
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'system_permissions_initialize',
        resource: 'permissions',
        metadata: {
          method: 'admin_initiated',
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'System permissions initialized successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Validate role structure
   */
  static async validateRoleStructure(req: Request, res: Response): Promise<void> {
    try {
      const validation = await RolePermissionService.validateRoleStructure();

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}