import { BaseExternalService } from '../../services/external/BaseExternalService';
import { CourtIntegration } from '../../services/external';
import { LegalDocument, FilingResult, CaseStatus, Hearing, HearingResult, Attorney } from '../../services/external/types';
export declare class StateCourtService extends BaseExternalService implements CourtIntegration {
    private supportedStates;
    constructor();
    fileDocument(document: LegalDocument): Promise<FilingResult>;
    checkStatus(caseId: string): Promise<CaseStatus>;
    retrieveDocuments(caseId: string): Promise<LegalDocument[]>;
    scheduleHearing(caseId: string, hearing: Hearing): Promise<HearingResult>;
    getCaseInformation(state: string, caseNumber: string): Promise<CaseStatus>;
    searchCases(state: string, query: {
        caseNumber?: string;
        partyName?: string;
        attorneyName?: string;
        caseType?: string;
        filedAfter?: Date;
        filedBefore?: Date;
        county?: string;
    }): Promise<CaseStatus[]>;
    getAttorneyInformation(state: string, barNumber: string): Promise<Attorney>;
    getFilingFees(state: string, courtType: string, caseType: string): Promise<number>;
    getSupportedStates(): Promise<string[]>;
    testConnection(): Promise<boolean>;
    private mapDocument;
}
//# sourceMappingURL=StateCourtService.d.ts.map