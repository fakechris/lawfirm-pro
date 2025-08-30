import { prisma } from '../utils/database';
import { RoleModel, PermissionModel } from '../models/RoleModel';
import { Role, Permission } from '../types';

export class RolePermissionService {
  /**
   * Create a new role
   */
  static async createRole(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    return RoleModel.create(data);
  }

  /**
   * Get all roles
   */
  static async getAllRoles(): Promise<Role[]> {
    return RoleModel.findAll();
  }

  /**
   * Get role by ID
   */
  static async getRoleById(id: string): Promise<Role | null> {
    return RoleModel.findById(id);
  }

  /**
   * Get role by name
   */
  static async getRoleByName(name: string): Promise<Role | null> {
    return RoleModel.findByName(name);
  }

  /**
   * Update role
   */
  static async updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Role | null> {
    return RoleModel.update(id, data);
  }

  /**
   * Delete role
   */
  static async deleteRole(id: string): Promise<boolean> {
    return RoleModel.delete(id);
  }

  /**
   * Get system roles
   */
  static async getSystemRoles(): Promise<Role[]> {
    return RoleModel.getSystemRoles();
  }

  /**
   * Initialize system roles
   */
  static async initializeSystemRoles(): Promise<void> {
    return RoleModel.createSystemRoles();
  }

  /**
   * Add permission to role
   */
  static async addPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    return RoleModel.addPermission(roleId, permissionId);
  }

  /**
   * Remove permission from role
   */
  static async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    return RoleModel.removePermission(roleId, permissionId);
  }

  /**
   * Get role permissions
   */
  static async getRolePermissions(roleId: string): Promise<Permission[]> {
    return RoleModel.getRolePermissions(roleId);
  }

  /**
   * Set role permissions (replaces all existing permissions)
   */
  static async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    // Remove all existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new permissions
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId,
          permissionId,
        })),
      });
    }
  }

  /**
   * Create a new permission
   */
  static async createPermission(data: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>): Promise<Permission> {
    return PermissionModel.create(data);
  }

  /**
   * Get all permissions
   */
  static async getAllPermissions(): Promise<Permission[]> {
    return PermissionModel.findAll();
  }

  /**
   * Get permission by ID
   */
  static async getPermissionById(id: string): Promise<Permission | null> {
    return PermissionModel.findById(id);
  }

  /**
   * Get permission by name
   */
  static async getPermissionByName(name: string): Promise<Permission | null> {
    return PermissionModel.findByName(name);
  }

  /**
   * Update permission
   */
  static async updatePermission(id: string, data: Partial<Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Permission | null> {
    return PermissionModel.update(id, data);
  }

  /**
   * Delete permission
   */
  static async deletePermission(id: string): Promise<boolean> {
    return PermissionModel.delete(id);
  }

  /**
   * Get permissions by resource
   */
  static async getPermissionsByResource(resource: string): Promise<Permission[]> {
    return PermissionModel.findByResource(resource);
  }

  /**
   * Get all resources
   */
  static async getAllResources(): Promise<string[]> {
    return PermissionModel.getResources();
  }

  /**
   * Get all actions
   */
  static async getAllActions(): Promise<string[]> {
    return PermissionModel.getActions();
  }

  /**
   * Initialize system permissions
   */
  static async initializeSystemPermissions(): Promise<void> {
    return PermissionModel.createSystemPermissions();
  }

  /**
   * Get role hierarchy
   */
  static async getRoleHierarchy(): Promise<Role[]> {
    const roles = await RoleModel.findAll();
    return roles.sort((a, b) => b.level - a.level); // Sort by level descending
  }

  /**
   * Get roles by level range
   */
  static async getRolesByLevel(minLevel: number, maxLevel: number): Promise<Role[]> {
    const roles = await prisma.role.findMany({
      where: {
        level: {
          gte: minLevel,
          lte: maxLevel,
        },
      },
      orderBy: { level: 'desc' },
    });

    return roles;
  }

  /**
   * Check if role can manage another role
   */
  static async canManageRole(managerRoleId: string, targetRoleId: string): Promise<boolean> {
    const [managerRole, targetRole] = await Promise.all([
      RoleModel.findById(managerRoleId),
      RoleModel.findById(targetRoleId),
    ]);

    if (!managerRole || !targetRole) {
      return false;
    }

    return managerRole.level > targetRole.level;
  }

  /**
   * Get role statistics
   */
  static async getRoleStats(): Promise<{ role: Role; userCount: number }[]> {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { level: 'desc' },
    });

    return roles.map(role => ({
      role,
      userCount: role._count.users,
    }));
  }

  /**
   * Get permission usage statistics
   */
  static async getPermissionStats(): Promise<{ permission: Permission; roleCount: number; userCount: number }[]> {
    const permissions = await prisma.permission.findMany({
      include: {
        roles: {
          include: {
            role: {
              include: {
                users: true,
              },
            },
          },
        },
        users: true,
      },
    });

    return permissions.map(permission => {
      const uniqueRoles = new Set(permission.roles.map(rp => rp.role));
      const uniqueUsers = new Set([
        ...permission.users.map(up => up.userId),
        ...permission.roles.flatMap(rp => rp.role.users.map(u => u.userId)),
      ]);

      return {
        permission,
        roleCount: uniqueRoles.size,
        userCount: uniqueUsers.size,
      };
    });
  }

  /**
   * Bulk create roles
   */
  static async bulkCreateRoles(roles: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Role[]> {
    const createdRoles = await prisma.role.createMany({
      data: roles,
    });

    return prisma.role.findMany({
      where: {
        name: {
          in: roles.map(r => r.name),
        },
      },
    });
  }

  /**
   * Bulk create permissions
   */
  static async bulkCreatePermissions(permissions: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Permission[]> {
    const createdPermissions = await prisma.permission.createMany({
      data: permissions,
    });

    return prisma.permission.findMany({
      where: {
        name: {
          in: permissions.map(p => p.name),
        },
      },
    });
  }

  /**
   * Clone role permissions
   */
  static async cloneRolePermissions(sourceRoleId: string, targetRoleId: string): Promise<void> {
    const sourcePermissions = await RoleModel.getRolePermissions(sourceRoleId);
    
    await this.setRolePermissions(
      targetRoleId,
      sourcePermissions.map(p => p.id)
    );
  }

  /**
   * Get effective permissions for a role (including inherited permissions from lower-level roles)
   */
  static async getEffectiveRolePermissions(roleId: string): Promise<Permission[]> {
    const role = await RoleModel.findById(roleId);
    if (!role) return [];

    // Get direct permissions
    const directPermissions = await RoleModel.getRolePermissions(roleId);

    // Get permissions from lower-level roles (if this is a high-level role)
    const inheritedPermissions: Permission[] = [];
    
    if (role.level > 50) { // Only high-level roles inherit permissions
      const lowerRoles = await prisma.role.findMany({
        where: {
          level: {
            lt: role.level,
          },
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      lowerRoles.forEach(lowerRole => {
        lowerRole.permissions.forEach(rp => {
          inheritedPermissions.push(rp.permission);
        });
      });
    }

    // Combine and deduplicate permissions
    const allPermissions = [...directPermissions, ...inheritedPermissions];
    const uniquePermissions = allPermissions.filter((permission, index, self) =>
      index === self.findIndex(p => p.id === permission.id)
    );

    return uniquePermissions;
  }

  /**
   * Validate role structure
   */
  static async validateRoleStructure(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check for duplicate role names
      const roles = await prisma.role.findMany();
      const roleNames = roles.map(r => r.name);
      const duplicateNames = roleNames.filter((name, index) => roleNames.indexOf(name) !== index);
      
      if (duplicateNames.length > 0) {
        errors.push(`Duplicate role names found: ${duplicateNames.join(', ')}`);
      }

      // Check for duplicate permission names
      const permissions = await prisma.permission.findMany();
      const permissionNames = permissions.map(p => p.name);
      const duplicatePermissionNames = permissionNames.filter((name, index) => permissionNames.indexOf(name) !== index);
      
      if (duplicatePermissionNames.length > 0) {
        errors.push(`Duplicate permission names found: ${duplicatePermissionNames.join(', ')}`);
      }

      // Check for role level consistency
      const roleLevels = roles.map(r => r.level);
      const duplicateLevels = roleLevels.filter((level, index) => roleLevels.indexOf(level) !== index);
      
      if (duplicateLevels.length > 0) {
        errors.push(`Duplicate role levels found: ${duplicateLevels.join(', ')}`);
      }

      // Check for system role integrity
      const systemRoles = roles.filter(r => r.isSystem);
      const requiredSystemRoles = ['super_admin', 'firm_admin', 'lead_attorney', 'participating_attorney', 'legal_assistant', 'administrative_staff'];
      
      for (const requiredRole of requiredSystemRoles) {
        if (!systemRoles.find(r => r.name === requiredRole)) {
          errors.push(`Missing required system role: ${requiredRole}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: ['Validation failed: ' + (error as Error).message],
      };
    }
  }
}