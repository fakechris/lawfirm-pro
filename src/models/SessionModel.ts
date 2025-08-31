import { prisma } from '../utils/database';
import { Session } from '../types';
import { generateRandomString } from '../utils/auth';

export class SessionModel {
  static async create(userId: string): Promise<Session> {
    const refreshToken = generateRandomString(64);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    const session = await prisma.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });

    return session;
  }

  static async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });
  }

  static async findById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });
  }

  static async findByUserId(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async delete(id: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async deleteByRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { refreshToken },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async deleteByUserId(userId: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  static async refresh(sessionId: string): Promise<Session | null> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.delete(sessionId);
      return null;
    }

    // Generate new refresh token and extend expiration
    const newRefreshToken = generateRandomString(64);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });

    return updatedSession;
  }

  static async cleanup(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  static async validateSession(refreshToken: string): Promise<Session | null> {
    const session = await this.findByRefreshToken(refreshToken);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.deleteByRefreshToken(refreshToken);
      return null;
    }

    // Check if user is still active
    if (!session.user.isActive) {
      await this.deleteByRefreshToken(refreshToken);
      return null;
    }

    return session;
  }

  static async getUserActiveSessions(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  }
}