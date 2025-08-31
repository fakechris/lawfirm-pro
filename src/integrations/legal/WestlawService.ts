import { BaseExternalService } from '../../services/external/BaseExternalService';
import { LegalResearchService } from '../../services/external';
import {
  SearchQuery,
  CaseResult,
  Statute,
  Regulation,
  AnalysisResult,
  Citation
} from '../../services/external/types';

export class WestlawService extends BaseExternalService implements LegalResearchService {

  constructor() {
    super('westlaw');
  }

  async searchCases(query: SearchQuery): Promise<CaseResult[]> {
    try {
      this.logRequest('POST', '/search/cases', { query: query.query, jurisdiction: query.jurisdiction });

      const searchRequest = {
        query: {
          text: query.query,
          filters: {
            jurisdiction: query.jurisdiction,
            court: query.court,
            dateRange: query.dateRange ? {
              from: query.dateRange.start.toISOString().split('T')[0],
              to: query.dateRange.end.toISOString().split('T')[0]
            } : undefined,
            practiceArea: query.practiceArea,
            caseType: query.caseType
          }
        },
        pagination: {
          start: query.offset || 0,
          count: query.limit || 20
        },
        options: {
          includeFullText: true,
          includeHeadnotes: true,
          includeCitations: true
        }
      };

      const response = await this.makeRequest<any>('/search/cases', {
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
        date: new Date(result.decisionDate),
        judge: result.judge,
        summary: result.summary || result.headnote,
        keywords: result.keywords || result.keyNumbers || [],
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
        content: result.fullText,
        relevanceScore: result.relevanceScore || 0
      }));

      this.logResponse('POST', '/search/cases', { count: cases.length }, Date.now());
      return cases;

    } catch (error) {
      this.logError('POST', '/search/cases', error, Date.now());
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
        lastAmended: statute.lastAmended ? new Date(statute.lastAmended) : undefined,
        tags: statute.tags || statute.keyCitations || [],
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
      this.logRequest('POST', '/search/regulations', { query });

      const searchRequest = {
        query: {
          text: query,
          filters: {
            status: ['active', 'proposed']
          }
        },
        pagination: {
          start: 0,
          count: 50
        }
      };

      const response = await this.makeRequest<any>('/search/regulations', {
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
        lastAmended: reg.lastAmended ? new Date(reg.lastAmended) : undefined,
        tags: reg.tags || [],
        relatedRegulations: reg.relatedRegulations || []
      }));

      this.logResponse('POST', '/search/regulations', { count: regulations.length }, Date.now());
      return regulations;

    } catch (error) {
      this.logError('POST', '/search/regulations', error, Date.now());
      throw error;
    }
  }

  async analyzeDocument(document: any): Promise<AnalysisResult> {
    try {
      this.logRequest('POST', '/documents/analyze', { documentId: 'document' });

      const analysisRequest = {
        document: {
          content: document.textContent || '',
          title: document.title || '',
          type: document.type || 'unknown'
        },
        analysis: {
          extractKeyCites: true,
          identifyLegalIssues: true,
          findRelatedCases: true,
          generateSummary: true,
          assessRisk: true
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
          relevantJurisdictions: issue.jurisdictions || [],
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

  // Additional Westlaw-specific methods
  async getKeyCitations(caseId: string): Promise<Citation[]> {
    try {
      this.logRequest('GET', `/cases/${caseId}/keycite`);

      const response = await this.makeRequest<any>(`/cases/${caseId}/keycite`);

      const citations: Citation[] = response.citations.map((citation: any) => ({
        type: citation.type,
        text: citation.text,
        source: citation.source,
        relevance: citation.relevance || 0
      }));

      this.logResponse('GET', `/cases/${caseId}/keycite`, { count: citations.length }, Date.now());
      return citations;

    } catch (error) {
      this.logError('GET', `/cases/${caseId}/keycite`, error, Date.now());
      throw error;
    }
  }

  async getHeadnotes(caseId: string): Promise<string[]> {
    try {
      this.logRequest('GET', `/cases/${caseId}/headnotes`);

      const response = await this.makeRequest<string[]>(`/cases/${caseId}/headnotes`);

      this.logResponse('GET', `/cases/${caseId}/headnotes`, { count: response.length }, Date.now());
      return response;

    } catch (error) {
      this.logError('GET', `/cases/${caseId}/headnotes`, error, Date.now());
      throw error;
    }
  }

  async searchKeyNumbers(keyNumber: string, jurisdiction?: string): Promise<CaseResult[]> {
    try {
      this.logRequest('POST', '/search/keynumbers', { keyNumber, jurisdiction });

      const searchRequest = {
        keyNumber: keyNumber,
        jurisdiction: jurisdiction,
        pagination: {
          start: 0,
          count: 20
        }
      };

      const response = await this.makeRequest<any>('/search/keynumbers', {
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
        date: new Date(result.decisionDate),
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
        content: result.fullText,
        relevanceScore: result.relevanceScore || 0
      }));

      this.logResponse('POST', '/search/keynumbers', { count: cases.length }, Date.now());
      return cases;

    } catch (error) {
      this.logError('POST', '/search/keynumbers', error, Date.now());
      throw error;
    }
  }

  async getJurisdictions(): Promise<string[]> {
    try {
      this.logRequest('GET', '/jurisdictions');

      const response = await this.makeRequest<string[]>('/jurisdictions');

      this.logResponse('GET', '/jurisdictions', { count: response.length }, Date.now());
      return response;

    } catch (error) {
      this.logError('GET', '/jurisdictions', error, Date.now());
      throw error;
    }
  }

  override async testConnection(): Promise<boolean> {
    try {
      await this.getJurisdictions();
      return true;
    } catch (error) {
      this.logger.error('Westlaw connection test failed', { error });
      return false;
    }
  }
}