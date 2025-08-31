import { prisma } from '../utils/database';
import { User, CreateUserRequest, UpdateUserRequest } from '../types';
import { hashPassword, sanitizeUser } from '../utils/auth';

export class UserModel {
  static async create(data: CreateUserRequest & { roleIds?: string[] }): Promise<User> {
    const hashedPassword = await hashPassword(data.password);
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        roles: data.roleIds ? {
          create: data.roleIds.map(roleId => ({
            roleId,
          })),
        } : undefined,
      },
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
        profile: true,
      },
    });

    return sanitizeUser(user);
  }

  static async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
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
        profile: true,
      },
    });

    return user ? sanitizeUser(user) : null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
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
        profile: true,
      },
    });

    return user ? sanitizeUser(user) : null;
  }

  static async findByUsername(username: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { username },
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
        profile: true,
      },
    });

    return user ? sanitizeUser(user) : null;
  }

  static async update(id: string, data: UpdateUserRequest): Promise<User | null> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.username && { username: data.username }),
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
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
        profile: true,
      },
    });

    return sanitizeUser(user);
  }

  static async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: {
      isActive?: boolean;
      department?: string;
      search?: string;
    }
  ): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    
    if (filters?.department) {
      where.profile = {
        department: filters.department,
      };
    }
    
    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          profile: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map(sanitizeUser),
      total,
    };
  }

  static async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  static async changePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  static async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id },
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

  static async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    return userRoles.map(ur => ur.role.name);
  }

  static async addRole(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
    });
  }

  static async removeRole(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  }

  static async addPermission(userId: string, permissionId: string): Promise<void> {
    await prisma.userPermission.create({
      data: {
        userId,
        permissionId,
      },
    });
  }

  static async removePermission(userId: string, permissionId: string): Promise<void> {
    await prisma.userPermission.delete({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });
  }
}