import { BaseExternalService } from '../../services/external/BaseExternalService';
import { CourtIntegration } from '../../services/external';
import {
  LegalDocument,
  FilingResult,
  CaseStatus,
  Hearing,
  HearingResult,
  CourtInfo
} from '../../services/external/types';

export class PACERService extends BaseExternalService implements CourtIntegration {

  constructor() {
    super('pacer');
  }

  async fileDocument(document: LegalDocument): Promise<FilingResult> {
    try {
      this.logRequest('POST', '/documents/file', { documentId: document.id });

      // PACER CM/ECF filing process
      const filingData = {
        court: document.metadata.court.courtCode,
        caseId: document.caseId,
        documentType: document.documentType,
        title: document.title,
        content: document.content,
        parties: document.parties.map(p => ({
          name: p.name,
          role: p.role,
          address: p.address
        })),
        attorneys: document.attorneys.map(a => ({
          name: a.name,
          barNumber: a.barNumber,
          firm: a.firm,
          email: a.contact.email
        })),
        metadata: {
          confidential: document.metadata.confidential,
          tags: document.metadata.tags,
          docketNumber: document.metadata.docketNumber
        }
      };

      const response = await this.makeRequest<any>('/documents/file', {
        method: 'POST',
        body: JSON.stringify(filingData)
      });

      const result: FilingResult = {
        success: response.success,
        docketNumber: response.docketNumber,
        filingDate: new Date(response.filingDate),
        receiptNumber: response.receiptNumber,
        fees: response.fees,
        errors: response.errors,
        warnings: response.warnings
      };

      this.logResponse('POST', '/documents/file', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/documents/file', error, Date.now());
      return {
        success: false,
        filingDate: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async checkStatus(caseId: string): Promise<CaseStatus> {
    try {
      this.logRequest('GET', `/cases/${caseId}/status`);

      const response = await this.makeRequest<any>(`/cases/${caseId}/status`);

      const result: CaseStatus = {
        caseId: response.caseId,
        docketNumber: response.docketNumber,
        status: response.status,
        lastUpdated: new Date(response.lastUpdated),
        ...(response.nextHearing && { nextHearing: new Date(response.nextHearing) }),
        ...(response.judge && { judge: response.judge }),
        assignedAttorneys: response.assignedAttorneys.map((a: any) => ({
          name: a.name,
          barNumber: a.barNumber,
          firm: a.firm,
          contact: a.contact
        })),
        documents: response.documents.map((d: any) => this.mapDocument(d)),
        timeline: response.timeline.map((e: any) => ({
          date: new Date(e.date),
          description: e.description,
          eventType: e.eventType,
          filedBy: e.filedBy,
          documentId: e.documentId
        }))
      };

      this.logResponse('GET', `/cases/${caseId}/status`, result, Date.now());
      return result;

    } catch (error) {
      this.logError('GET', `/cases/${caseId}/status`, error, Date.now());
      throw error;
    }
  }

  async retrieveDocuments(caseId: string): Promise<LegalDocument[]> {
    try {
      this.logRequest('GET', `/cases/${caseId}/documents`);

      const response = await this.makeRequest<any[]>(`/cases/${caseId}/documents`);

      const documents = response.map(doc => this.mapDocument(doc));

      this.logResponse('GET', `/cases/${caseId}/documents`, { count: documents.length }, Date.now());
      return documents;

    } catch (error) {
      this.logError('GET', `/cases/${caseId}/documents`, error, Date.now());
      throw error;
    }
  }

  async scheduleHearing(caseId: string, hearing: Hearing): Promise<HearingResult> {
    try {
      this.logRequest('POST', `/cases/${caseId}/hearings`, { hearing });

      const hearingData = {
        date: hearing.date.toISOString(),
        time: hearing.time,
        type: hearing.type,
        location: hearing.location,
        judge: hearing.judge,
        purpose: hearing.purpose,
        duration: hearing.duration,
        virtual: hearing.virtual,
        participants: hearing.participants
      };

      const response = await this.makeRequest<any>(`/cases/${caseId}/hearings`, {
        method: 'POST',
        body: JSON.stringify(hearingData)
      });

      const result: HearingResult = {
        success: response.success,
        hearingId: response.hearingId,
        scheduledDate: new Date(response.scheduledDate),
        confirmationNumber: response.confirmationNumber,
        instructions: response.instructions,
        errors: response.errors
      };

      this.logResponse('POST', `/cases/${caseId}/hearings`, result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', `/cases/${caseId}/hearings`, error, Date.now());
      return {
        success: false,
        scheduledDate: hearing.date,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Additional PACER-specific methods
  async searchCases(query: {
    court?: string;
    caseTitle?: string;
    caseNumber?: string;
    filedAfter?: Date;
    filedBefore?: Date;
    partyName?: string;
    attorneyName?: string;
  }): Promise<CaseStatus[]> {
    try {
      this.logRequest('GET', '/cases/search', { query });

      const params = new URLSearchParams();
      if (query.court) params.append('court', query.court);
      if (query.caseTitle) params.append('caseTitle', query.caseTitle);
      if (query.caseNumber) params.append('caseNumber', query.caseNumber);
      if (query.filedAfter) params.append('filedAfter', query.filedAfter.toISOString());
      if (query.filedBefore) params.append('filedBefore', query.filedBefore.toISOString());
      if (query.partyName) params.append('partyName', query.partyName);
      if (query.attorneyName) params.append('attorneyName', query.attorneyName);

      const response = await this.makeRequest<any[]>(`/cases/search?${params.toString()}`);

      const cases = response.map(c => ({
        caseId: c.caseId,
        docketNumber: c.docketNumber,
        status: c.status,
        lastUpdated: new Date(c.lastUpdated),
        ...(c.nextHearing && { nextHearing: new Date(c.nextHearing) }),
        ...(c.judge && { judge: c.judge }),
        assignedAttorneys: c.assignedAttorneys || [],
        documents: c.documents || [],
        timeline: c.timeline || []
      }));

      this.logResponse('GET', '/cases/search', { count: cases.length }, Date.now());
      return cases;

    } catch (error) {
      this.logError('GET', '/cases/search', error, Date.now());
      throw error;
    }
  }

  async getDocketReport(caseId: string): Promise<string> {
    try {
      this.logRequest('GET', `/cases/${caseId}/docket`);

      const response = await this.makeRequest<string>(`/cases/${caseId}/docket`);

      this.logResponse('GET', `/cases/${caseId}/docket`, { length: response.length }, Date.now());
      return response;

    } catch (error) {
      this.logError('GET', `/cases/${caseId}/docket`, error, Date.now());
      throw error;
    }
  }

  async getAvailableCourts(): Promise<CourtInfo[]> {
    try {
      this.logRequest('GET', '/courts');

      const response = await this.makeRequest<any[]>('/courts');

      const courts = response.map(c => ({
        name: c.name,
        jurisdiction: c.jurisdiction,
        level: c.level,
        location: c.location,
        courtCode: c.courtCode
      }));

      this.logResponse('GET', '/courts', { count: courts.length }, Date.now());
      return courts;

    } catch (error) {
      this.logError('GET', '/courts', error, Date.now());
      throw error;
    }
  }

  override async testConnection(): Promise<boolean> {
    try {
      await this.getAvailableCourts();
      return true;
    } catch (error) {
      this.logger.error('PACER connection test failed', { error });
      return false;
    }
  }

  private mapDocument(doc: any): LegalDocument {
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      documentType: doc.documentType,
      ...(doc.filingDate && { filingDate: new Date(doc.filingDate) }),
      ...(doc.caseId && { caseId: doc.caseId }),
      parties: doc.parties?.map((p: any) => ({
        name: p.name,
        role: p.role,
        address: p.address,
        contact: p.contact
      })) || [],
      attorneys: doc.attorneys?.map((a: any) => ({
        name: a.name,
        barNumber: a.barNumber,
        firm: a.firm,
        contact: a.contact,
        representing: a.representing
      })) || [],
      metadata: {
        pageCount: doc.metadata?.pageCount || 0,
        fileSize: doc.metadata?.fileSize || 0,
        format: doc.metadata?.format || 'pdf',
        docketNumber: doc.metadata?.docketNumber,
        court: doc.metadata?.court || {
          name: '',
          jurisdiction: '',
          level: 'federal',
          location: '',
          courtCode: ''
        },
        tags: doc.metadata?.tags || [],
        confidential: doc.metadata?.confidential || false
      }
    };
  }
}