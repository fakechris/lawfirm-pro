import { Request, Response } from 'express';
import { UserProfileService } from '../services/UserProfileService';
import { AuditLogModel } from '../models/AuditLogModel';
import { CreateUserProfileRequest } from '../types';

export class UserProfileController {
  /**
   * Get user profile by user ID
   */
  static async getProfileByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const profile = await UserProfileService.getProfileByUserId(userId);
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
        return;
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get full user profile with user details
   */
  static async getFullProfileByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const fullProfile = await UserProfileService.getFullProfileByUserId(userId);
      if (!fullProfile) {
        res.status(404).json({
          success: false,
          error: 'User profile not found',
        });
        return;
      }

      res.json({
        success: true,
        data: fullProfile,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create user profile
   */
  static async createProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const data = req.body as CreateUserProfileRequest;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        // Additional permission check can be added here
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const profile = await UserProfileService.createProfile(userId, data, ipAddress, userAgent);

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Profile created successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const data = req.body as Partial<CreateUserProfileRequest>;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        // Additional permission check can be added here
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const profile = await UserProfileService.updateProfile(userId, data, ipAddress, userAgent);
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
        return;
      }

      res.json({
        success: true,
        data: profile,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Delete user profile
   */
  static async deleteProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        // Additional permission check can be added here
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const success = await UserProfileService.deleteProfile(userId, ipAddress, userAgent);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get profiles by department
   */
  static async getProfilesByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { department } = req.params;

      const profiles = await UserProfileService.getProfilesByDepartment(department);

      res.json({
        success: true,
        data: profiles,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get profiles by specialization
   */
  static async getProfilesBySpecialization(req: Request, res: Response): Promise<void> {
    try {
      const { specialization } = req.params;

      const profiles = await UserProfileService.getProfilesBySpecialization(specialization);

      res.json({
        success: true,
        data: profiles,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get department statistics
   */
  static async getDepartmentStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await UserProfileService.getDepartmentStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get specialization statistics
   */
  static async getSpecializationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await UserProfileService.getSpecializationStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Search users by profile criteria
   */
  static async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const {
        department,
        specialization,
        minYearsOfExperience,
        maxYearsOfExperience,
        licenseNumber,
        isActive,
      } = req.query;

      const result = await UserProfileService.searchUsers({
        department: department as string,
        specialization: specialization as string,
        yearsOfExperience: {
          min: minYearsOfExperience ? parseInt(minYearsOfExperience as string) : undefined,
          max: maxYearsOfExperience ? parseInt(maxYearsOfExperience as string) : undefined,
        },
        licenseNumber: licenseNumber as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
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
   * Get user notification preferences
   */
  static async getNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const preferences = await UserProfileService.getNotificationPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user notification preferences
   */
  static async updateNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { preferences } = req.body;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const profile = await UserProfileService.updateNotificationPreferences(
        userId,
        preferences,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: profile,
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user emergency contact
   */
  static async getEmergencyContact(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const contact = await UserProfileService.getEmergencyContact(userId);
      if (!contact) {
        res.status(404).json({
          success: false,
          error: 'Emergency contact not found',
        });
        return;
      }

      res.json({
        success: true,
        data: contact,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user emergency contact
   */
  static async updateEmergencyContact(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { contact, phone } = req.body;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const profile = await UserProfileService.updateEmergencyContact(
        userId,
        contact,
        phone,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: profile,
        message: 'Emergency contact updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user professional information
   */
  static async getProfessionalInfo(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const info = await UserProfileService.getProfessionalInfo(userId);
      if (!info) {
        res.status(404).json({
          success: false,
          error: 'Professional information not found',
        });
        return;
      }

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user professional information
   */
  static async updateProfessionalInfo(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const data = req.body;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const profile = await UserProfileService.updateProfessionalInfo(
        userId,
        data,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: profile,
        message: 'Professional information updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user contact information
   */
  static async getContactInfo(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const info = await UserProfileService.getContactInfo(userId);
      if (!info) {
        res.status(404).json({
          success: false,
          error: 'Contact information not found',
        });
        return;
      }

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user contact information
   */
  static async updateContactInfo(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const data = req.body;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const result = await UserProfileService.updateContactInfo(
        userId,
        data,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: result,
        message: 'Contact information updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user preferences
   */
  static async getUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const preferences = await UserProfileService.getUserPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update user preferences
   */
  static async updateUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const data = req.body;
      const adminUserId = req.user?.userId;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if user can modify this profile
      if (adminUserId && adminUserId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const profile = await UserProfileService.updateUserPreferences(
        userId,
        data,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: profile,
        message: 'User preferences updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}