import { BaseExternalService } from '../../services/external/BaseExternalService';
import { LegalResearchService } from '../../services/external';
import { SearchQuery, CaseResult, Statute, Regulation, AnalysisResult, Citation } from '../../services/external/types';
export declare class WestlawService extends BaseExternalService implements LegalResearchService {
    constructor();
    searchCases(query: SearchQuery): Promise<CaseResult[]>;
    getStatutes(jurisdiction: string): Promise<Statute[]>;
    searchRegulations(query: string): Promise<Regulation[]>;
    analyzeDocument(document: any): Promise<AnalysisResult>;
    getKeyCitations(caseId: string): Promise<Citation[]>;
    getHeadnotes(caseId: string): Promise<string[]>;
    searchKeyNumbers(keyNumber: string, jurisdiction?: string): Promise<CaseResult[]>;
    getJurisdictions(): Promise<string[]>;
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=WestlawService.d.ts.map