import { BaseExternalService } from '../../services/external/BaseExternalService';
import { LegalResearchService } from '../../services/external';
import { SearchQuery, CaseResult, Statute, Regulation, AnalysisResult } from '../../services/external/types';
export declare class LexisNexisService extends BaseExternalService implements LegalResearchService {
    constructor();
    searchCases(query: SearchQuery): Promise<CaseResult[]>;
    getStatutes(jurisdiction: string): Promise<Statute[]>;
    searchRegulations(query: string): Promise<Regulation[]>;
    analyzeDocument(document: any): Promise<AnalysisResult>;
    getCaseByCitation(citation: string): Promise<CaseResult>;
    getStatuteByCode(code: string, section: string, jurisdiction: string): Promise<Statute>;
    searchShepardizedCases(citation: string): Promise<CaseResult[]>;
    getPracticeAreas(): Promise<string[]>;
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=LexisNexisService.d.ts.map