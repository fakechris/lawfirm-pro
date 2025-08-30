import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { AuthService } from '../services/auth';
import { AuditMiddleware } from '../middleware/audit';
import { LoginRequest, RegisterRequest, AuthResponse, ApiResponse } from '../types';

export class AuthController {
  private authService = container.resolve(AuthService);

  async login(req: Request, res: Response): Promise<void> {
    try {
      const loginRequest: LoginRequest = req.body;
      
      if (!loginRequest.email || !loginRequest.password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        } as ApiResponse<null>);
        return;
      }

      const result: AuthResponse = await this.authService.login(loginRequest);
      
      await AuditMiddleware.createAuditLog(
        req as any,
        'USER_LOGIN',
        'user',
        result.user.id,
        null,
        { email: result.user.email }
      );

      res.json({
        success: true,
        data: result,
        message: 'Login successful',
      } as ApiResponse<AuthResponse>);
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
      } as ApiResponse<null>);
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const registerRequest: RegisterRequest = req.body;
      
      if (!registerRequest.email || !registerRequest.password || 
          !registerRequest.firstName || !registerRequest.lastName || !registerRequest.role) {
        res.status(400).json({
          success: false,
          message: 'All required fields must be provided',
        } as ApiResponse<null>);
        return;
      }

      const result: AuthResponse = await this.authService.register(registerRequest);
      
      await AuditMiddleware.createAuditLog(
        req as any,
        'USER_REGISTER',
        'user',
        result.user.id,
        null,
        { 
          email: result.user.email, 
          role: result.user.role,
          firstName: result.user.firstName,
          lastName: result.user.lastName
        }
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Registration successful',
      } as ApiResponse<AuthResponse>);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
      } as ApiResponse<null>);
    }
  }

  async verify(req: Request, res: Response): Promise<void> {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({
          success: false,
          message: 'No token provided',
        } as ApiResponse<null>);
        return;
      }

      const user = await this.authService.verifyToken(token);
      
      res.json({
        success: true,
        data: user,
        message: 'Token verified',
      } as ApiResponse<any>);
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Token verification failed',
      } as ApiResponse<null>);
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = (req as any).user.id;

      if (!oldPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Old password and new password are required',
        } as ApiResponse<null>);
        return;
      }

      await this.authService.changePassword(userId, oldPassword, newPassword);
      
      await AuditMiddleware.createAuditLog(
        req as any,
        'PASSWORD_CHANGE',
        'user',
        userId,
        null,
        { action: 'password_changed' }
      );

      res.json({
        success: true,
        message: 'Password changed successfully',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('Password change error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password change failed',
      } as ApiResponse<null>);
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const updates = req.body;
      const userId = (req as any).user.id;

      const user = await this.authService.updateProfile(userId, updates);
      
      await AuditMiddleware.createAuditLog(
        req as any,
        'PROFILE_UPDATE',
        'user',
        userId,
        null,
        updates
      );

      res.json({
        success: true,
        data: user,
        message: 'Profile updated successfully',
      } as ApiResponse<any>);
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Profile update failed',
      } as ApiResponse<null>);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      
      await AuditMiddleware.createAuditLog(
        req as any,
        'USER_LOGOUT',
        'user',
        userId,
        null,
        { action: 'logout' }
      );

      res.json({
        success: true,
        message: 'Logout successful',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
      } as ApiResponse<null>);
    }
  }
}