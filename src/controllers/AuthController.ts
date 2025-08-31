import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { UserModel } from '../models/UserModel';
import { LoginRequest, RefreshTokenRequest, ChangePasswordRequest, CreateUserRequest } from '../types';

export class AuthController {
  /**
   * User login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as LoginRequest;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await AuthService.login({ email, password }, ipAddress, userAgent);

      res.json({
        success: true,
        data: result,
        message: 'Login successful',
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenRequest;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await AuthService.refreshToken({ refreshToken }, ipAddress, userAgent);

      res.json({
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * User logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await AuthService.logout(refreshToken, ipAddress, userAgent);

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const sessionCount = await AuthService.logoutAll(userId, ipAddress, userAgent);

      res.json({
        success: true,
        data: { revokedSessions: sessionCount },
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { currentPassword, newPassword } = req.body as ChangePasswordRequest;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await AuthService.changePassword(userId, { currentPassword, newPassword }, ipAddress, userAgent);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Reset password (admin)
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { userId, newPassword } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await AuthService.resetPassword(userId, newPassword, adminUserId, ipAddress, userAgent);

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * User registration
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as CreateUserRequest;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await AuthService.register(data, ipAddress, userAgent);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Registration successful',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create user (admin)
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

      const data = req.body as CreateUserRequest;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await AuthService.createUser(data, adminUserId, ipAddress, userAgent);

      res.status(201).json({
        success: true,
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
   * Get current user info
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await UserModel.findById(userId);
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
   * Get user sessions
   */
  static async getUserSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const sessions = await AuthService.getUserSessions(userId);

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Revoke session
   */
  static async revokeSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { sessionId } = req.params;

      const success = await AuthService.revokeSession(sessionId, userId);
      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to revoke session',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Verify token
   */
  static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      const decoded = await AuthService.verifyAccessToken(token);

      res.json({
        success: true,
        data: decoded,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Initialize authentication system
   */
  static async initialize(req: Request, res: Response): Promise<void> {
    try {
      await AuthService.initialize();

      res.json({
        success: true,
        message: 'Authentication system initialized successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}