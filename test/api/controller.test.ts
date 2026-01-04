import express from 'express';
import request from 'supertest';
import { sessionService } from '../../src/services/session.service';
import { apiRoutes } from '../../src/api/routes';
import { CleanSnapshot } from '../../src/core/machine.types';

// Temporary Express app for testing only
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

// Mock the sessionService module
jest.mock('../../src/services/session.service');

// Typecast the mocked sessionService for easier use
const mockedSessionService = sessionService as jest.Mocked<typeof sessionService>;

// // --------------------------------------------------------------
// Edge Case and Error Path Tests for API Controller
// --------------------------------------------------------------
describe('API Controller - Edge Cases and Error Paths', () => {

    // createSession when session already exists 
    it('should return 200 OK when recreating an existing session', async () => {
    const sessionId = 'existing-session';
    // Simulate that the session already exists and is deleted before creation
    mockedSessionService.removeSession.mockReturnValue(true);
    mockedSessionService.createSession.mockReturnValue({ 
        sessionId, 
        currentState: 'Inaktiv', 
        currentFrame: 'LEERER_FRAME', 
        context: { 
            entitaetListe: [], 
            allgemeineListe: [], 
            notfallListe: [], 
            aktuellerEntitaetIndex: 0, 
            aktuellerAllgemeinIndex: 0,
            aktuellerNotfallIndex: 0,
            anzeigeKontext: 'INAKTIV',
            aktuellerFrame: 'LEERER_FRAME',
            herkunftsZustand: ''
        } });

    const response = await request(app).post(`/api/session/${sessionId}`);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('recreated');
  });

  // Test: Error 500 in createSession
  it('should return 500 on unexpected error during session creation', async () => {
    const sessionId = 'error-session';
    // Simulate an unexpected error in the service
    mockedSessionService.createSession.mockImplementation(() => {
      throw new Error('Unexpected data error');
    });

    const response = await request(app).post(`/api/session/${sessionId}`);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Unexpected data error');
  });

  // Test: getSessionState for a non-existent session
  it('should return 404 when getting state for a non-existent session', async () => {
    const sessionId = 'non-existent-session';
    // Simulate that the service throws an error because the session does not exist
    mockedSessionService.getSessionState.mockImplementation(() => {
      throw new Error(`Session ID '${sessionId}' not found.`);
    });

    const response = await request(app).get(`/api/session/${sessionId}/state`);
    
    expect(response.status).toBe(404);
    expect(response.body.error).toContain('not found');
  });

  // Test: getAllSessions when no active sessions are found
  it('should return an empty list when no active sessions are found', async () => {
    // Simulate that the service returns an empty array
    mockedSessionService.getAllSessions.mockReturnValue([]);

    const response = await request(app).get('/api/session/sessions');

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('No active sessions found');
    expect(response.body.count).toBe(0);
  });

  // Test: Error 500 in getAllSessions
  it('should return 500 on unexpected error during getAllSessions', async () => {
    mockedSessionService.getAllSessions.mockImplementation(() => {
      throw new Error('Unexpected service failure');
    });

    const response = await request(app).get('/api/session/sessions');
    
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Unexpected service failure');
  });

  // Test: sendEvent for a non-existent session
  it('should return 400 when sending an event to a non-existent session', async () => {
    const sessionId = 'non-existent-session';
    const event = { type: 'NAECHSTER_FRAME' };
    // Simulate that the service throws an error because the session does not exist
    mockedSessionService.sendEvent.mockImplementation(() => {
      throw new Error(`Session ID '${sessionId}' not found.`);
    });

    const response = await request(app).post(`/api/session/${sessionId}/event`).send(event);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('not found');
  });

});

// --------------------------------------------------------------
// Final Coverage Tests for API Controller
// --------------------------------------------------------------
describe('API Controller - Final Coverage Tests', () => {

  // Test: getAllSessions with active sessions
  it('should return a list of active sessions with a 200 status', async () => {
    const mockSessions: CleanSnapshot[] = [
      { sessionId: 'session1', currentState: 'Inaktiv', currentFrame: 'LEERER_FRAME' , 
        context: {
            entitaetListe: [],
            allgemeineListe: [],
            notfallListe: [],
            aktuellerEntitaetIndex: 0,
            aktuellerAllgemeinIndex: 0,
            aktuellerNotfallIndex: 0,
            anzeigeKontext: 'INAKTIV',
            aktuellerFrame: 'LEERER_FRAME',
            herkunftsZustand: 'INAKTIV'
        }  },
      { sessionId: 'session2', currentState: 'Inaktiv', currentFrame: 'LEERER_FRAME' , 
        context: {
            entitaetListe: [],
            allgemeineListe: [],
            notfallListe: [],
            aktuellerEntitaetIndex: 0,
            aktuellerAllgemeinIndex: 0,
            aktuellerNotfallIndex: 0,
            anzeigeKontext: 'INAKTIV',
            aktuellerFrame: 'LEERER_FRAME',
            herkunftsZustand: 'INAKTIV'
        }  },
    ];
    // Simulate that the service returns an array with two sessions
    mockedSessionService.getAllSessions.mockReturnValue(mockSessions);

    const response = await request(app).get('/api/session/sessions');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.sessions).toEqual(mockSessions);
  });

  // Test: sendEvent with an invalid payload
  it('should return 400 if event object is invalid or missing type', async () => {
    const sessionId = 'any-session';
    const invalidEvent = { action: 'do-something' }; // Object without the 'type' property

    const response = await request(app).post(`/api/session/${sessionId}/event`).send(invalidEvent);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid event object');
  });

  // Test: 500 error on deleteSession
  it('should return 500 on unexpected error during session deletion', async () => {
    const sessionId = 'error-on-delete';
    // Simulate that the service throws an unexpected error when trying to delete
    mockedSessionService.removeSession.mockImplementation(() => {
      throw new Error('Filesystem is read-only');
    });

    const response = await request(app).delete(`/api/session/${sessionId}`);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Filesystem is read-only');
  });

});

