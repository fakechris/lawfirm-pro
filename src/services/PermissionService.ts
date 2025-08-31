import { prisma } from '../utils/database';
import { AuthContext } from '../types';

export class PermissionService {
  /**
   * Check if a user has a specific permission
   */
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return false;
    }

    // Check user-specific permissions
    const userPermissions = user.permissions.map(up => up.permission.name);
    if (userPermissions.includes(permission)) {
      return true;
    }

    // Check role-based permissions
    const rolePermissions = user.roles.flatMap(ur => 
      ur.role.permissions.map(rp => rp.permission.name)
    );
    
    return rolePermissions.includes(permission);
  }

  /**
   * Check if a user has any of the specified permissions
   */
  static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a user has all of the specified permissions
   */
  static async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all permissions for a user
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) return [];

    const rolePermissions = user.roles.flatMap(ur => 
      ur.role.permissions.map(rp => rp.permission.name)
    );
    
    const userPermissions = user.permissions.map(up => up.permission.name);
    
    return [...new Set([...rolePermissions, ...userPermissions])];
  }

  /**
   * Get user roles
   */
  static async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    return userRoles.map(ur => ur.role.name);
  }

  /**
   * Check if user has a specific role
   */
  static async hasRole(userId: string, roleName: string): Promise<boolean> {
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          name: roleName,
        },
      },
    });

    return !!userRole;
  }

  /**
   * Check if user has any of the specified roles
   */
  static async hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        role: {
          name: {
            in: roleNames,
          },
        },
      },
    });

    return userRoles.length > 0;
  }

  /**
   * Get user's maximum role level
   */
  static async getUserMaxRoleLevel(userId: string): Promise<number> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    if (userRoles.length === 0) {
      return 0;
    }

    return Math.max(...userRoles.map(ur => ur.role.level));
  }

  /**
   * Check if user has role level greater than or equal to specified level
   */
  static async hasRoleLevel(userId: string, minLevel: number): Promise<boolean> {
    const maxLevel = await this.getUserMaxRoleLevel(userId);
    return maxLevel >= minLevel;
  }

  /**
   * Check if user can manage another user (has higher role level)
   */
  static async canManageUser(managerUserId: string, targetUserId: string): Promise<boolean> {
    const managerLevel = await this.getUserMaxRoleLevel(managerUserId);
    const targetLevel = await this.getUserMaxRoleLevel(targetUserId);
    
    return managerLevel > targetLevel;
  }

  /**
   * Get auth context for a user
   */
  static async getAuthContext(userId: string): Promise<AuthContext | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const [permissions, roles] = await Promise.all([
      this.getUserPermissions(userId),
      this.getUserRoles(userId),
    ]);

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    };
  }

  /**
   * Add permission to user
   */
  static async addUserPermission(userId: string, permissionId: string): Promise<void> {
    await prisma.userPermission.create({
      data: {
        userId,
        permissionId,
      },
    });
  }

  /**
   * Remove permission from user
   */
  static async removeUserPermission(userId: string, permissionId: string): Promise<void> {
    await prisma.userPermission.delete({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });
  }

  /**
   * Add role to user
   */
  static async addUserRole(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
    });
  }

  /**
   * Remove role from user
   */
  static async removeUserRole(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  }

  /**
   * Set user roles (replaces all existing roles)
   */
  static async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    // Remove all existing roles
    await prisma.userRole.deleteMany({
      where: { userId },
    });

    // Add new roles
    if (roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map(roleId => ({
          userId,
          roleId,
        })),
      });
    }
  }

  /**
   * Set user permissions (replaces all existing permissions)
   */
  static async setUserPermissions(userId: string, permissionIds: string[]): Promise<void> {
    // Remove all existing permissions
    await prisma.userPermission.deleteMany({
      where: { userId },
    });

    // Add new permissions
    if (permissionIds.length > 0) {
      await prisma.userPermission.createMany({
        data: permissionIds.map(permissionId => ({
          userId,
          permissionId,
        })),
      });
    }
  }

  /**
   * Get users with specific permission
   */
  static async getUsersWithPermission(permission: string): Promise<string[]> {
    const permissionRecord = await prisma.permission.findUnique({
      where: { name: permission },
    });

    if (!permissionRecord) {
      return [];
    }

    // Get users with direct permission
    const directUsers = await prisma.userPermission.findMany({
      where: { permissionId: permissionRecord.id },
      select: { userId: true },
    });

    // Get users with role-based permission
    const roleUsers = await prisma.rolePermission.findMany({
      where: { permissionId: permissionRecord.id },
      include: {
        role: {
          include: {
            users: {
              select: { userId: true },
            },
          },
        },
      },
    });

    const roleUserIds = roleUsers.flatMap(rp => 
      rp.role.users.map(ru => ru.userId)
    );

    return [...new Set([...directUsers.map(du => du.userId), ...roleUserIds])];
  }

  /**
   * Get users with specific role
   */
  static async getUsersWithRole(roleName: string): Promise<string[]> {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return [];
    }

    const userRoles = await prisma.userRole.findMany({
      where: { roleId: role.id },
      select: { userId: true },
    });

    return userRoles.map(ur => ur.userId);
  }
}