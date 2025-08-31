// Legal Research Services Integration Module
export * from './LexisNexisService';
export * from './WestlawService';

import { LexisNexisService } from './LexisNexisService';
import { WestlawService } from './WestlawService';

export class LegalResearchServiceFactory {
  static createService(serviceType: 'lexisnexis' | 'westlaw'): any {
    switch (serviceType) {
      case 'lexisnexis':
        return new LexisNexisService();
      case 'westlaw':
        return new WestlawService();
      default:
        throw new Error(`Unknown legal research service: ${serviceType}`);
    }
  }
}