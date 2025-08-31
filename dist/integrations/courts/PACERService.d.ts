import { BaseExternalService } from '../../services/external/BaseExternalService';
import { CourtIntegration } from '../../services/external';
import { LegalDocument, FilingResult, CaseStatus, Hearing, HearingResult, CourtInfo } from '../../services/external/types';
export declare class PACERService extends BaseExternalService implements CourtIntegration {
    constructor();
    fileDocument(document: LegalDocument): Promise<FilingResult>;
    checkStatus(caseId: string): Promise<CaseStatus>;
    retrieveDocuments(caseId: string): Promise<LegalDocument[]>;
    scheduleHearing(caseId: string, hearing: Hearing): Promise<HearingResult>;
    searchCases(query: {
        court?: string;
        caseTitle?: string;
        caseNumber?: string;
        filedAfter?: Date;
        filedBefore?: Date;
        partyName?: string;
        attorneyName?: string;
    }): Promise<CaseStatus[]>;
    getDocketReport(caseId: string): Promise<string>;
    getAvailableCourts(): Promise<CourtInfo[]>;
    testConnection(): Promise<boolean>;
    private mapDocument;
}
//# sourceMappingURL=PACERService.d.ts.map