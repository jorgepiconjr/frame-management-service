import request from 'supertest';
import express from 'express';
import { apiRoutes } from '../../src/api/routes';

// Temporäre Express-App nur für den Test
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

/* --------------------------------------------------------------
  Integrationstests für API-Routen
  Tests:
  - POST /api/session/:id
  - POST /api/session/:id/event
  - GET /api/session/:id/state
  - DELETE /api/session/:id
  Beschreibung:
  Diese Tests überprüfen die Integration der API-Routen mit dem Session-Management.
  Sie stellen sicher, dass Sessions korrekt erstellt, verändert, abgerufen und gelöscht werden können.
  -------------------------------------------------------------- */ 

describe('API Integration Tests', () => {

  const SESSION_ID = 'test-session-123';

  // Vor jedem Test die Session aufräumen
  beforeEach(async () => {
    await request(app).delete(`/api/session/${SESSION_ID}`);
  });

  // POST /api/session/:id sollte eine neue Session erstellen und den Anfangszustand zurückgeben 
  it('POST /api/session/:id -> Sollte Session erstellen (Inaktiv)', async () => {
    // 1. Session erstellen
    const res = await request(app).post(`/api/session/${SESSION_ID}`);
    
    // 2. Überprüfen des Anfangszustands
    expect(res.status).toBe(201);
    expect(res.body.cleanSnapshot.currentState).toBe('Inaktiv');
    expect(res.body.cleanSnapshot.currentFrame).toBe('LEERER_FRAME');
  });

  // POST /api/session/:id/event sollte ein Event verarbeiten und den neuen Zustand zurückgeben
  it('POST /api/session/:id/event -> Sollte Liste laden und Zustand ändern', async () => {
    // 1. Session erstellen
    await request(app).post(`/api/session/${SESSION_ID}`);

    // 2. Event senden: Liste laden
    const payload = {
      type: 'LADE_NEUE_LISTE',
      liste: ['Frame1', 'Frame2'],
      kontext: 'ENTITAET'
    };

    const res = await request(app)
      .post(`/api/session/${SESSION_ID}/event`)
      .send(payload);

    // 3. Überprüfen des neuen Zustands
    expect(res.status).toBe(200);
    // Prüfen ob der Zustand jetzt im ArbeitsModus ist
    expect(res.body.currentState).toEqual({ ArbeitsModus: 'ENTITAET' });
    expect(res.body.currentFrame).toBe('Frame1');
  });
  
  // GET /api/session/:id/state sollte den aktuellen Zustand der Session zurückgeben
  it('GET /api/session/:id/state -> Sollte den Zustand persistieren', async () => {
    // 1. Erstellen & Ändern
    await request(app).post(`/api/session/${SESSION_ID}`);
    await request(app).post(`/api/session/${SESSION_ID}/event`).send({
      type: 'LADE_NEUE_LISTE',
      liste: ['A', 'B'],
      kontext: 'ENTITAET'
    });

    // 2. Abrufen (GET)
    const res = await request(app).get(`/api/session/${SESSION_ID}/state`);

    // 3. Überprüfen, ob der Zustand korrekt persistiert wurde
    expect(res.status).toBe(200);
    expect(res.body.currentFrame).toBe('A');
  });

  // DELETE /api/session/:id sollte die Session löschen
  it('DELETE /api/session/:id -> Sollte eine Session korrekt löschen', async () => {
    // 1. VORBEREITUNG: Session erstellen, um sicherzustellen, dass sie existiert
    await request(app).post(`/api/session/${SESSION_ID}`);
    
    // Sanity Check: Prüfen, ob die Session abrufbar ist (sollte 200 OK sein)
    let getStateRes = await request(app).get(`/api/session/${SESSION_ID}/state`);
    expect(getStateRes.status).toBe(200);

    // 2. HAUPTAKTION: Session löschen
    const deleteRes = await request(app).delete(`/api/session/${SESSION_ID}`);
    
    // Erwartung A: Korrekter HTTP-Status für erfolgreiche Löschung ohne Body
    expect(deleteRes.status).toBe(200); 
    
    // 3. VALIDIERUNG: Prüfen, ob die Session wirklich gelöscht wurde
    getStateRes = await request(app).get(`/api/session/${SESSION_ID}/state`);
    
    // Erwartung B: Der GET-Aufruf muss nun 404 (Not Found) zurückgeben
    expect(getStateRes.status).toBe(404);
    expect(getStateRes.body).toEqual({ error: `Session mit der ID '${SESSION_ID}' nicht gefunden.` });
  });
});