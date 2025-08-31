// Court Systems Integration Module
export * from './PACERService';
export * from './StateCourtService';

import { PACERService } from './PACERService';
import { StateCourtService } from './StateCourtService';

export class CourtIntegrationFactory {
  static createService(courtType: 'pacer' | 'state'): any {
    switch (courtType) {
      case 'pacer':
        return new PACERService();
      case 'state':
        return new StateCourtService();
      default:
        throw new Error(`Unknown court type: ${courtType}`);
    }
  }
}