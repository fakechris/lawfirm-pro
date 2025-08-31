import { PermissionService } from '../services/PermissionService';
import { UserModel } from '../models/UserModel';
import { RolePermissionService } from '../services/RolePermissionService';
import { CreateUserRequest } from '../types';

describe('PermissionService', () => {
  let testUser: any;
  let adminUser: any;
  let testRole: any;
  let testPermission: any;

  beforeEach(async () => {
    // Initialize system roles and permissions
    await RolePermissionService.initializeSystemRoles();
    await RolePermissionService.initializeSystemPermissions();

    // Create test users
    const userData: CreateUserRequest = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    const adminData: CreateUserRequest = {
      email: 'admin@example.com',
      username: 'admin',
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
    };

    testUser = await UserModel.create(userData);
    adminUser = await UserModel.create(adminData);

    // Get test role and permission
    const roles = await RolePermissionService.getAllRoles();
    const permissions = await RolePermissionService.getAllPermissions();
    
    testRole = roles.find(r => r.name === 'lead_attorney');
    testPermission = permissions.find(p => p.name === 'users:read');

    // Assign role to test user
    if (testRole) {
      await PermissionService.addUserRole(testUser.id, testRole.id);
    }
  });

  describe('hasPermission', () => {
    it('should return true for direct permission', async () => {
      if (testPermission) {
        await PermissionService.addUserPermission(testUser.id, testPermission.id);
        
        const hasPermission = await PermissionService.hasPermission(testUser.id, 'users:read');
        expect(hasPermission).toBe(true);
      }
    });

    it('should return true for role-based permission', async () => {
      const hasPermission = await PermissionService.hasPermission(testUser.id, 'cases:read');
      expect(hasPermission).toBe(true); // Lead attorney should have case read permission
    });

    it('should return false for non-existent permission', async () => {
      const hasPermission = await PermissionService.hasPermission(testUser.id, 'non:existent');
      expect(hasPermission).toBe(false);
    });

    it('should return false for inactive user', async () => {
      await UserModel.update(testUser.id, { isActive: false });
      
      const hasPermission = await PermissionService.hasPermission(testUser.id, 'users:read');
      expect(hasPermission).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the specified permissions', async () => {
      const permissions = ['users:read', 'cases:create', 'non:existent'];
      
      const hasAnyPermission = await PermissionService.hasAnyPermission(testUser.id, permissions);
      expect(hasAnyPermission).toBe(true);
    });

    it('should return false if user has none of the specified permissions', async () => {
      const permissions = ['non:existent1', 'non:existent2'];
      
      const hasAnyPermission = await PermissionService.hasAnyPermission(testUser.id, permissions);
      expect(hasAnyPermission).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all specified permissions', async () => {
      const permissions = ['cases:read', 'documents:read']; // Lead attorney should have both
      
      const hasAllPermissions = await PermissionService.hasAllPermissions(testUser.id, permissions);
      expect(hasAllPermissions).toBe(true);
    });

    it('should return false if user lacks any specified permission', async () => {
      const permissions = ['cases:read', 'non:existent'];
      
      const hasAllPermissions = await PermissionService.hasAllPermissions(testUser.id, permissions);
      expect(hasAllPermissions).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all user permissions', async () => {
      const permissions = await PermissionService.getUserPermissions(testUser.id);
      
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.includes('cases:read')).toBe(true);
    });

    it('should return empty array for non-existent user', async () => {
      const permissions = await PermissionService.getUserPermissions('non_existent_id');
      
      expect(permissions).toEqual([]);
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles', async () => {
      const roles = await PermissionService.getUserRoles(testUser.id);
      
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
      expect(roles.includes('lead_attorney')).toBe(true);
    });

    it('should return empty array for user with no roles', async () => {
      const roles = await PermissionService.getUserRoles(adminUser.id);
      
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBe(0);
    });
  });

  describe('hasRole', () => {
    it('should return true for assigned role', async () => {
      const hasRole = await PermissionService.hasRole(testUser.id, 'lead_attorney');
      expect(hasRole).toBe(true);
    });

    it('should return false for unassigned role', async () => {
      const hasRole = await PermissionService.hasRole(testUser.id, 'super_admin');
      expect(hasRole).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true if user has any of the specified roles', async () => {
      const roles = ['lead_attorney', 'participating_attorney', 'non_existent'];
      
      const hasAnyRole = await PermissionService.hasAnyRole(testUser.id, roles);
      expect(hasAnyRole).toBe(true);
    });

    it('should return false if user has none of the specified roles', async () => {
      const roles = ['super_admin', 'firm_admin'];
      
      const hasAnyRole = await PermissionService.hasAnyRole(testUser.id, roles);
      expect(hasAnyRole).toBe(false);
    });
  });

  describe('getUserMaxRoleLevel', () => {
    it('should return correct role level', async () => {
      const maxLevel = await PermissionService.getUserMaxRoleLevel(testUser.id);
      
      expect(maxLevel).toBe(80); // Lead attorney level
    });

    it('should return 0 for user with no roles', async () => {
      const maxLevel = await PermissionService.getUserMaxRoleLevel(adminUser.id);
      
      expect(maxLevel).toBe(0);
    });
  });

  describe('hasRoleLevel', () => {
    it('should return true for users with sufficient role level', async () => {
      const hasLevel = await PermissionService.hasRoleLevel(testUser.id, 70);
      expect(hasLevel).toBe(true);
    });

    it('should return false for users with insufficient role level', async () => {
      const hasLevel = await PermissionService.hasRoleLevel(testUser.id, 90);
      expect(hasLevel).toBe(false);
    });
  });

  describe('canManageUser', () => {
    it('should return true when manager has higher role level', async () => {
      // Create a user with lower role level
      const lowerUserData: CreateUserRequest = {
        email: 'lower@example.com',
        username: 'loweruser',
        password: 'TestPassword123!',
        firstName: 'Lower',
        lastName: 'User',
      };

      const lowerUser = await UserModel.create(lowerUserData);
      const assistantRole = (await RolePermissionService.getAllRoles()).find(r => r.name === 'legal_assistant');
      
      if (assistantRole) {
        await PermissionService.addUserRole(lowerUser.id, assistantRole.id);
      }

      const canManage = await PermissionService.canManageUser(testUser.id, lowerUser.id);
      expect(canManage).toBe(true);
    });

    it('should return false when manager has lower or equal role level', async () => {
      const canManage = await PermissionService.canManageUser(adminUser.id, testUser.id);
      expect(canManage).toBe(false);
    });
  });

  describe('getAuthContext', () => {
    it('should return complete auth context for active user', async () => {
      const authContext = await PermissionService.getAuthContext(testUser.id);
      
      expect(authContext).toBeDefined();
      expect(authContext!.userId).toBe(testUser.id);
      expect(authContext!.username).toBe(testUser.username);
      expect(authContext!.email).toBe(testUser.email);
      expect(Array.isArray(authContext!.roles)).toBe(true);
      expect(Array.isArray(authContext!.permissions)).toBe(true);
    });

    it('should return null for non-existent user', async () => {
      const authContext = await PermissionService.getAuthContext('non_existent_id');
      
      expect(authContext).toBeNull();
    });

    it('should return null for inactive user', async () => {
      await UserModel.update(testUser.id, { isActive: false });
      
      const authContext = await PermissionService.getAuthContext(testUser.id);
      
      expect(authContext).toBeNull();
    });
  });

  describe('permission management', () => {
    it('should add and remove user permissions', async () => {
      if (testPermission) {
        // Add permission
        await PermissionService.addUserPermission(testUser.id, testPermission.id);
        
        let hasPermission = await PermissionService.hasPermission(testUser.id, testPermission.name);
        expect(hasPermission).toBe(true);

        // Remove permission
        await PermissionService.removeUserPermission(testUser.id, testPermission.id);
        
        hasPermission = await PermissionService.hasPermission(testUser.id, testPermission.name);
        expect(hasPermission).toBe(false);
      }
    });

    it('should add and remove user roles', async () => {
      const adminRole = (await RolePermissionService.getAllRoles()).find(r => r.name === 'firm_admin');
      
      if (adminRole) {
        // Add role
        await PermissionService.addUserRole(testUser.id, adminRole.id);
        
        let hasRole = await PermissionService.hasRole(testUser.id, 'firm_admin');
        expect(hasRole).toBe(true);

        // Remove role
        await PermissionService.removeUserRole(testUser.id, adminRole.id);
        
        hasRole = await PermissionService.hasRole(testUser.id, 'firm_admin');
        expect(hasRole).toBe(false);
      }
    });

    it('should set user roles', async () => {
      const adminRole = (await RolePermissionService.getAllRoles()).find(r => r.name === 'firm_admin');
      const superAdminRole = (await RolePermissionService.getAllRoles()).find(r => r.name === 'super_admin');
      
      if (adminRole && superAdminRole) {
        const roleIds = [adminRole.id, superAdminRole.id];
        
        await PermissionService.setUserRoles(testUser.id, roleIds);
        
        const hasAdminRole = await PermissionService.hasRole(testUser.id, 'firm_admin');
        const hasSuperAdminRole = await PermissionService.hasRole(testUser.id, 'super_admin');
        
        expect(hasAdminRole).toBe(true);
        expect(hasSuperAdminRole).toBe(true);
      }
    });
  });
});