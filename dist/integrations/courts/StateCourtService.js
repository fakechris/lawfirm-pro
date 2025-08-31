"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateCourtService = void 0;
const BaseExternalService_1 = require("../../services/external/BaseExternalService");
class StateCourtService extends BaseExternalService_1.BaseExternalService {
    constructor() {
        super('stateCourts');
        this.supportedStates = ['CA', 'NY', 'TX', 'FL'];
    }
    async fileDocument(document) {
        try {
            this.logRequest('POST', '/documents/file', { documentId: document.id });
            const courtState = document.metadata.court.jurisdiction.split('-')[0];
            if (!this.supportedStates.includes(courtState)) {
                throw new Error(`State ${courtState} is not supported by this integration`);
            }
            const filingData = {
                court: document.metadata.court.courtCode,
                state: courtState,
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
                    email: a.contact.email,
                    stateLicense: a.contact.email?.split('@')[1]
                })),
                metadata: {
                    confidential: document.metadata.confidential,
                    tags: document.metadata.tags,
                    docketNumber: document.metadata.docketNumber
                }
            };
            const response = await this.makeRequest('/documents/file', {
                method: 'POST',
                body: JSON.stringify(filingData)
            });
            const result = {
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
        }
        catch (error) {
            this.logError('POST', '/documents/file', error, Date.now());
            return {
                success: false,
                filingDate: new Date(),
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async checkStatus(caseId) {
        try {
            this.logRequest('GET', `/cases/${caseId}/status`);
            const response = await this.makeRequest(`/cases/${caseId}/status`);
            const result = {
                caseId: response.caseId,
                docketNumber: response.docketNumber,
                status: response.status,
                lastUpdated: new Date(response.lastUpdated),
                ...(response.nextHearing && { nextHearing: new Date(response.nextHearing) }),
                ...(response.judge && { judge: response.judge }),
                assignedAttorneys: response.assignedAttorneys.map((a) => ({
                    name: a.name,
                    barNumber: a.barNumber,
                    firm: a.firm,
                    contact: a.contact
                })),
                documents: response.documents.map((d) => this.mapDocument(d)),
                timeline: response.timeline.map((e) => ({
                    date: new Date(e.date),
                    description: e.description,
                    eventType: e.eventType,
                    filedBy: e.filedBy,
                    documentId: e.documentId
                }))
            };
            this.logResponse('GET', `/cases/${caseId}/status`, result, Date.now());
            return result;
        }
        catch (error) {
            this.logError('GET', `/cases/${caseId}/status`, error, Date.now());
            throw error;
        }
    }
    async retrieveDocuments(caseId) {
        try {
            this.logRequest('GET', `/cases/${caseId}/documents`);
            const response = await this.makeRequest(`/cases/${caseId}/documents`);
            const documents = response.map(doc => this.mapDocument(doc));
            this.logResponse('GET', `/cases/${caseId}/documents`, { count: documents.length }, Date.now());
            return documents;
        }
        catch (error) {
            this.logError('GET', `/cases/${caseId}/documents`, error, Date.now());
            throw error;
        }
    }
    async scheduleHearing(caseId, hearing) {
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
            const response = await this.makeRequest(`/cases/${caseId}/hearings`, {
                method: 'POST',
                body: JSON.stringify(hearingData)
            });
            const result = {
                success: response.success,
                hearingId: response.hearingId,
                scheduledDate: new Date(response.scheduledDate),
                confirmationNumber: response.confirmationNumber,
                instructions: response.instructions,
                errors: response.errors
            };
            this.logResponse('POST', `/cases/${caseId}/hearings`, result, Date.now());
            return result;
        }
        catch (error) {
            this.logError('POST', `/cases/${caseId}/hearings`, error, Date.now());
            return {
                success: false,
                scheduledDate: hearing.date,
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async getCaseInformation(state, caseNumber) {
        try {
            if (!this.supportedStates.includes(state)) {
                throw new Error(`State ${state} is not supported`);
            }
            this.logRequest('GET', `/${state}/cases/${caseNumber}`);
            const response = await this.makeRequest(`/${state}/cases/${caseNumber}`);
            const result = {
                caseId: response.caseId,
                docketNumber: response.docketNumber,
                status: response.status,
                lastUpdated: new Date(response.lastUpdated),
                ...(response.nextHearing && { nextHearing: new Date(response.nextHearing) }),
                ...(response.judge && { judge: response.judge }),
                assignedAttorneys: response.assignedAttorneys.map((a) => ({
                    name: a.name,
                    barNumber: a.barNumber,
                    firm: a.firm,
                    contact: a.contact
                })),
                documents: response.documents.map((d) => this.mapDocument(d)),
                timeline: response.timeline.map((e) => ({
                    date: new Date(e.date),
                    description: e.description,
                    eventType: e.eventType,
                    filedBy: e.filedBy,
                    documentId: e.documentId
                }))
            };
            this.logResponse('GET', `/${state}/cases/${caseNumber}`, result, Date.now());
            return result;
        }
        catch (error) {
            this.logError('GET', `/${state}/cases/${caseNumber}`, error, Date.now());
            throw error;
        }
    }
    async searchCases(state, query) {
        try {
            if (!this.supportedStates.includes(state)) {
                throw new Error(`State ${state} is not supported`);
            }
            this.logRequest('GET', `/${state}/cases/search`, { query });
            const params = new URLSearchParams();
            if (query.caseNumber)
                params.append('caseNumber', query.caseNumber);
            if (query.partyName)
                params.append('partyName', query.partyName);
            if (query.attorneyName)
                params.append('attorneyName', query.attorneyName);
            if (query.caseType)
                params.append('caseType', query.caseType);
            if (query.filedAfter)
                params.append('filedAfter', query.filedAfter.toISOString());
            if (query.filedBefore)
                params.append('filedBefore', query.filedBefore.toISOString());
            if (query.county)
                params.append('county', query.county);
            const response = await this.makeRequest(`/${state}/cases/search?${params.toString()}`);
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
            this.logResponse('GET', `/${state}/cases/search`, { count: cases.length }, Date.now());
            return cases;
        }
        catch (error) {
            this.logError('GET', `/${state}/cases/search`, error, Date.now());
            throw error;
        }
    }
    async getAttorneyInformation(state, barNumber) {
        try {
            if (!this.supportedStates.includes(state)) {
                throw new Error(`State ${state} is not supported`);
            }
            this.logRequest('GET', `/${state}/attorneys/${barNumber}`);
            const response = await this.makeRequest(`/${state}/attorneys/${barNumber}`);
            const attorney = {
                name: response.name,
                barNumber: response.barNumber,
                firm: response.firm,
                contact: response.contact,
                representing: response.representing
            };
            this.logResponse('GET', `/${state}/attorneys/${barNumber}`, attorney, Date.now());
            return attorney;
        }
        catch (error) {
            this.logError('GET', `/${state}/attorneys/${barNumber}`, error, Date.now());
            throw error;
        }
    }
    async getFilingFees(state, courtType, caseType) {
        try {
            if (!this.supportedStates.includes(state)) {
                throw new Error(`State ${state} is not supported`);
            }
            this.logRequest('GET', `/${state}/fees/${courtType}/${caseType}`);
            const response = await this.makeRequest(`/${state}/fees/${courtType}/${caseType}`);
            this.logResponse('GET', `/${state}/fees/${courtType}/${caseType}`, { fee: response.fee }, Date.now());
            return response.fee;
        }
        catch (error) {
            this.logError('GET', `/${state}/fees/${courtType}/${caseType}`, error, Date.now());
            throw error;
        }
    }
    async getSupportedStates() {
        return [...this.supportedStates];
    }
    async testConnection() {
        try {
            await this.getSupportedStates();
            return true;
        }
        catch (error) {
            this.logger.error('State court connection test failed', { error });
            return false;
        }
    }
    mapDocument(doc) {
        return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            documentType: doc.documentType,
            ...(doc.filingDate && { filingDate: new Date(doc.filingDate) }),
            ...(doc.caseId && { caseId: doc.caseId }),
            parties: doc.parties?.map((p) => ({
                name: p.name,
                role: p.role,
                address: p.address,
                contact: p.contact
            })) || [],
            attorneys: doc.attorneys?.map((a) => ({
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
                    level: 'state',
                    location: '',
                    courtCode: ''
                },
                tags: doc.metadata?.tags || [],
                confidential: doc.metadata?.confidential || false
            }
        };
    }
}
exports.StateCourtService = StateCourtService;
//# sourceMappingURL=StateCourtService.js.map