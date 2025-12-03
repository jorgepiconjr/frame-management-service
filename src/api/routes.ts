import { Router } from 'express';
import * as controller from './controller';

// Creates a new router instance
const router = Router();

// ----------------------------------------------------
// ENDPOINT DEFINITIONS
// API endpoints are defined here and assigned to the corresponding
// controller functions.
// ----------------------------------------------------

/**
 * Creates a new (or replaces an existing) state machine session.
 * POST /api/session/:sessionId
 */
router.post('/session/:sessionId', controller.createSession);

/**
 * Retrieves the current state (and current frame) of a session.
 * GET /api/session/:sessionId/state
 */
router.get('/session/:sessionId/state', controller.getSessionState);

/**
 * Retrieves all active sessions.
 * GET /api/session/sessions
 */
router.get('/session/sessions', controller.getAllSessions);

/**
 * Sends an event to the state machine to change the state.
 * POST /api/session/:sessionId/event
 */
router.post('/session/:sessionId/event', controller.sendEvent);

/**
 * Stops and deletes a session.
 * DELETE /api/session/:sessionId
 */
router.delete('/session/:sessionId', controller.deleteSession);

// Exports the configured router
export const apiRoutes = router;