import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { CaseService } from '../services/case';
import { AuditMiddleware } from '../middleware/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { ApiResponse, CaseResponse, ClientDashboard, AttorneyDashboard, CreateCaseRequest } from '../types';

export class CaseController {
  private caseService = container.resolve(CaseService);

  async createCase(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const caseRequest: CreateCaseRequest = req.body;

      if (!caseRequest.title || !caseRequest.caseType || !caseRequest.clientId) {
        res.status(400).json({
          success: false,
          message: 'Title, case type, and client ID are required',
        } as ApiResponse<null>);
        return;
      }

      const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
        where: { userId }
      });

      if (!attorneyProfile) {
        res.status(404).json({
          success: false,
          message: 'Attorney profile not found',
        } as ApiResponse<null>);
        return;
      }

      const result: CaseResponse = await this.caseService.createCase(caseRequest, attorneyProfile.id);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'CASE_CREATE',
        'case',
        result.id,
        null,
        { 
          title: result.title, 
          caseType: result.caseType,
          clientId: result.clientId 
        }
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Case created successfully',
      } as ApiResponse<CaseResponse>);
    } catch (error) {
      console.error('Create case error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create case',
      } as ApiResponse<null>);
    }
  }

  async getClientCases(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      if (userRole !== UserRole.CLIENT) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Client access required.',
        } as ApiResponse<null>);
        return;
      }

      const clientProfile = await this.caseService['db'].client.clientProfile.findUnique({
        where: { userId }
      });

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: 'Client profile not found',
        } as ApiResponse<null>);
        return;
      }

      const cases: CaseResponse[] = await this.caseService.getCasesByClientId(clientProfile.id);

      res.json({
        success: true,
        data: cases,
        message: 'Cases retrieved successfully',
      } as ApiResponse<CaseResponse[]>);
    } catch (error) {
      console.error('Get client cases error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve cases',
      } as ApiResponse<null>);
    }
  }

  async getAttorneyCases(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      if (userRole !== UserRole.ATTORNEY) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Attorney access required.',
        } as ApiResponse<null>);
        return;
      }

      const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
        where: { userId }
      });

      if (!attorneyProfile) {
        res.status(404).json({
          success: false,
          message: 'Attorney profile not found',
        } as ApiResponse<null>);
        return;
      }

      const cases: CaseResponse[] = await this.caseService.getCasesByAttorneyId(attorneyProfile.id);

      res.json({
        success: true,
        data: cases,
        message: 'Cases retrieved successfully',
      } as ApiResponse<CaseResponse[]>);
    } catch (error) {
      console.error('Get attorney cases error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve cases',
      } as ApiResponse<null>);
    }
  }

  async getCaseById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      const caseResponse: CaseResponse = await this.caseService.getCaseById(id, userId, userRole);

      res.json({
        success: true,
        data: caseResponse,
        message: 'Case retrieved successfully',
      } as ApiResponse<CaseResponse>);
    } catch (error) {
      console.error('Get case error:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Case not found',
      } as ApiResponse<null>);
    }
  }

  async updateCaseStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Status is required',
        } as ApiResponse<null>);
        return;
      }

      const oldCase = await this.caseService['db'].client.case.findUnique({
        where: { id },
        select: { status: true }
      });

      const result: CaseResponse = await this.caseService.updateCaseStatus(id, status, userId, userRole);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'CASE_STATUS_UPDATE',
        'case',
        id,
        { status: oldCase?.status },
        { status: result.status }
      );

      res.json({
        success: true,
        data: result,
        message: 'Case status updated successfully',
      } as ApiResponse<CaseResponse>);
    } catch (error) {
      console.error('Update case status error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update case status',
      } as ApiResponse<null>);
    }
  }

  async updateCasePhase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { phase } = req.body;
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      if (!phase) {
        res.status(400).json({
          success: false,
          message: 'Phase is required',
        } as ApiResponse<null>);
        return;
      }

      const oldCase = await this.caseService['db'].client.case.findUnique({
        where: { id },
        select: { phase: true }
      });

      const result: CaseResponse = await this.caseService.updateCasePhase(id, phase, userId, userRole);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'CASE_PHASE_UPDATE',
        'case',
        id,
        { phase: oldCase?.phase },
        { phase: result.phase }
      );

      res.json({
        success: true,
        data: result,
        message: 'Case phase updated successfully',
      } as ApiResponse<CaseResponse>);
    } catch (error) {
      console.error('Update case phase error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update case phase',
      } as ApiResponse<null>);
    }
  }

  async getClientDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      if (userRole !== UserRole.CLIENT) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Client access required.',
        } as ApiResponse<null>);
        return;
      }

      const clientProfile = await this.caseService['db'].client.clientProfile.findUnique({
        where: { userId }
      });

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: 'Client profile not found',
        } as ApiResponse<null>);
        return;
      }

      const dashboard: ClientDashboard = await this.caseService.getClientDashboard(clientProfile.id);

      res.json({
        success: true,
        data: dashboard,
        message: 'Client dashboard retrieved successfully',
      } as ApiResponse<ClientDashboard>);
    } catch (error) {
      console.error('Get client dashboard error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve client dashboard',
      } as ApiResponse<null>);
    }
  }

  async getAttorneyDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      if (userRole !== UserRole.ATTORNEY) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Attorney access required.',
        } as ApiResponse<null>);
        return;
      }

      const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
        where: { userId }
      });

      if (!attorneyProfile) {
        res.status(404).json({
          success: false,
          message: 'Attorney profile not found',
        } as ApiResponse<null>);
        return;
      }

      const dashboard: AttorneyDashboard = await this.caseService.getAttorneyDashboard(attorneyProfile.id);

      res.json({
        success: true,
        data: dashboard,
        message: 'Attorney dashboard retrieved successfully',
      } as ApiResponse<AttorneyDashboard>);
    } catch (error) {
      console.error('Get attorney dashboard error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve attorney dashboard',
      } as ApiResponse<null>);
    }
  }

  async getCaseStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const userRole = (req as AuthenticatedRequest).user!.role;

      let stats;
      
      if (userRole === UserRole.CLIENT) {
        const clientProfile = await this.caseService['db'].client.clientProfile.findUnique({
          where: { userId }
        });

        if (!clientProfile) {
          res.status(404).json({
            success: false,
            message: 'Client profile not found',
          } as ApiResponse<null>);
          return;
        }

        stats = await this.getClientCaseStats(clientProfile.id);
      } else if (userRole === UserRole.ATTORNEY) {
        const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
          where: { userId }
        });

        if (!attorneyProfile) {
          res.status(404).json({
            success: false,
            message: 'Attorney profile not found',
          } as ApiResponse<null>);
          return;
        }

        stats = await this.getAttorneyCaseStats(attorneyProfile.id);
      } else {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        data: stats,
        message: 'Case statistics retrieved successfully',
      } as ApiResponse<any>);
    } catch (error) {
      console.error('Get case stats error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve case statistics',
      } as ApiResponse<null>);
    }
  }

  private async getClientCaseStats(clientId: string) {
    const cases = await this.caseService['db'].client.case.findMany({
      where: { clientId },
    });

    const stats = {
      total: cases.length,
      active: cases.filter(c => c.status === 'ACTIVE').length,
      pending: cases.filter(c => c.status === 'PENDING').length,
      completed: cases.filter(c => c.status === 'COMPLETED').length,
      closed: cases.filter(c => c.status === 'CLOSED').length,
      byType: {} as Record<string, number>,
      byPhase: {} as Record<string, number>,
    };

    cases.forEach(caseItem => {
      stats.byType[caseItem.caseType] = (stats.byType[caseItem.caseType] || 0) + 1;
      stats.byPhase[caseItem.phase] = (stats.byPhase[caseItem.phase] || 0) + 1;
    });

    return stats;
  }

  private async getAttorneyCaseStats(attorneyId: string) {
    const cases = await this.caseService['db'].client.case.findMany({
      where: { attorneyId },
    });

    const stats = {
      total: cases.length,
      active: cases.filter(c => c.status === 'ACTIVE').length,
      pending: cases.filter(c => c.status === 'PENDING').length,
      completed: cases.filter(c => c.status === 'COMPLETED').length,
      closed: cases.filter(c => c.status === 'CLOSED').length,
      byType: {} as Record<string, number>,
      byPhase: {} as Record<string, number>,
    };

    cases.forEach(caseItem => {
      stats.byType[caseItem.caseType] = (stats.byType[caseItem.caseType] || 0) + 1;
      stats.byPhase[caseItem.phase] = (stats.byPhase[caseItem.phase] || 0) + 1;
    });

    return stats;
  }
}