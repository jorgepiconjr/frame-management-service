import {
  createActor,
  ActorRef,
  Snapshot,
  StateFrom,
} from 'xstate';
import { frameMachine } from '../core/frame.machine';
import type { FrameEvent, CleanSnapshot } from '../core/machine.types';

// --------------------------------------------
// Session Service
// Verwaltet State-Machine-Instanzen für Sessions
// Implementiert Singleton- und Proxy-Muster
// --------------------------------------------

// Typ-Definition für den Snapshot unserer spezifischen Maschine
type FrameMachineSnapshot = Snapshot<typeof frameMachine>;

// Typ-Definition für unseren spezifischen Actor
export type FrameActor = ActorRef<FrameMachineSnapshot, FrameEvent>;

// Typ-Definition für den laufenden Snapshot (StateFrom)
type RunningSnapshot = StateFrom<typeof frameMachine>;

class SessionService {
  // Die zentrale Map, die alle aktiven Actor-Instanzen hält.
  private activeSessions: Map<string, FrameActor> = new Map();

  // ----------------------------------------------------
  // Singleton-Implementierung
  // ----------------------------------------------------
  private static instance: SessionService;
  
  private constructor() {}

  // Stellt die globale Singleton-Instanz des Service bereit.
  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Bereinigt einen Snapshot, um nur sichere und relevante Daten
   * an die API-Schicht zurückzugeben.
   */
  private cleanSnapshot(snapshot: FrameMachineSnapshot, sessionId: string): CleanSnapshot {
    if (!snapshot) {
      throw new Error('Ungültiger Snapshot: snapshot ist undefined oder null.');
    }
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Ungültige Session-ID \'' + sessionId + '\': sessionId ist undefined oder leer.');
    }

    const runningSnapshot = snapshot as RunningSnapshot;
    return {
      sessionId: sessionId,
      currentState: runningSnapshot.value,
      currentFrame: runningSnapshot.context.aktuellerFrame,
      context: runningSnapshot.context,
    };
  }

  // ----------------------------------------------------
  // Öffentliche Proxy-Methoden
  // ----------------------------------------------------

  /**
   * Erstellt und startet eine neue Session (Actor) und speichert sie in der Map.
   *
   * @param sessionId Eindeutige ID für die Session.
   * @returns Den initialen Snapshot der erstellten Session.
   */
  public createSession(sessionId: string): CleanSnapshot {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Ungültige Session-ID: sessionId ist undefined oder leer.');
    } 

    // 1. Erstelle einen neuen Actor (State Machine Instanz)
    const actor = createActor(frameMachine) as unknown as FrameActor;

    if (!actor || actor === undefined ) {
      throw new Error('Fehler beim Erstellen des Actors für sessionId: ' + sessionId);
    }

    // 2. Speichere den Actor in der Map
    this.activeSessions.set(sessionId, actor);

    // 3. Starte den Actor, damit er Events empfangen kann
    actor.start();

    return this.cleanSnapshot(actor.getSnapshot(), sessionId);
  }

  /**
   * Stoppt und entfernt eine laufende Session (Actor) aus dem Speicher.
   * @param sessionId Die ID der zu entfernenden Session.
   * @returns `true`, wenn die Session entfernt wurde, `false`, wenn sie nicht existierte.
   */
  public removeSession(sessionId: string): boolean {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Ungültige Session-ID: sessionId ist undefined oder leer.');
    }
    const actor = this.getSession(sessionId);
    
    if (!actor || actor === undefined) {
      return false;
    }

    actor.stop(); // Stoppt die State Machine
    return this.activeSessions.delete(sessionId);
  }

  /**
   * Ruft eine laufende Actor-Instanz anhand ihrer Session-ID ab.
   * @param sessionId Die ID der Session.
   * @returns Die Actor-Instanz oder `undefined`.
   */
  public getSession(sessionId: string): FrameActor | undefined {
    if (!sessionId) {
      throw new Error('Ungültige Session-ID: sessionId ist undefined oder leer.');
    }
    if (!this.activeSessions.has(sessionId)) {
      return undefined;
    }
      return this.activeSessions.get(sessionId);
  }

  // ----------------------------------------------------
  // Öffentliche Proxy-Methoden (Interaktion)
  // ----------------------------------------------------

  /**
   * Sendet ein Event an eine laufende State Machine und gibt deren neuen Zustand zurück.
   * @param sessionId Die ID der Session, die das Event empfangen soll.
   * @param event Das an die Maschine zu sendende FrameEvent.
   * @returns Den neuen Snapshot (Zustand/Kontext) der Maschine.
   */
  public sendEvent(sessionId: string, event: FrameEvent): CleanSnapshot {
    if (!sessionId || !event || typeof event.type === 'undefined') {
      throw new Error('Ungültige Eingabe: sessionId oder event ist undefined oder leer.');
    }
    if (this.getSession(sessionId) === undefined) {
      throw new Error(`Session mit der ID '${sessionId}' nicht gefunden.`);
    }

    const actor = this.getSession(sessionId);

    // Sicherheitsprüfung, falls die Session nicht existiert
    if (!actor || actor === undefined) {
      throw new Error(`Session mit der ID '${sessionId}' nicht gefunden.`);
    }

    // 1. Sende das Event an die Maschine
    actor.send(event);

    // 2. Gib den *neuen* resultierenden Zustand zurück
    return this.cleanSnapshot(actor.getSnapshot(), sessionId);
  }

  /**
   * Ruft den aktuellen Zustand (Snapshot) einer Session ab, ohne ein Event zu senden.
   * (Dies ist eine Hilfsmethode für den GET /state Endpunkt)
   *
   * @param sessionId Die ID der Session.
   * @returns Den aktuellen Snapshot der Maschine.
   */
  public getSessionState(sessionId: string): CleanSnapshot {
    if (!sessionId) {
      throw new Error('Ungültige Session-ID: sessionId ist undefined oder leer.');
    }
    if (this.getSession(sessionId) === undefined) {
      throw new Error(`Session mit der ID '${sessionId}' nicht gefunden.`);
    }

    const actor = this.getSession(sessionId);

    if (!actor || actor === undefined) {
      throw new Error(`Session mit der ID '${sessionId}' nicht gefunden.`);
    }

    return this.cleanSnapshot(actor.getSnapshot(), sessionId);
  }

  /**
   * Ruft alle aktiven Sessions und deren Snapshots ab.
   * @returns Eine Liste aller aktiven Sessions mit deren sauberen Snapshots.
   */
  public getAllSessions(): CleanSnapshot[] {
    const sessions: CleanSnapshot[] = [];
    for (const [sessionId, actor] of this.activeSessions.entries()) {
      sessions.push(this.cleanSnapshot(actor.getSnapshot(), sessionId));
    }
    return sessions;
  }
}

// Exportiert die EINE Singleton-Instanz für die gesamte Anwendung
export const sessionService = SessionService.getInstance();