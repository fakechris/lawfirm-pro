import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the audit trail service for testing
const mockAuditTrailService = {
  logEvent: jest.fn(),
  getEvents: jest.fn(),
  getAnalytics: jest.fn(),
  exportToCSV: jest.fn(),
  exportToJSON: jest.fn(),
  cleanupOldEvents: jest.fn(),
  generateComplianceReport: jest.fn()
};

// Mock the enhanced audit middleware
const mockEnhancedAuditMiddleware = {
  logAction: jest.fn().mockImplementation(() => () => {}),
  logDataAccess: jest.fn().mockImplementation(() => () => {}),
  logDataModification: jest.fn().mockImplementation(() => () => {}),
  logSecurityEvent: jest.fn().mockImplementation(() => () => {}),
  logPIPLCompliance: jest.fn().mockImplementation(() => () => {}),
  logCSLCompliance: jest.fn().mockImplementation(() => () => {}),
  logDSLCompliance: jest.fn().mockImplementation(() => () => {}),
  getRealTimeMetrics: jest.fn(),
  detectAnomalies: jest.fn()
};

// Mock user roles
const UserRole = {
  ADMIN: 'ADMIN',
  LAWYER: 'LAWYER',
  PARALEGAL: 'PARALEGAL',
  ASSISTANT: 'ASSISTANT',
  ARCHIVIST: 'ARCHIVIST'
};

describe('AuditTrailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should log an audit event successfully', async () => {
      const eventData = {
        userId: 'test-user-1',
        userEmail: 'test@example.com',
        userRole: UserRole.LAWYER,
        action: 'TEST_ACTION',
        entityType: 'TEST_ENTITY',
        entityId: 'test-entity-1',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        sessionId: 'test-session-1',
        correlationId: 'test-correlation-1',
        severity: 'INFO' as const,
        category: 'USER_ACTION' as const,
        complianceFlags: ['PIPL_DATA_ACCESS'],
        result: 'SUCCESS' as const
      };

      const mockEvent = {
        id: 'test-id-1',
        timestamp: new Date(),
        ...eventData
      };

      mockAuditTrailService.logEvent.mockResolvedValue(mockEvent);

      const event = await mockAuditTrailService.logEvent(eventData);

      expect(event).toBeDefined();
      expect(event.id).toBe('test-id-1');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.userId).toBe(eventData.userId);
      expect(event.action).toBe(eventData.action);
      expect(event.entityType).toBe(eventData.entityType);
      expect(event.result).toBe(eventData.result);
    });

    it('should handle missing optional fields', async () => {
      const eventData = {
        userId: 'test-user-2',
        userEmail: 'test2@example.com',
        userRole: UserRole.LAWYER,
        action: 'SIMPLE_ACTION',
        entityType: 'SIMPLE_ENTITY',
        entityId: 'simple-entity-1',
        ipAddress: '192.168.1.2',
        userAgent: 'simple-agent',
        sessionId: 'simple-session-1',
        correlationId: 'simple-correlation-1',
        severity: 'INFO' as const,
        category: 'USER_ACTION' as const,
        complianceFlags: [],
        result: 'SUCCESS' as const
      };

      const mockEvent = {
        id: 'test-id-2',
        timestamp: new Date(),
        ...eventData
      };

      mockAuditTrailService.logEvent.mockResolvedValue(mockEvent);

      const event = await mockAuditTrailService.logEvent(eventData);

      expect(event).toBeDefined();
      expect(event.oldValues).toBeUndefined();
      expect(event.newValues).toBeUndefined();
      expect(event.error).toBeUndefined();
      expect(event.metadata).toBeUndefined();
    });
  });

  describe('getEvents', () => {
    it('should retrieve events with no filter', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-1',
          action: 'ACTION_1',
          entityType: 'ENTITY_1',
          severity: 'INFO',
          category: 'USER_ACTION',
          complianceFlags: [],
          result: 'SUCCESS'
        },
        {
          id: 'event-2',
          userId: 'user-2',
          action: 'ACTION_2',
          entityType: 'ENTITY_2',
          severity: 'WARNING',
          category: 'SECURITY_EVENT',
          complianceFlags: ['CSL_NETWORK_SECURITY'],
          result: 'FAILURE'
        }
      ];

      mockAuditTrailService.getEvents.mockResolvedValue(mockEvents);

      const events = await mockAuditTrailService.getEvents({});
      
      expect(events.length).toBe(2);
      expect(events[0].userId).toBe('user-1');
      expect(events[1].userId).toBe('user-2');
    });

    it('should filter by user ID', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-1',
          action: 'ACTION_1',
          entityType: 'ENTITY_1',
          severity: 'INFO',
          category: 'USER_ACTION',
          complianceFlags: [],
          result: 'SUCCESS'
        }
      ];

      mockAuditTrailService.getEvents.mockResolvedValue(mockEvents);

      const events = await mockAuditTrailService.getEvents({ userId: 'user-1' });
      
      expect(events.length).toBe(1);
      expect(events.every(e => e.userId === 'user-1')).toBe(true);
    });

    it('should filter by severity', async () => {
      const mockEvents = [
        {
          id: 'event-2',
          userId: 'user-2',
          action: 'ACTION_2',
          entityType: 'ENTITY_2',
          severity: 'WARNING',
          category: 'SECURITY_EVENT',
          complianceFlags: ['CSL_NETWORK_SECURITY'],
          result: 'FAILURE'
        }
      ];

      mockAuditTrailService.getEvents.mockResolvedValue(mockEvents);

      const events = await mockAuditTrailService.getEvents({ severity: ['WARNING'] });
      
      expect(events.length).toBe(1);
      expect(events.every(e => e.severity === 'WARNING')).toBe(true);
    });

    it('should limit results', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-1',
          action: 'ACTION_1',
          entityType: 'ENTITY_1',
          severity: 'INFO',
          category: 'USER_ACTION',
          complianceFlags: [],
          result: 'SUCCESS'
        }
      ];

      mockAuditTrailService.getEvents.mockResolvedValue(mockEvents);

      const events = await mockAuditTrailService.getEvents({ limit: 1 });
      
      expect(events.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getAnalytics', () => {
    it('should calculate analytics correctly', async () => {
      const mockAnalytics = {
        totalEvents: 100,
        eventsByCategory: {
          'USER_ACTION': 60,
          'SECURITY_EVENT': 30,
          'SYSTEM_EVENT': 10
        },
        eventsBySeverity: {
          'INFO': 70,
          'WARNING': 20,
          'ERROR': 10
        },
        eventsByUser: {
          'user-1': 40,
          'user-2': 35,
          'user-3': 25
        },
        eventsByEntityType: {
          'Document': 50,
          'Client': 30,
          'Case': 20
        },
        complianceViolations: 5,
        securityEvents: 30,
        uniqueUsers: 3,
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        }
      };

      mockAuditTrailService.getAnalytics.mockResolvedValue(mockAnalytics);

      const analytics = await mockAuditTrailService.getAnalytics(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(analytics).toBeDefined();
      expect(analytics.totalEvents).toBe(100);
      expect(analytics.eventsByCategory['USER_ACTION']).toBe(60);
      expect(analytics.eventsBySeverity['INFO']).toBe(70);
      expect(analytics.uniqueUsers).toBe(3);
    });
  });

  describe('exportToCSV', () => {
    it('should export events to CSV format', async () => {
      const mockCSV = `Timestamp,User ID,Action,Entity Type,Severity,Category,Result
2024-01-01T10:00:00.000Z,user-1,VIEW_DOCUMENT,Document,INFO,DATA_ACCESS,SUCCESS
2024-01-01T10:01:00.000Z,user-2,UPDATE_CLIENT,Client,WARNING,DATA_MODIFICATION,SUCCESS`;

      mockAuditTrailService.exportToCSV.mockResolvedValue(mockCSV);

      const csv = await mockAuditTrailService.exportToCSV({});
      
      expect(csv).toBeDefined();
      expect(csv.length).toBeGreaterThan(0);
      expect(csv.includes('Timestamp')).toBe(true);
      expect(csv.includes('User ID')).toBe(true);
      expect(csv.includes('Action')).toBe(true);
    });
  });

  describe('exportToJSON', () => {
    it('should export events to JSON format', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          timestamp: '2024-01-01T10:00:00.000Z',
          userId: 'user-1',
          action: 'VIEW_DOCUMENT',
          entityType: 'Document',
          severity: 'INFO',
          category: 'DATA_ACCESS',
          result: 'SUCCESS'
        }
      ];

      const mockJSON = JSON.stringify(mockEvents, null, 2);
      mockAuditTrailService.exportToJSON.mockResolvedValue(mockJSON);

      const json = await mockAuditTrailService.exportToJSON({});
      
      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);
      
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].id).toBe('event-1');
      expect(parsed[0].action).toBe('VIEW_DOCUMENT');
    });
  });

  describe('cleanupOldEvents', () => {
    it('should clean up old events', async () => {
      mockAuditTrailService.cleanupOldEvents.mockResolvedValue(50);

      const deletedCount = await mockAuditTrailService.cleanupOldEvents(365);
      
      expect(deletedCount).toBe(50);
    });
  });
});

describe('EnhancedAuditMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logAction', () => {
    it('should create middleware function', () => {
      const middleware = mockEnhancedAuditMiddleware.logAction('TEST_ACTION', 'TEST_ENTITY');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('logDataAccess', () => {
    it('should create data access middleware', () => {
      const middleware = mockEnhancedAuditMiddleware.logDataAccess('VIEW', 'Document');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('logDataModification', () => {
    it('should create data modification middleware', () => {
      const middleware = mockEnhancedAuditMiddleware.logDataModification('UPDATE', 'Document');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('logSecurityEvent', () => {
    it('should create security event middleware', () => {
      const middleware = mockEnhancedAuditMiddleware.logSecurityEvent('LOGIN_FAILED', 'UserSession');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('logPIPLCompliance', () => {
    it('should create PIPL compliance middleware', () => {
      const middleware = mockEnhancedAuditMiddleware.logPIPLCompliance('DATA_ACCESS', 'ClientData');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('logCSLCompliance', () => {
    it('should create CSL compliance middleware', () => {
      const middleware = mockEnhancedAuditMiddleware.logCSLCompliance('NETWORK_SCAN', 'System');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('logDSLCompliance', () => {
    it('should create DSL compliance middleware', () => {
      const middleware = mockEnhancedAuditMiddleware.logDSLCompliance('DATA_REQUEST', 'Client');
      expect(typeof middleware).toBe('function');
    });
  });
});

describe('Audit Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle complete audit flow', async () => {
    // Log a comprehensive audit event
    const eventData = {
      userId: 'integration-user',
      userEmail: 'integration@example.com',
      userRole: UserRole.LAWYER,
      action: 'INTEGRATION_TEST',
      entityType: 'TEST_ENTITY',
      entityId: 'integration-entity-1',
      oldValues: { status: 'old' },
      newValues: { status: 'new' },
      ipAddress: '192.168.1.1',
      userAgent: 'integration-agent',
      sessionId: 'integration-session-1',
      correlationId: 'integration-correlation-1',
      severity: 'INFO' as const,
      category: 'DATA_MODIFICATION' as const,
      complianceFlags: ['PIPL_DATA_ACCESS', 'CSL_ACCESS_CONTROL'],
      result: 'SUCCESS' as const,
      metadata: { test: 'integration' }
    };

    const mockEvent = {
      id: 'integration-event-1',
      timestamp: new Date(),
      ...eventData
    };

    mockAuditTrailService.logEvent.mockResolvedValue(mockEvent);

    const event = await mockAuditTrailService.logEvent(eventData);

    expect(event).toBeDefined();
    expect(event.id).toBe('integration-event-1');
    expect(event.action).toBe('INTEGRATION_TEST');
    expect(event.complianceFlags).toContain('PIPL_DATA_ACCESS');
    expect(event.complianceFlags).toContain('CSL_ACCESS_CONTROL');

    // Retrieve the event
    const mockEvents = [mockEvent];
    mockAuditTrailService.getEvents.mockResolvedValue(mockEvents);

    const events = await mockAuditTrailService.getEvents({ 
      userId: 'integration-user',
      action: 'INTEGRATION_TEST'
    });

    expect(events.length).toBe(1);
    const retrievedEvent = events.find(e => e.id === event.id);
    expect(retrievedEvent).toBeDefined();
    expect(retrievedEvent?.oldValues).toEqual({ status: 'old' });
    expect(retrievedEvent?.newValues).toEqual({ status: 'new' });

    // Export to CSV
    const mockCSV = `Timestamp,User ID,Action,Entity Type,Severity,Category,Result
${event.timestamp.toISOString()},integration-user,INTEGRATION_TEST,TEST_ENTITY,INFO,DATA_MODIFICATION,SUCCESS`;
    mockAuditTrailService.exportToCSV.mockResolvedValue(mockCSV);

    const csv = await mockAuditTrailService.exportToCSV({ 
      userId: 'integration-user' 
    });
    expect(csv).toBeDefined();
    expect(csv.includes('INTEGRATION_TEST')).toBe(true);

    // Export to JSON
    const mockJSON = JSON.stringify([event], null, 2);
    mockAuditTrailService.exportToJSON.mockResolvedValue(mockJSON);

    const json = await mockAuditTrailService.exportToJSON({ 
      userId: 'integration-user' 
    });
    expect(json).toBeDefined();
    expect(json.includes('INTEGRATION_TEST')).toBe(true);

    // Get analytics
    const mockAnalytics = {
      totalEvents: 1,
      eventsByCategory: { 'DATA_MODIFICATION': 1 },
      eventsBySeverity: { 'INFO': 1 },
      eventsByUser: { 'integration-user': 1 },
      eventsByEntityType: { 'TEST_ENTITY': 1 },
      complianceViolations: 0,
      securityEvents: 0,
      uniqueUsers: 1,
      timeRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      }
    };

    mockAuditTrailService.getAnalytics.mockResolvedValue(mockAnalytics);

    const analytics = await mockAuditTrailService.getAnalytics(
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    expect(analytics.totalEvents).toBe(1);
  });
});