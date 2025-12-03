import { Request, Response } from 'express';
import { sessionService } from '../services/session.service';
import type { FrameEvent } from '../core/machine.types';

// ----------------------------------------------------
// CONTROLLER FUNCTIONS
// These functions handle HTTP requests and call the corresponding
// methods of the sessionService.
// ----------------------------------------------------

/**
 * POST /api/session/:sessionId
 * Creates (or replaces) a new state machine session.
 * Input: sessionId as URL parameter.
 * Output: The clean snapshot (information) of the newly created session.
 */
export const createSession = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    let wasDeleted = sessionService.removeSession(sessionId);
    const cleanSnapshot = sessionService.createSession(sessionId);
    if (wasDeleted) {
    res.status(200).json({message: `Session ID '${sessionId}' recreated.`, cleanSnapshot});
    } else {
    res.status(201).json({message: `Session ID '${sessionId}' created.`, cleanSnapshot});
    }
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

/**
 * GET /api/session/:sessionId/state
 * Retrieves the current state of a session without modifying it.
 * Input: sessionId as URL parameter.
 * Output: The clean snapshot (information) of the session.
 */
export const getSessionState = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    const cleanSnapshot = sessionService.getSessionState(sessionId);
    res.status(200).json(cleanSnapshot);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
};

/**
 * GET /api/session/sessions
 * Retrieves all active sessions.
 * Output: A list of all active sessions with their clean snapshots.
 */
export const getAllSessions = (req: Request, res: Response) => {
  try {
    const sessions = sessionService.getAllSessions();
    if (sessions.length === 0) {
      res.status(200).json({ message: 'No active sessions found.', count: 0, sessions: [] });
      return;
    }
    res.status(200).json({
      count: sessions.length,
      sessions: sessions,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}; 

/**
 * POST /api/session/:sessionId/event
 * Sends an event to the state machine and returns the NEW state.
 * Input: sessionId as URL parameter and the event in the request body (JSON).
 * Output: The clean snapshot (information) of the session after processing the event.
 */
export const sendEvent = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const event = req.body;

  // Basic validation for FrameEvent structure (customize as needed)
  if (!event || typeof event.type !== 'string') {
    res.status(400).json({ error: 'Invalid event object. Missing required "type" property.' });
    return;
  }

  try {
    const newCleanSnapshot = sessionService.sendEvent(sessionId, event as FrameEvent);
    res.status(200).json(newCleanSnapshot);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

/**
 * DELETE /api/session/:sessionId
 * Deletes a session and stops the actor.
 * Input: sessionId as URL parameter.
 * Output: Confirmation message about the deletion (200 OK).
 */
export const deleteSession = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    let wasDeleted = sessionService.removeSession(sessionId);
    if (!wasDeleted) {
      res.status(404).json({ error: `Session ID '${sessionId}' not found.` });
      return;
    }
    res.status(200).json({ message: `Session ID '${sessionId}' successfully deleted.` });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};
