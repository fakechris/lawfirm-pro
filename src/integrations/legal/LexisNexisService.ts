import { BaseExternalService } from '../../services/external/BaseExternalService';
import { LegalResearchService } from '../../services/external';
import {
  SearchQuery,
  CaseResult,
  Statute,
  Regulation,
  AnalysisResult
} from '../../services/external/types';

export class LexisNexisService extends BaseExternalService implements LegalResearchService {

  constructor() {
    super('lexisNexis');
  }

  async searchCases(query: SearchQuery): Promise<CaseResult[]> {
    try {
      this.logRequest('POST', '/cases/search', { query: query.query, jurisdiction: query.jurisdiction });

      const searchRequest = {
        query: query.query,
        jurisdiction: query.jurisdiction,
        court: query.court,
        dateRange: query.dateRange ? {
          start: query.dateRange.start.toISOString(),
          end: query.dateRange.end.toISOString()
        } : undefined,
        practiceArea: query.practiceArea,
        caseType: query.caseType,
        limit: query.limit || 20,
        offset: query.offset || 0,
        filters: {
          contentTypes: ['cases'],
          jurisdictions: query.jurisdiction ? [query.jurisdiction] : undefined,
          dateRange: query.dateRange ? {
            startDate: query.dateRange.start.toISOString().split('T')[0],
            endDate: query.dateRange.end.toISOString().split('T')[0]
          } : undefined
        }
      };

      const response = await this.makeRequest<any>('/cases/search', {
        method: 'POST',
        body: JSON.stringify(searchRequest)
      });

      const cases: CaseResult[] = response.results.map((result: any) => ({
        id: result.id,
        title: result.title,
        citation: result.citation,
        court: {
          name: result.court.name,
          jurisdiction: result.court.jurisdiction,
          level: result.court.level,
          location: result.court.location,
          courtCode: result.court.code
        },
        date: new Date(result.date),
        judge: result.judge,
        summary: result.summary,
        keywords: result.keywords || [],
        docketNumber: result.docketNumber,
        parties: result.parties?.map((p: any) => ({
          name: p.name,
          role: p.role,
          address: p.address,
          contact: p.contact
        })) || [],
        attorneys: result.attorneys?.map((a: any) => ({
          name: a.name,
          barNumber: a.barNumber,
          firm: a.firm,
          contact: a.contact,
          representing: a.representing
        })) || [],
        content: result.content,
        relevanceScore: result.relevanceScore || 0
      }));

      this.logResponse('POST', '/cases/search', { count: cases.length }, Date.now());
      return cases;

    } catch (error) {
      this.logError('POST', '/cases/search', error, Date.now());
      throw error;
    }
  }

  async getStatutes(jurisdiction: string): Promise<Statute[]> {
    try {
      this.logRequest('GET', `/statutes/${jurisdiction}`);

      const response = await this.makeRequest<any>(`/statutes/${jurisdiction}`);

      const statutes: Statute[] = response.statutes.map((statute: any) => ({
        id: statute.id,
        title: statute.title,
        code: statute.code,
        section: statute.section,
        jurisdiction: statute.jurisdiction,
        text: statute.text,
        effectiveDate: new Date(statute.effectiveDate),
        ...(statute.lastAmended && { lastAmended: new Date(statute.lastAmended) }),
        tags: statute.tags || [],
        relatedStatutes: statute.relatedStatutes || []
      }));

      this.logResponse('GET', `/statutes/${jurisdiction}`, { count: statutes.length }, Date.now());
      return statutes;

    } catch (error) {
      this.logError('GET', `/statutes/${jurisdiction}`, error, Date.now());
      throw error;
    }
  }

  async searchRegulations(query: string): Promise<Regulation[]> {
    try {
      this.logRequest('POST', '/regulations/search', { query });

      const searchRequest = {
        query: query,
        limit: 50,
        filters: {
          contentTypes: ['regulations'],
          status: ['active', 'proposed']
        }
      };

      const response = await this.makeRequest<any>('/regulations/search', {
        method: 'POST',
        body: JSON.stringify(searchRequest)
      });

      const regulations: Regulation[] = response.results.map((reg: any) => ({
        id: reg.id,
        title: reg.title,
        agency: reg.agency,
        citation: reg.citation,
        jurisdiction: reg.jurisdiction,
        text: reg.text,
        effectiveDate: new Date(reg.effectiveDate),
        ...(reg.lastAmended && { lastAmended: new Date(reg.lastAmended) }),
        tags: reg.tags || [],
        relatedRegulations: reg.relatedRegulations || []
      }));

      this.logResponse('POST', '/regulations/search', { count: regulations.length }, Date.now());
      return regulations;

    } catch (error) {
      this.logError('POST', '/regulations/search', error, Date.now());
      throw error;
    }
  }

  async analyzeDocument(document: any): Promise<AnalysisResult> {
    try {
      this.logRequest('POST', '/documents/analyze', { documentId: 'document' });

      // For document analysis, we need to send the document content
      const analysisRequest = {
        content: document.textContent || '',
        title: document.title || '',
        documentType: document.type || 'unknown',
        analysisOptions: {
          identifyIssues: true,
          extractCitations: true,
          identifyEntities: true,
          assessRisk: true,
          generateRecommendations: true
        }
      };

      const response = await this.makeRequest<any>('/documents/analyze', {
        method: 'POST',
        body: JSON.stringify(analysisRequest)
      });

      const result: AnalysisResult = {
        documentId: response.documentId,
        issues: response.issues?.map((issue: any) => ({
          type: issue.type,
          description: issue.description,
          severity: issue.severity,
          relevantJurisdictions: issue.relevantJurisdictions || [],
          relatedCases: issue.relatedCases || []
        })) || [],
        citations: response.citations?.map((citation: any) => ({
          type: citation.type,
          text: citation.text,
          source: citation.source,
          relevance: citation.relevance || 0
        })) || [],
        entities: response.entities?.map((entity: any) => ({
          type: entity.type,
          text: entity.text,
          context: entity.context,
          confidence: entity.confidence || 0
        })) || [],
        riskAssessment: response.riskAssessment ? {
          overallRisk: response.riskAssessment.overallRisk,
          factors: response.riskAssessment.factors?.map((factor: any) => ({
            factor: factor.factor,
            impact: factor.impact,
            likelihood: factor.likelihood,
            description: factor.description
          })) || [],
          mitigation: response.riskAssessment.mitigation || []
        } : {
          overallRisk: 'low',
          factors: [],
          mitigation: []
        },
        recommendations: response.recommendations?.map((rec: any) => ({
          type: rec.type,
          description: rec.description,
          priority: rec.priority,
          evidence: rec.evidence || []
        })) || [],
        confidence: response.confidence || 0
      };

      this.logResponse('POST', '/documents/analyze', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/documents/analyze', error, Date.now());
      throw error;
    }
  }

  // Additional LexisNexis-specific methods
  async getCaseByCitation(citation: string): Promise<CaseResult> {
    try {
      this.logRequest('GET', `/cases/citation/${encodeURIComponent(citation)}`);

      const response = await this.makeRequest<any>(`/cases/citation/${encodeURIComponent(citation)}`);

      const result: CaseResult = {
        id: response.id,
        title: response.title,
        citation: response.citation,
        court: {
          name: response.court.name,
          jurisdiction: response.court.jurisdiction,
          level: response.court.level,
          location: response.court.location,
          courtCode: response.court.code
        },
        date: new Date(response.date),
        judge: response.judge,
        summary: response.summary,
        keywords: response.keywords || [],
        docketNumber: response.docketNumber,
        parties: response.parties?.map((p: any) => ({
          name: p.name,
          role: p.role,
          address: p.address,
          contact: p.contact
        })) || [],
        attorneys: response.attorneys?.map((a: any) => ({
          name: a.name,
          barNumber: a.barNumber,
          firm: a.firm,
          contact: a.contact,
          representing: a.representing
        })) || [],
        content: response.content,
        relevanceScore: 1.0
      };

      this.logResponse('GET', `/cases/citation/${encodeURIComponent(citation)}`, result, Date.now());
      return result;

    } catch (error) {
      this.logError('GET', `/cases/citation/${encodeURIComponent(citation)}`, error, Date.now());
      throw error;
    }
  }

  async getStatuteByCode(code: string, section: string, jurisdiction: string): Promise<Statute> {
    try {
      this.logRequest('GET', `/statutes/${jurisdiction}/${code}/${section}`);

      const response = await this.makeRequest<any>(`/statutes/${jurisdiction}/${code}/${section}`);

      const result: Statute = {
        id: response.id,
        title: response.title,
        code: response.code,
        section: response.section,
        jurisdiction: response.jurisdiction,
        text: response.text,
        effectiveDate: new Date(response.effectiveDate),
        ...(response.lastAmended && { lastAmended: new Date(response.lastAmended) }),
        tags: response.tags || [],
        relatedStatutes: response.relatedStatutes || []
      };

      this.logResponse('GET', `/statutes/${jurisdiction}/${code}/${section}`, result, Date.now());
      return result;

    } catch (error) {
      this.logError('GET', `/statutes/${jurisdiction}/${code}/${section}`, error, Date.now());
      throw error;
    }
  }

  async searchShepardizedCases(citation: string): Promise<CaseResult[]> {
    try {
      this.logRequest('GET', `/shepardize/${encodeURIComponent(citation)}`);

      const response = await this.makeRequest<any>(`/shepardize/${encodeURIComponent(citation)}`);

      const cases: CaseResult[] = response.results.map((result: any) => ({
        id: result.id,
        title: result.title,
        citation: result.citation,
        court: {
          name: result.court.name,
          jurisdiction: result.court.jurisdiction,
          level: result.court.level,
          location: result.court.location,
          courtCode: result.court.code
        },
        date: new Date(result.date),
        judge: result.judge,
        summary: result.summary,
        keywords: result.keywords || [],
        docketNumber: result.docketNumber,
        parties: result.parties?.map((p: any) => ({
          name: p.name,
          role: p.role,
          address: p.address,
          contact: p.contact
        })) || [],
        attorneys: result.attorneys?.map((a: any) => ({
          name: a.name,
          barNumber: a.barNumber,
          firm: a.firm,
          contact: a.contact,
          representing: a.representing
        })) || [],
        content: result.content,
        relevanceScore: result.relevanceScore || 0
      }));

      this.logResponse('GET', `/shepardize/${encodeURIComponent(citation)}`, { count: cases.length }, Date.now());
      return cases;

    } catch (error) {
      this.logError('GET', `/shepardize/${encodeURIComponent(citation)}`, error, Date.now());
      throw error;
    }
  }

  async getPracticeAreas(): Promise<string[]> {
    try {
      this.logRequest('GET', '/practice-areas');

      const response = await this.makeRequest<string[]>('/practice-areas');

      this.logResponse('GET', '/practice-areas', { count: response.length }, Date.now());
      return response;

    } catch (error) {
      this.logError('GET', '/practice-areas', error, Date.now());
      throw error;
    }
  }

  override async testConnection(): Promise<boolean> {
    try {
      await this.getPracticeAreas();
      return true;
    } catch (error) {
      this.logger.error('LexisNexis connection test failed', { error });
      return false;
    }
  }
}