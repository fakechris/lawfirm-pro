import { UserProfileModel } from '../models/UserProfileModel';
import { UserModel } from '../models/UserModel';
import { AuditLogModel } from '../models/AuditLogModel';
import { PermissionService } from './PermissionService';
import { UserProfile, CreateUserProfileRequest } from '../types';

export class UserProfileService {
  /**
   * Create user profile
   */
  static async createProfile(
    userId: string, 
    data: CreateUserProfileRequest, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<UserProfile> {
    // Check if user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if profile already exists
    const existingProfile = await UserProfileModel.findByUserId(userId);
    if (existingProfile) {
      throw new Error('User profile already exists');
    }

    // Create profile
    const profile = await UserProfileModel.create({
      userId,
      ...data,
    });

    // Log the profile creation
    await AuditLogModel.create({
      userId,
      action: 'profile_create',
      resource: 'user_profiles',
      resourceId: profile.id,
      metadata: {
        fields: Object.keys(data),
      },
      ipAddress,
      userAgent,
    });

    return profile;
  }

  /**
   * Get user profile by user ID
   */
  static async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    return UserProfileModel.findByUserId(userId);
  }

  /**
   * Get user profile with user details
   */
  static async getFullProfileByUserId(userId: string): Promise<{ user: any; profile: UserProfile | null } | null> {
    const user = await UserModel.findById(userId);
    if (!user) {
      return null;
    }

    const profile = await UserProfileModel.findByUserId(userId);

    return {
      user,
      profile,
    };
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    userId: string, 
    data: Partial<CreateUserProfileRequest>, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<UserProfile | null> {
    // Check if user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update profile
    const profile = await UserProfileModel.update(userId, data);
    
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Log the profile update
    await AuditLogModel.create({
      userId,
      action: 'profile_update',
      resource: 'user_profiles',
      resourceId: profile.id,
      metadata: {
        updatedFields: Object.keys(data),
      },
      ipAddress,
      userAgent,
    });

    return profile;
  }

  /**
   * Delete user profile
   */
  static async deleteProfile(
    userId: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<boolean> {
    // Check if user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get profile before deletion
    const profile = await UserProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Delete profile
    const success = await UserProfileModel.delete(userId);
    
    if (success) {
      // Log the profile deletion
      await AuditLogModel.create({
        userId,
        action: 'profile_delete',
        resource: 'user_profiles',
        resourceId: profile.id,
        ipAddress,
        userAgent,
      });
    }

    return success;
  }

  /**
   * Get profiles by department
   */
  static async getProfilesByDepartment(department: string): Promise<UserProfile[]> {
    return UserProfileModel.findByDepartment(department);
  }

  /**
   * Get profiles by specialization
   */
  static async getProfilesBySpecialization(specialization: string): Promise<UserProfile[]> {
    return UserProfileModel.findBySpecialization(specialization);
  }

  /**
   * Get department statistics
   */
  static async getDepartmentStats(): Promise<{ department: string; count: number }[]> {
    return UserProfileModel.getDepartmentStats();
  }

  /**
   * Get specialization statistics
   */
  static async getSpecializationStats(): Promise<{ specialization: string; count: number }[]> {
    return UserProfileModel.getSpecializationStats();
  }

  /**
   * Search users by profile criteria
   */
  static async searchUsers(filters: {
    department?: string;
    specialization?: string;
    yearsOfExperience?: { min?: number; max?: number };
    licenseNumber?: string;
    isActive?: boolean;
  }): Promise<{ users: any[]; total: number }> {
    // Build search criteria
    const where: any = {};
    
    if (filters.department) {
      where.profile = {
        ...where.profile,
        department: filters.department,
      };
    }
    
    if (filters.specialization) {
      where.profile = {
        ...where.profile,
        specialization: filters.specialization,
      };
    }
    
    if (filters.yearsOfExperience) {
      where.profile = {
        ...where.profile,
        yearsOfExperience: {},
      };
      
      if (filters.yearsOfExperience.min !== undefined) {
        where.profile.yearsOfExperience.gte = filters.yearsOfExperience.min;
      }
      
      if (filters.yearsOfExperience.max !== undefined) {
        where.profile.yearsOfExperience.lte = filters.yearsOfExperience.max;
      }
    }
    
    if (filters.licenseNumber) {
      where.profile = {
        ...where.profile,
        licenseNumber: { contains: filters.licenseNumber, mode: 'insensitive' },
      };
    }
    
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Get users with filters
    const result = await UserModel.findAll(1, 1000, filters);
    
    return {
      users: result.users,
      total: result.total,
    };
  }

  /**
   * Get user directory with advanced filtering
   */
  static async getUserDirectory(params: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    specialization?: string;
    isActive?: boolean;
    sortBy?: 'name' | 'email' | 'department' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      department,
      specialization,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    // Build search filters
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (department) {
      where.profile = {
        ...where.profile,
        department,
      };
    }
    
    if (specialization) {
      where.profile = {
        ...where.profile,
        specialization,
      };
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count
    const total = await UserModel.findAll(1, 1000, { 
      search, 
      department, 
      isActive 
    }).then(result => result.total);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    // Get users with pagination and sorting
    const result = await UserModel.findAll(page, limit, { 
      search, 
      department, 
      isActive 
    });

    // Apply additional sorting (this is a simplified version)
    let users = result.users;
    
    if (sortBy === 'name') {
      users.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    } else if (sortBy === 'email') {
      users.sort((a, b) => {
        return sortOrder === 'asc' 
          ? a.email.localeCompare(b.email) 
          : b.email.localeCompare(a.email);
      });
    }

    return {
      users,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Update user notification preferences
   */
  static async updateNotificationPreferences(
    userId: string, 
    preferences: Record<string, any>, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<UserProfile | null> {
    const profile = await UserProfileModel.findByUserId(userId);
    
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Merge with existing preferences
    const updatedPreferences = {
      ...profile.notifications,
      ...preferences,
    };

    return this.updateProfile(userId, { notifications: updatedPreferences }, ipAddress, userAgent);
  }

  /**
   * Get user notification preferences
   */
  static async getNotificationPreferences(userId: string): Promise<Record<string, any>> {
    const profile = await UserProfileModel.findByUserId(userId);
    
    if (!profile) {
      return {};
    }

    return profile.notifications || {};
  }

  /**
   * Get user emergency contact information
   */
  static async getEmergencyContact(userId: string): Promise<{ contact: string; phone: string } | null> {
    const profile = await UserProfileModel.findByUserId(userId);
    
    if (!profile || !profile.emergencyContact || !profile.emergencyPhone) {
      return null;
    }

    return {
      contact: profile.emergencyContact,
      phone: profile.emergencyPhone,
    };
  }

  /**
   * Update user emergency contact
   */
  static async updateEmergencyContact(
    userId: string, 
    contact: string, 
    phone: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<UserProfile | null> {
    return this.updateProfile(userId, { 
      emergencyContact: contact, 
      emergencyPhone: phone 
    }, ipAddress, userAgent);
  }

  /**
   * Get user professional information
   */
  static async getProfessionalInfo(userId: string): Promise<{
    title?: string;
    department?: string;
    specialization?: string;
    licenseNumber?: string;
    yearsOfExperience?: number;
    bio?: string;
  } | null> {
    const profile = await UserProfileModel.findByUserId(userId);
    
    if (!profile) {
      return null;
    }

    return {
      title: profile.title,
      department: profile.department,
      specialization: profile.specialization,
      licenseNumber: profile.licenseNumber,
      yearsOfExperience: profile.yearsOfExperience,
      bio: profile.bio,
    };
  }

  /**
   * Update user professional information
   */
  static async updateProfessionalInfo(
    userId: string, 
    data: {
      title?: string;
      department?: string;
      specialization?: string;
      licenseNumber?: string;
      yearsOfExperience?: number;
      bio?: string;
    }, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<UserProfile | null> {
    return this.updateProfile(userId, data, ipAddress, userAgent);
  }

  /**
   * Get user contact information
   */
  static async getContactInfo(userId: string): Promise<{
    address?: string;
    city?: string;
    province?: string;
    country?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
  } | null> {
    const user = await UserModel.findById(userId);
    const profile = await UserProfileModel.findByUserId(userId);
    
    if (!user) {
      return null;
    }

    return {
      address: profile?.address,
      city: profile?.city,
      province: profile?.province,
      country: profile?.country,
      postalCode: profile?.postalCode,
      phone: user.phone,
      email: user.email,
    };
  }

  /**
   * Update user contact information
   */
  static async updateContactInfo(
    userId: string, 
    data: {
      address?: string;
      city?: string;
      province?: string;
      country?: string;
      postalCode?: string;
      phone?: string;
    }, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<{ user: any; profile: UserProfile | null }> {
    // Update user phone if provided
    if (data.phone) {
      await UserModel.update(userId, { phone: data.phone });
    }

    // Update profile contact information
    const profile = await this.updateProfile(userId, {
      address: data.address,
      city: data.city,
      province: data.province,
      country: data.country,
      postalCode: data.postalCode,
    }, ipAddress, userAgent);

    const user = await UserModel.findById(userId);

    return {
      user: user!,
      profile,
    };
  }

  /**
   * Get user preferences
   */
  static async getUserPreferences(userId: string): Promise<{
    language: string;
    timezone: string;
    notifications: Record<string, any>;
  }> {
    const profile = await UserProfileModel.findByUserId(userId);
    
    if (!profile) {
      return {
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        notifications: {},
      };
    }

    return {
      language: profile.language,
      timezone: profile.timezone,
      notifications: profile.notifications || {},
    };
  }

  /**
   * Update user preferences
   */
  static async updateUserPreferences(
    userId: string, 
    preferences: {
      language?: string;
      timezone?: string;
      notifications?: Record<string, any>;
    }, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<UserProfile | null> {
    return this.updateProfile(userId, preferences, ipAddress, userAgent);
  }
}