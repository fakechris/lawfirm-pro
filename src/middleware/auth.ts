import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { Utils } from '../utils';
import { UserRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export class AuthMiddleware {
  static authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Access denied. No token provided.' 
        });
      }

      const decoded = Utils.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
  }

  static authorize(roles: UserRole[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required.' 
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Insufficient permissions.' 
        });
      }

      next();
    };
  }

  static clientOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    return AuthMiddleware.authorize([UserRole.CLIENT])(req, res, next);
  }

  static attorneyOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    return AuthMiddleware.authorize([UserRole.ATTORNEY])(req, res, next);
  }

  static adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    return AuthMiddleware.authorize([UserRole.ADMIN])(req, res, next);
  }

  static clientOrAttorney(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    return AuthMiddleware.authorize([UserRole.CLIENT, UserRole.ATTORNEY])(req, res, next);
  }
}