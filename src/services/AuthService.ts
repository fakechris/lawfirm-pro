import { UserModel } from '../models/UserModel';
import { SessionModel } from '../models/SessionModel';
import { AuditLogModel } from '../models/AuditLogModel';
import { PermissionService } from './PermissionService';
import { RolePermissionService } from './RolePermissionService';
import { 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest, 
  ChangePasswordRequest,
  CreateUserRequest 
} from '../types';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyToken, 
  comparePassword, 
  hashPassword,
  isValidEmail,
  isValidPassword 
} from '../utils/auth';

export class AuthService {
  /**
   * User login
   */
  static async login(data: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    // Find user by email
    const user = await UserModel.findByEmail(data.email);
    
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials or account deactivated');
    }

    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login time
    await UserModel.updateLastLogin(user.id);

    // Create session
    const session = await SessionModel.create(user.id);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = session.refreshToken;

    // Get user permissions
    const permissions = await PermissionService.getUserPermissions(user.id);

    // Log the login
    await AuditLogModel.create({
      userId: user.id,
      action: 'login',
      resource: 'auth',
      metadata: {
        method: 'email_password',
      },
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user,
      permissions,
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(data: RefreshTokenRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    // Validate session
    const session = await SessionModel.validateSession(data.refreshToken);
    
    if (!session) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get user details
    const user = await UserModel.findById(session.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or account deactivated');
    }

    // Refresh session
    const newSession = await SessionModel.refresh(session.id);
    if (!newSession) {
      throw new Error('Failed to refresh session');
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = newSession.refreshToken;

    // Get user permissions
    const permissions = await PermissionService.getUserPermissions(user.id);

    // Log the token refresh
    await AuditLogModel.create({
      userId: user.id,
      action: 'token_refresh',
      resource: 'auth',
      metadata: {
        sessionId: session.id,
      },
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user,
      permissions,
    };
  }

  /**
   * User logout
   */
  static async logout(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const session = await SessionModel.findByRefreshToken(refreshToken);
    
    if (session) {
      // Delete session
      await SessionModel.deleteByRefreshToken(refreshToken);

      // Log the logout
      await AuditLogModel.create({
        userId: session.userId,
        action: 'logout',
        resource: 'auth',
        metadata: {
          sessionId: session.id,
        },
        ipAddress,
        userAgent,
      });
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(userId: string, ipAddress?: string, userAgent?: string): Promise<number> {
    const sessionCount = await SessionModel.revokeAllUserSessions(userId);

    // Log the logout
    await AuditLogModel.create({
      userId,
      action: 'logout_all',
      resource: 'auth',
      metadata: {
        revokedSessions: sessionCount,
      },
      ipAddress,
      userAgent,
    });

    return sessionCount;
  }

  /**
   * Change password
   */
  static async changePassword(
    userId: string, 
    data: ChangePasswordRequest, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!isValidPassword(data.newPassword)) {
      throw new Error('New password does not meet security requirements');
    }

    // Update password
    await UserModel.changePassword(userId, data.newPassword);

    // Revoke all sessions (force logout from all devices)
    await SessionModel.revokeAllUserSessions(userId);

    // Log the password change
    await AuditLogModel.create({
      userId,
      action: 'password_change',
      resource: 'auth',
      metadata: {
        method: 'user_initiated',
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Reset password (admin initiated)
   */
  static async resetPassword(
    userId: string, 
    newPassword: string, 
    adminUserId: string,
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate new password
    if (!isValidPassword(newPassword)) {
      throw new Error('New password does not meet security requirements');
    }

    // Update password
    await UserModel.changePassword(userId, newPassword);

    // Revoke all sessions
    await SessionModel.revokeAllUserSessions(userId);

    // Log the password reset
    await AuditLogModel.create({
      userId,
      action: 'password_reset',
      resource: 'auth',
      metadata: {
        method: 'admin_initiated',
        adminUserId,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Register new user
   */
  static async register(
    data: CreateUserRequest, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<LoginResponse> {
    // Validate input
    if (!isValidEmail(data.email)) {
      throw new Error('Invalid email address');
    }

    if (!isValidPassword(data.password)) {
      throw new Error('Password does not meet security requirements');
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const existingUsername = await UserModel.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Create user
    const user = await UserModel.create(data);

    // Create session
    const session = await SessionModel.create(user.id);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = session.refreshToken;

    // Get user permissions
    const permissions = await PermissionService.getUserPermissions(user.id);

    // Log the registration
    await AuditLogModel.create({
      userId: user.id,
      action: 'register',
      resource: 'auth',
      metadata: {
        method: 'self_registration',
      },
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user,
      permissions,
    };
  }

  /**
   * Create user (admin initiated)
   */
  static async createUser(
    data: CreateUserRequest, 
    adminUserId: string,
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    // Validate input
    if (!isValidEmail(data.email)) {
      throw new Error('Invalid email address');
    }

    if (!isValidPassword(data.password)) {
      throw new Error('Password does not meet security requirements');
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const existingUsername = await UserModel.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Create user
    const user = await UserModel.create(data);

    // Log the user creation
    await AuditLogModel.create({
      userId: adminUserId,
      action: 'user_create',
      resource: 'users',
      resourceId: user.id,
      metadata: {
        method: 'admin_initiated',
        newUserEmail: user.email,
        newUsername: user.username,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Verify access token
   */
  static async verifyAccessToken(accessToken: string): Promise<any> {
    try {
      return verifyToken(accessToken);
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Get user sessions
   */
  static async getUserSessions(userId: string): Promise<any[]> {
    return SessionModel.getUserActiveSessions(userId);
  }

  /**
   * Revoke specific session
   */
  static async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await SessionModel.findById(sessionId);
    
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or access denied');
    }

    return SessionModel.delete(sessionId);
  }

  /**
   * Initialize authentication system
   */
  static async initialize(): Promise<void> {
    // Create system roles if they don't exist
    await RolePermissionService.initializeSystemRoles();
    
    // Create system permissions if they don't exist
    await RolePermissionService.initializeSystemPermissions();
    
    // Assign default permissions to system roles
    await this.assignDefaultPermissions();
  }

  /**
   * Assign default permissions to system roles
   */
  private static async assignDefaultPermissions(): Promise<void> {
    // Get all permissions
    const allPermissions = await RolePermissionService.getAllPermissions();
    
    // Get system roles
    const systemRoles = await RolePermissionService.getSystemRoles();

    // Assign permissions based on role hierarchy
    for (const role of systemRoles) {
      let rolePermissions: string[] = [];

      switch (role.name) {
        case 'super_admin':
          // Super admin gets all permissions
          rolePermissions = allPermissions.map(p => p.id);
          break;
          
        case 'firm_admin':
          // Firm admin gets most permissions except system-level ones
          rolePermissions = allPermissions
            .filter(p => !p.name.startsWith('system:'))
            .map(p => p.id);
          break;
          
        case 'lead_attorney':
          // Lead attorney gets case, document, and user management permissions
          rolePermissions = allPermissions
            .filter(p => 
              p.resource === 'cases' || 
              p.resource === 'documents' || 
              p.resource === 'users' ||
              p.resource === 'reports'
            )
            .map(p => p.id);
          break;
          
        case 'participating_attorney':
          // Participating attorney gets case and document permissions
          rolePermissions = allPermissions
            .filter(p => 
              (p.resource === 'cases' && p.action !== 'delete') || 
              (p.resource === 'documents' && p.action !== 'delete') ||
              (p.resource === 'reports' && p.action === 'read')
            )
            .map(p => p.id);
          break;
          
        case 'legal_assistant':
          // Legal assistant gets limited permissions
          rolePermissions = allPermissions
            .filter(p => 
              (p.resource === 'cases' && p.action === 'read') || 
              (p.resource === 'documents' && p.action !== 'delete') ||
              (p.resource === 'reports' && p.action === 'read')
            )
            .map(p => p.id);
          break;
          
        case 'administrative_staff':
          // Administrative staff gets minimal permissions
          rolePermissions = allPermissions
            .filter(p => 
              (p.resource === 'cases' && p.action === 'read') || 
              (p.resource === 'documents' && p.action === 'read')
            )
            .map(p => p.id);
          break;
      }

      // Set permissions for the role
      await RolePermissionService.setRolePermissions(role.id, rolePermissions);
    }
  }
}