import { UserModel } from '../models/UserModel';
import { RolePermissionService } from '../services/RolePermissionService';
import { CreateUserRequest, UpdateUserRequest } from '../types';

describe('UserModel', () => {
  let testUser: any;
  let testRole: any;

  beforeEach(async () => {
    // Initialize system roles
    await RolePermissionService.initializeSystemRoles();

    // Get test role
    const roles = await RolePermissionService.getAllRoles();
    testRole = roles.find(r => r.name === 'lead_attorney');
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData: CreateUserRequest = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        phone: '+8613800138000',
        roleIds: testRole ? [testRole.id] : undefined,
      };

      const user = await UserModel.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.phone).toBe(userData.phone);
      expect(user.isActive).toBe(true);
      expect(user.isVerified).toBe(false);
      expect(user.password).not.toBe(userData.password); // Password should be hashed
    });

    it('should create user without roles', async () => {
      const userData: CreateUserRequest = {
        email: 'noroles@example.com',
        username: 'noroles',
        password: 'TestPassword123!',
        firstName: 'No',
        lastName: 'Roles',
      };

      const user = await UserModel.create(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
    });

    it('should hash password', async () => {
      const userData: CreateUserRequest = {
        email: 'hashtest@example.com',
        username: 'hashtest',
        password: 'TestPassword123!',
        firstName: 'Hash',
        lastName: 'Test',
      };

      const user = await UserModel.create(userData);

      expect(user.password).not.toBe(userData.password);
      expect(user.password.length).toBeGreaterThan(50); // bcrypt hash length
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const userData: CreateUserRequest = {
        email: 'findbyid@example.com',
        username: 'findbyid',
        password: 'TestPassword123!',
        firstName: 'Find',
        lastName: 'ById',
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should return null for non-existent user', async () => {
      const user = await UserModel.findById('non_existent_id');
      expect(user).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData: CreateUserRequest = {
        email: 'findbyemail@example.com',
        username: 'findbyemail',
        password: 'TestPassword123!',
        firstName: 'Find',
        lastName: 'ByEmail',
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findByEmail(userData.email);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should return null for non-existent email', async () => {
      const user = await UserModel.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      const userData: CreateUserRequest = {
        email: 'findbyusername@example.com',
        username: 'findbyusername',
        password: 'TestPassword123!',
        firstName: 'Find',
        lastName: 'ByUsername',
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findByUsername(userData.username);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.username).toBe(userData.username);
    });

    it('should return null for non-existent username', async () => {
      const user = await UserModel.findByUsername('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const userData: CreateUserRequest = {
        email: 'update@example.com',
        username: 'update',
        password: 'TestPassword123!',
        firstName: 'Update',
        lastName: 'Test',
      };

      const user = await UserModel.create(userData);
      
      const updateData: UpdateUserRequest = {
        firstName: 'Updated',
        lastName: 'User',
        phone: '+8613900139000',
        isActive: false,
      };

      const updatedUser = await UserModel.update(user.id, updateData);

      expect(updatedUser).toBeDefined();
      expect(updatedUser!.firstName).toBe(updateData.firstName);
      expect(updatedUser!.lastName).toBe(updateData.lastName);
      expect(updatedUser!.phone).toBe(updateData.phone);
      expect(updatedUser!.isActive).toBe(updateData.isActive);
    });

    it('should return null for non-existent user', async () => {
      const updateData: UpdateUserRequest = {
        firstName: 'Updated',
      };

      const updatedUser = await UserModel.update('non_existent_id', updateData);
      expect(updatedUser).toBeNull();
    });

    it('should update only provided fields', async () => {
      const userData: CreateUserRequest = {
        email: 'partial@example.com',
        username: 'partial',
        password: 'TestPassword123!',
        firstName: 'Partial',
        lastName: 'Update',
        phone: '+8613800138000',
      };

      const user = await UserModel.create(userData);
      
      const updateData: UpdateUserRequest = {
        firstName: 'Updated',
      };

      const updatedUser = await UserModel.update(user.id, updateData);

      expect(updatedUser).toBeDefined();
      expect(updatedUser!.firstName).toBe(updateData.firstName);
      expect(updatedUser!.lastName).toBe(userData.lastName); // Should remain unchanged
      expect(updatedUser!.phone).toBe(userData.phone); // Should remain unchanged
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const userData: CreateUserRequest = {
        email: 'delete@example.com',
        username: 'delete',
        password: 'TestPassword123!',
        firstName: 'Delete',
        lastName: 'Test',
      };

      const user = await UserModel.create(userData);
      
      const deleted = await UserModel.delete(user.id);
      expect(deleted).toBe(true);

      const foundUser = await UserModel.findById(user.id);
      expect(foundUser).toBeNull();
    });

    it('should return false for non-existent user', async () => {
      const deleted = await UserModel.delete('non_existent_id');
      expect(deleted).toBe(false);
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test users
      const usersData: CreateUserRequest[] = [
        {
          email: 'user1@example.com',
          username: 'user1',
          password: 'TestPassword123!',
          firstName: 'User',
          lastName: 'One',
          isActive: true,
        },
        {
          email: 'user2@example.com',
          username: 'user2',
          password: 'TestPassword123!',
          firstName: 'User',
          lastName: 'Two',
          isActive: false,
        },
        {
          email: 'user3@example.com',
          username: 'user3',
          password: 'TestPassword123!',
          firstName: 'User',
          lastName: 'Three',
          isActive: true,
        },
      ];

      for (const userData of usersData) {
        await UserModel.create(userData);
      }
    });

    it('should return paginated users', async () => {
      const result = await UserModel.findAll(1, 2);

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(3);
    });

    it('should filter by active status', async () => {
      const activeResult = await UserModel.findAll(1, 10, { isActive: true });
      const inactiveResult = await UserModel.findAll(1, 10, { isActive: false });

      expect(activeResult.users.every(u => u.isActive)).toBe(true);
      expect(inactiveResult.users.every(u => !u.isActive)).toBe(true);
    });

    it('should search by email', async () => {
      const result = await UserModel.findAll(1, 10, { search: 'user1@example.com' });

      expect(result.users.length).toBe(1);
      expect(result.users[0].email).toBe('user1@example.com');
    });

    it('should search by name', async () => {
      const result = await UserModel.findAll(1, 10, { search: 'User One' });

      expect(result.users.length).toBe(1);
      expect(result.users[0].firstName).toBe('User');
      expect(result.users[0].lastName).toBe('One');
    });
  });

  describe('role management', () => {
    it('should add and remove user roles', async () => {
      const userData: CreateUserRequest = {
        email: 'roleuser@example.com',
        username: 'roleuser',
        password: 'TestPassword123!',
        firstName: 'Role',
        lastName: 'User',
      };

      const user = await UserModel.create(userData);

      if (testRole) {
        // Add role
        await UserModel.addRole(user.id, testRole.id);
        
        const roles = await UserModel.getUserRoles(user.id);
        expect(roles).toContain(testRole.name);

        // Remove role
        await UserModel.removeRole(user.id, testRole.id);
        
        const updatedRoles = await UserModel.getUserRoles(user.id);
        expect(updatedRoles).not.toContain(testRole.name);
      }
    });

    it('should add and remove user permissions', async () => {
      const userData: CreateUserRequest = {
        email: 'permuser@example.com',
        username: 'permuser',
        password: 'TestPassword123!',
        firstName: 'Perm',
        lastName: 'User',
      };

      const user = await UserModel.create(userData);
      const permissions = await RolePermissionService.getAllPermissions();
      const testPermission = permissions.find(p => p.name === 'users:read');

      if (testPermission) {
        // Add permission
        await UserModel.addPermission(user.id, testPermission.id);
        
        const userPermissions = await UserModel.getUserPermissions(user.id);
        expect(userPermissions).toContain(testPermission.name);

        // Remove permission
        await UserModel.removePermission(user.id, testPermission.id);
        
        const updatedPermissions = await UserModel.getUserPermissions(user.id);
        expect(updatedPermissions).not.toContain(testPermission.name);
      }
    });
  });

  describe('password management', () => {
    it('should update last login time', async () => {
      const userData: CreateUserRequest = {
        email: 'login@example.com',
        username: 'login',
        password: 'TestPassword123!',
        firstName: 'Login',
        lastName: 'Test',
      };

      const user = await UserModel.create(userData);
      expect(user.lastLoginAt).toBeNull();

      await UserModel.updateLastLogin(user.id);
      
      const updatedUser = await UserModel.findById(user.id);
      expect(updatedUser!.lastLoginAt).toBeDefined();
      expect(updatedUser!.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should change password', async () => {
      const userData: CreateUserRequest = {
        email: 'password@example.com',
        username: 'password',
        password: 'TestPassword123!',
        firstName: 'Password',
        lastName: 'Test',
      };

      const user = await UserModel.create(userData);
      const oldPassword = user.password;
      const newPassword = 'NewPassword123!';

      await UserModel.changePassword(user.id, newPassword);
      
      const updatedUser = await UserModel.findById(user.id);
      expect(updatedUser!.password).not.toBe(oldPassword);
      expect(updatedUser!.password).not.toBe(newPassword); // Should be hashed
    });
  });
});