import { Router } from 'express';
import * as controller from './controller';

// Erstellt eine neue Router-Instanz
const router = Router();

// ----------------------------------------------------
// ENDPUNKT-DEFINITIONEN
// Hier werden die API-Endpunkte definiert und den entsprechenden
// Controller-Funktionen zugewiesen.
// ----------------------------------------------------

/**
 * Erstellt eine neue (oder ersetzt eine bestehende) State-Machine-Sitzung.
 * POST /api/session/:sessionId
 */
router.post('/session/:sessionId', controller.createSession);

/**
 * Ruft den aktuellen Zustand (und den aktuellen Frame) einer Sitzung ab.
 * GET /api/session/:sessionId/state
 */
router.get('/session/:sessionId/state', controller.getSessionState);

/**
 * Ruft alle aktiven Sitzungen ab.
 * GET /api/session/sessions
 */
router.get('/session/sessions', controller.getAllSessions);

/**
 * Sendet ein Event an die State Machine, um den Zustand zu ändern.
 * POST /api/session/:sessionId/event
 */
router.post('/session/:sessionId/event', controller.sendEvent);

/**
 * Stoppt und löscht eine Sitzung.
 * DELETE /api/session/:sessionId
 */
router.delete('/session/:sessionId', controller.deleteSession);

// Exportiert den konfigurierten Router
export const apiRoutes = router;