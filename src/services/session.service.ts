import {
  createActor,
  ActorRef,
  Snapshot,
  StateFrom,
} from 'xstate';
import { frameMachine } from '../core/frame.machine';
import type { FrameEvent, CleanSnapshot } from '../core/machine.types';
import { FrameEventTypes } from '../core/machine.types';

// --------------------------------------------
// Session Service
// Manages State-Machine instances for sessions
// --------------------------------------------

// Type definition for the snapshot of our specific machine
type FrameMachineSnapshot = Snapshot<typeof frameMachine>;
// Type definition for our specific Actor
export type FrameActor = ActorRef<FrameMachineSnapshot, FrameEvent>;
// Type definition for the running snapshot (StateFrom)
type RunningSnapshot = StateFrom<typeof frameMachine>;

class SessionService {
  // The central Map that holds all active Actor instances.
  private activeSessions: Map<string, FrameActor> = new Map();
  // ----------------------------------------------------
  // Singleton Implementation
  // ----------------------------------------------------
  private static instance: SessionService;
  
  private constructor() {}

  // Provides the global Singleton instance of the service.
  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Cleans a snapshot to return only safe and relevant data
   * to the API layer.
   */
  private cleanSnapshot(snapshot: FrameMachineSnapshot, sessionId: string): CleanSnapshot {
    if (!snapshot) {
      throw new Error('Invalid snapshot: snapshot is undefined or null.');
    }
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Invalid Session-ID \'' + sessionId + '\': sessionId is undefined or empty.');
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
  // Public Proxy Methods
  // ----------------------------------------------------

  /**
   * Creates and starts a new session (Actor) and stores it in the Map.
   *
   * @param sessionId Unique ID for the session.
   * @returns The initial snapshot of the created session.
   */
  public createSession(sessionId: string): CleanSnapshot {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Invalid Session-ID: sessionId is undefined or empty.');
    } 

    // 1. Create a new Actor (State Machine instance)
    const actor = createActor(frameMachine) as unknown as FrameActor;

    // 2. Store the Actor in the Map
    this.activeSessions.set(sessionId, actor);

    // 3. Start the Actor so it can receive events
    actor.start();

    return this.cleanSnapshot(actor.getSnapshot(), sessionId);
  }

  /**
   * Stops and removes a running session (Actor) from memory.
   * @param sessionId The ID of the session to remove.
   * @returns `true` if the session was removed, `false` if it did not exist.
   */
  public removeSession(sessionId: string): boolean {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Invalid Session-ID: sessionId is undefined or empty.');
    }
    const actor = this.getSession(sessionId);
    
    if (!actor || actor === undefined) {
      return false;
    }

    actor.stop(); // Stops the State Machine
    return this.activeSessions.delete(sessionId);
  }

  /**
   * Retrieves a running Actor instance by its Session-ID.
   * @param sessionId The ID of the session.
   * @returns The Actor instance or `undefined`.
   */
  public getSession(sessionId: string): FrameActor | undefined {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Invalid Session-ID: sessionId is undefined or empty.');
    }
    if (!this.activeSessions.has(sessionId)) {
      return undefined;
    }
      return this.activeSessions.get(sessionId);
  }

  // ----------------------------------------------------
  // Public Proxy Methods (Interaction)
  // ----------------------------------------------------

  /**
   * Sends an event to a running State Machine and returns its new state.
   * @param sessionId The ID of the session that should receive the event.
   * @param event The FrameEvent to send to the machine.
   * @returns The new snapshot (state/context) of the machine.
   */
  public sendEvent(sessionId: string, event: FrameEvent): CleanSnapshot {
    if (!sessionId 
        || !event 
        || typeof event.type === 'undefined' 
        || sessionId.trim() === ''
        || event.type.toString().trim() === ''
        || !Object.values(FrameEventTypes).includes(event.type as any)
      ) {
      throw new Error('Invalid input: sessionId or event is undefined or empty.');
    }
    if (this.getSession(sessionId) === undefined) {
      throw new Error(`Session with ID '${sessionId}' not found.`);
    }

    const actor = this.getSession(sessionId);

    // Security check in case the session does not exist
    if (!actor || actor === undefined) {
      throw new Error(`Session with ID '${sessionId}' not found.`);
    }

    // 1. Send the event to the machine
    actor.send(event);

    // 2. Return the *new* resulting state
    return this.cleanSnapshot(actor.getSnapshot(), sessionId);
  }

  /**
   * Retrieves the current state (snapshot) of a session without sending an event.
   * (This is a helper method for the GET /state endpoint)
   *
   * @param sessionId The ID of the session.
   * @returns The current snapshot of the machine.
   */
  public getSessionState(sessionId: string): CleanSnapshot {
    if (!sessionId) {
      throw new Error('Invalid Session-ID: sessionId is undefined or empty.');
    }
    if (this.getSession(sessionId) === undefined) {
      throw new Error(`Session with ID '${sessionId}' not found.`);
    }

    const actor = this.getSession(sessionId);

    if (!actor || actor === undefined) {
      throw new Error(`Session with ID '${sessionId}' not found.`);
    }

    return this.cleanSnapshot(actor.getSnapshot(), sessionId);
  }

  /**
   * Retrieves all active sessions and their snapshots.
   * @returns A list of all active sessions with their clean snapshots.
   */
  public getAllSessions(): CleanSnapshot[] {
    const sessions: CleanSnapshot[] = [];
    for (const [sessionId, actor] of this.activeSessions.entries()) {
      sessions.push(this.cleanSnapshot(actor.getSnapshot(), sessionId));
    }
    return sessions;
  }
}

// Exports the ONE Singleton instance for the entire application
export const sessionService = SessionService.getInstance();