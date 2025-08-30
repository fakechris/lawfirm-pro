import { Request, Response } from 'express';
import { UserModel } from '../models/UserModel';
import { UserProfileService } from '../services/UserProfileService';
import { PermissionService } from '../services/PermissionService';
import { AuditLogModel } from '../models/AuditLogModel';
import { CreateUserRequest, UpdateUserRequest, CreateUserProfileRequest } from '../types';

export class UserController {
  /**
   * Get all users with pagination and filtering
   */
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const department = req.query.department as string;
      const search = req.query.search as string;

      const result = await UserModel.findAll(page, limit, {
        isActive,
        department,
        search,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await UserModel.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create new user
   */
  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const data = req.body as CreateUserRequest & { profile?: CreateUserProfileRequest };
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Create user
      const user = await UserModel.create(data);

      // Create profile if provided
      if (data.profile) {
        await UserProfileService.createProfile(user.id, data.profile, ipAddress, userAgent);
      }

      // Log the user creation
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_create',
        resource: 'users',
        resourceId: user.id,
        metadata: {
          newUserEmail: user.email,
          newUsername: user.username,
          hasProfile: !!data.profile,
        },
        ipAddress,
        userAgent,
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user
   */
  static async updateUser(req: Request, res: Response): Promise<void> {
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

      const data = req.body as UpdateUserRequest;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const user = await UserModel.update(id, data);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Log the user update
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_update',
        resource: 'users',
        resourceId: id,
        metadata: {
          updatedFields: Object.keys(data),
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        data: user,
        message: 'User updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
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

      // Get user info before deletion
      const user = await UserModel.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const success = await UserModel.delete(id);
      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to delete user',
        });
        return;
      }

      // Log the user deletion
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_delete',
        resource: 'users',
        resourceId: id,
        metadata: {
          deletedUserEmail: user.email,
          deletedUsername: user.username,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const permissions = await PermissionService.getUserPermissions(id);

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
   * Get user roles
   */
  static async getUserRoles(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const roles = await PermissionService.getUserRoles(id);

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
   * Add role to user
   */
  static async addRoleToUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId } = req.body;
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

      await PermissionService.addUserRole(id, roleId);

      // Log the role assignment
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_role_add',
        resource: 'users',
        resourceId: id,
        metadata: {
          roleId,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Role added to user successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Remove role from user
   */
  static async removeRoleFromUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId } = req.body;
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

      await PermissionService.removeUserRole(id, roleId);

      // Log the role removal
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_role_remove',
        resource: 'users',
        resourceId: id,
        metadata: {
          roleId,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Role removed from user successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Set user roles
   */
  static async setUserRoles(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleIds } = req.body;
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

      await PermissionService.setUserRoles(id, roleIds);

      // Log the role update
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_roles_set',
        resource: 'users',
        resourceId: id,
        metadata: {
          roleIds,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'User roles updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Add permission to user
   */
  static async addPermissionToUser(req: Request, res: Response): Promise<void> {
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

      await PermissionService.addUserPermission(id, permissionId);

      // Log the permission assignment
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_permission_add',
        resource: 'users',
        resourceId: id,
        metadata: {
          permissionId,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Permission added to user successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Remove permission from user
   */
  static async removePermissionFromUser(req: Request, res: Response): Promise<void> {
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

      await PermissionService.removeUserPermission(id, permissionId);

      // Log the permission removal
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_permission_remove',
        resource: 'users',
        resourceId: id,
        metadata: {
          permissionId,
        },
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'Permission removed from user successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(req: Request, res: Response): Promise<void> {
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

      const user = await UserModel.update(id, { isActive: false });
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Log the user deactivation
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_deactivate',
        resource: 'users',
        resourceId: id,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Activate user
   */
  static async activateUser(req: Request, res: Response): Promise<void> {
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

      const user = await UserModel.update(id, { isActive: true });
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Log the user activation
      await AuditLogModel.create({
        userId: adminUserId,
        action: 'user_activate',
        resource: 'users',
        resourceId: id,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: 'User activated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user directory
   */
  static async getUserDirectory(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        department,
        specialization,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const result = await UserProfileService.getUserDirectory({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        department: department as string,
        specialization: specialization as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as 'name' | 'email' | 'department' | 'createdAt',
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const [departmentStats, specializationStats] = await Promise.all([
        UserProfileService.getDepartmentStats(),
        UserProfileService.getSpecializationStats(),
      ]);

      res.json({
        success: true,
        data: {
          departments: departmentStats,
          specializations: specializationStats,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}