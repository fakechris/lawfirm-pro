import { injectable, inject } from 'tsyringe';
import { Database } from '../utils/database';
import { Utils } from '../utils';
import { UserRole } from '@prisma/client';
import { LoginRequest, RegisterRequest, AuthResponse, UserResponse } from '../types';

@injectable()
export class AuthService {
  constructor(@inject(Database) private db: Database) {}

  async login(loginRequest: LoginRequest): Promise<AuthResponse> {
    const { email, password } = loginRequest;

    const user = await this.db.client.user.findUnique({
      where: { email },
      include: {
        clientProfile: true,
        attorneyProfile: true,
      },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await Utils.comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = Utils.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const userResponse: UserResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      token,
      user: userResponse,
    };
  }

  async register(registerRequest: RegisterRequest): Promise<AuthResponse> {
    const { email, password, firstName, lastName, role, phone, address, company } = registerRequest;

    const existingUser = await this.db.client.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordValidation = Utils.validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    if (!Utils.validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    const hashedPassword = await Utils.hashPassword(password);

    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
    };

    const user = await this.db.client.user.create({
      data: userData,
    });

    if (role === UserRole.CLIENT) {
      await this.db.client.clientProfile.create({
        data: {
          userId: user.id,
          phone,
          address,
          company,
        },
      });
    } else if (role === UserRole.ATTORNEY) {
      throw new Error('Attorney registration requires additional information');
    }

    const token = Utils.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const userResponse: UserResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      token,
      user: userResponse,
    };
  }

  async verifyToken(token: string): Promise<UserResponse> {
    const decoded = Utils.verifyToken(token);
    
    const user = await this.db.client.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isOldPasswordValid = await Utils.comparePassword(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new Error('Invalid old password');
    }

    const passwordValidation = Utils.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    const hashedNewPassword = await Utils.hashPassword(newPassword);

    await this.db.client.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }

  async updateProfile(userId: string, updates: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    company: string;
  }>): Promise<UserResponse> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = await this.db.client.user.update({
      where: { id: userId },
      data: {
        firstName: updates.firstName,
        lastName: updates.lastName,
      },
    });

    if (user.clientProfile && (updates.phone || updates.address || updates.company)) {
      await this.db.client.clientProfile.update({
        where: { userId },
        data: {
          phone: updates.phone,
          address: updates.address,
          company: updates.company,
        },
      });
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }
}