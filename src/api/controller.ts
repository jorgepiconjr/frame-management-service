import { Request, Response } from 'express';
import { sessionService } from '../services/session.service';
import type { FrameEvent } from '../core/machine.types';

// ----------------------------------------------------
// CONTROLLER-FUNKTIONEN
// Diese Funktionen verarbeiten HTTP-Anfragen und rufen die entsprechenden
// Methoden des sessionService auf.
// ----------------------------------------------------

/**
 * POST /api/session/:sessionId
 * Erstellt (oder ersetzt) eine neue State-Machine-Sitzung.
 * Eingabe: sessionId als URL-Parameter.
 * Ausgabe: Der saubere Snapshot(Information) der neu erstellten Sitzung.
 */
export const createSession = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    let result = sessionService.removeSession(sessionId);
    const cleanSnapshot = sessionService.createSession(sessionId);
    if (result) {
    res.status(200).json({message: `Sitzung-ID '${sessionId}' neu erstellt.`, cleanSnapshot});
    } else {
    res.status(201).json({message: `Sitzung-ID '${sessionId}' erstellt.`, cleanSnapshot});
    }
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

/**
 * GET /api/session/:sessionId/state
 * Ruft den aktuellen Zustand einer Sitzung ab, ohne ihn zu ändern.
 * Eingabe: sessionId als URL-Parameter.
 * Ausgabe: Der saubere Snapshot(Information) der Sitzung.
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
 * Ruft alle aktiven Sitzungen ab.
 * Ausgabe: Eine Liste aller aktiven Sitzungen mit deren sauberen Snapshots.
 */
export const getAllSessions = (req: Request, res: Response) => {
  try {
    const sessions = sessionService.getAllSessions();
    if (sessions.length === 0) {
      res.status(200).json({ message: 'Keine aktiven Sitzungen gefunden.', count: 0, sessions: [] });
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
 * Sendet ein Event an die Maschine und gibt den NEUEN Zustand zurück.
 * Eingabe: sessionId als URL-Parameter und das Event im Anfragekörper(JSON Request body).
 * Ausgabe: Der saubere Snapshot(Information) der Sitzung nach Verarbeitung des Events.
 */
export const sendEvent = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const event = req.body as FrameEvent;

  try {
    const newCleanSnapshot = sessionService.sendEvent(sessionId, event);
    res.status(200).json(newCleanSnapshot);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

/**
 * DELETE /api/session/:sessionId
 * Löscht eine Sitzung und stoppt den Actor.
 * Eingabe: sessionId als URL-Parameter.
 * Ausgabe: Bestätigungsnachricht über die Löschung (200 OK).
 */
export const deleteSession = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    let result = sessionService.removeSession(sessionId);
    if (!result) {
      res.status(404).json({ error: `Sitzung-ID '${sessionId}' nicht gefunden.` });
      return;
    }
    res.status(200).json({ message: `Sitzung-ID '${sessionId}' erfolgreich gelöscht.` });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};
