import request from 'supertest';
import express from 'express';
import { apiRoutes } from '../../src/api/routes';

// Temporary Express app for testing only
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

/* --------------------------------------------------------------
  Integration tests for API routes
  Tests:
  - POST /api/session/:id
  - POST /api/session/:id/event
  - GET /api/session/:id/state
  - DELETE /api/session/:id
  Description:
  These tests verify the integration of API routes with session management.
  They ensure that sessions can be correctly created, modified, retrieved, and deleted.
  -------------------------------------------------------------- */ 

describe('API Integration Tests', () => {

  const SESSION_ID = 'test-session-123';

  // Clean up session before each test
  beforeEach(async () => {
    await request(app).delete(`/api/session/${SESSION_ID}`);
  });

  // POST /api/session/:id should create a new session and return the initial state
  it('POST /api/session/:id -> Should create session (Inactive)', async () => {
    // 1. Create session
    const res = await request(app).post(`/api/session/${SESSION_ID}`);
    
    // 2. Verify initial state
    expect(res.status).toBe(201);
    expect(res.body.cleanSnapshot.currentState).toBe('Inaktiv');
    expect(res.body.cleanSnapshot.currentFrame).toBe('LEERER_FRAME');
  });

  // POST /api/session/:id/event should process an event and return the new state
  it('POST /api/session/:id/event -> Should load list and change state', async () => {
    // 1. Create session
    await request(app).post(`/api/session/${SESSION_ID}`);

    // 2. Send event: load list
    const payload = {
      type: 'LADE_NEUE_LISTE',
      list: ['Frame1', 'Frame2'],
      context: 'ENTITAET'
    };

    const res = await request(app)
      .post(`/api/session/${SESSION_ID}/event`)
      .send(payload);

    // 3. Verify new state
    expect(res.status).toBe(200);
    // Check if state is now in work mode
    expect(res.body.currentState).toEqual({ ArbeitsModus: 'Entitaet' });
    expect(res.body.currentFrame).toBe('Frame1');
  });
  
  // GET /api/session/:id/state should return the current state of the session
  it('GET /api/session/:id/state -> Should persist the state', async () => {
    // 1. Create & modify
    await request(app).post(`/api/session/${SESSION_ID}`);
    await request(app).post(`/api/session/${SESSION_ID}/event`).send({
      type: 'LADE_NEUE_LISTE',
      list: ['A', 'B'],
      context: 'ENTITAET'
    });

    // 2. Retrieve (GET)
    const res = await request(app).get(`/api/session/${SESSION_ID}/state`);

    // 3. Verify that the state was persisted correctly
    expect(res.status).toBe(200);
    expect(res.body.currentFrame).toBe('A');
  });

  // DELETE /api/session/:id should delete the session
  it('DELETE /api/session/:id -> Should correctly delete a session', async () => {
    // 1. SETUP: Create session to ensure it exists
    await request(app).post(`/api/session/${SESSION_ID}`);
    
    // Sanity check: Verify that the session can be retrieved (should be 200 OK)
    let getStateRes = await request(app).get(`/api/session/${SESSION_ID}/state`);
    expect(getStateRes.status).toBe(200);

    // 2. MAIN ACTION: Delete session
    const deleteRes = await request(app).delete(`/api/session/${SESSION_ID}`);
    
    // Expectation A: Correct HTTP status for successful deletion without body
    expect(deleteRes.status).toBe(200); 
    
    // 3. VALIDATION: Verify that the session was actually deleted
    getStateRes = await request(app).get(`/api/session/${SESSION_ID}/state`);
    
    // Expectation B: The GET call must now return 404 (Not Found)
    expect(getStateRes.status).toBe(404);
    expect(getStateRes.body).toEqual({ error: `Session with ID '${SESSION_ID}' not found.` });
  });
});