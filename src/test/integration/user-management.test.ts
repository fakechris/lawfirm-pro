import request from 'supertest';
import app from '../app';
import { AuthService } from '../services/AuthService';
import { RolePermissionService } from '../services/RolePermissionService';

describe('User Management API Integration Tests', () => {
  let adminToken: string;
  let userToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize system
    await AuthService.initialize();
  });

  describe('Authentication Endpoints', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'integration@example.com',
        username: 'integration',
        password: 'Integration123!',
        firstName: 'Integration',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      userToken = response.body.data.accessToken;
      testUserId = response.body.data.user.id;
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'integration@example.com',
        password: 'Integration123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should fail login with invalid credentials', async () => {
      const loginData = {
        email: 'integration@example.com',
        password: 'wrongpassword',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should refresh access token', async () => {
      // First login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration@example.com',
          password: 'Integration123!',
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should get current user', async () => {
      const response = await request(app)
        .get('/api/auth/current-user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('integration@example.com');
    });

    it('should require authentication for protected endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/current-user')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Management Endpoints', () => {
    beforeAll(async () => {
      // Create admin user and get token
      const adminData = {
        email: 'admin@example.com',
        username: 'admin',
        password: 'Admin123!',
        firstName: 'Admin',
        lastName: 'User',
      };

      await request(app)
        .post('/api/auth/register')
        .send(adminData);

      const adminResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Admin123!',
        });

      adminToken = adminResponse.body.data.accessToken;

      // Assign admin role to admin user
      const roles = await RolePermissionService.getAllRoles();
      const adminRole = roles.find(r => r.name === 'super_admin');
      
      if (adminRole) {
        // This would normally be done through the API, but for testing we'll do it directly
        const { PermissionService } = await import('../services/PermissionService');
        await PermissionService.addUserRole(
          adminResponse.body.data.user.id, 
          adminRole.id
        );
      }
    });

    it('should get all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    it('should get user by ID', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
    });

    it('should create new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'NewUser123!',
        firstName: 'New',
        lastName: 'User',
        phone: '+8613800138000',
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userData.email);
    });

    it('should update user', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'User',
        phone: '+8613900139000',
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(updateData.firstName);
    });

    it('should require permissions for user management', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Role and Permission Endpoints', () => {
    it('should get all roles', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get all permissions', async () => {
      const response = await request(app)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get role hierarchy', async () => {
      const response = await request(app)
        .get('/api/roles/hierarchy')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Profile Management Endpoints', () => {
    it('should create user profile', async () => {
      const profileData = {
        title: 'Software Engineer',
        department: 'IT',
        specialization: 'Backend Development',
        licenseNumber: 'LICENSE123',
        yearsOfExperience: 5,
        bio: 'Experienced backend developer',
        address: '123 Tech Street',
        city: 'Shanghai',
        province: 'Shanghai',
        country: 'China',
        postalCode: '200000',
        emergencyContact: 'Jane Doe',
        emergencyPhone: '+8613600136000',
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        notifications: {
          email: true,
          sms: false,
        },
      };

      const response = await request(app)
        .post(`/api/profiles/users/${testUserId}/profile`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(profileData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(profileData.title);
      expect(response.body.data.department).toBe(profileData.department);
    });

    it('should get user profile', async () => {
      const response = await request(app)
        .get(`/api/profiles/users/${testUserId}/profile`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should update user profile', async () => {
      const updateData = {
        title: 'Senior Software Engineer',
        yearsOfExperience: 6,
      };

      const response = await request(app)
        .put(`/api/profiles/users/${testUserId}/profile`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.yearsOfExperience).toBe(updateData.yearsOfExperience);
    });

    it('should get user directory', async () => {
      const response = await request(app)
        .get('/api/profiles/directory')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(response.body.data.total).toBeDefined();
    });
  });

  describe('Audit Log Endpoints', () => {
    it('should get audit logs', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.auditLogs).toBeDefined();
      expect(Array.isArray(response.body.data.auditLogs)).toBe(true);
    });

    it('should get audit dashboard', async () => {
      const response = await request(app)
        .get('/api/audit/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.actions).toBeDefined();
      expect(response.body.data.resources).toBeDefined();
      expect(response.body.data.users).toBeDefined();
    });

    it('should require audit permissions', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          username: '',
          password: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Law Firm Pro API is running');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});