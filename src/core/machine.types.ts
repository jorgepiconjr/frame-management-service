import { EventObject, ActorRef, Snapshot } from 'xstate';

// ----------------------------------------------------
// Types and interfaces for the State Machine
// Context, events, and snapshots are defined here.
// ----------------------------------------------------


// ----------------------------------------------------
// 1. CONTEXT: The data managed by the State Actor
// ----------------------------------------------------

// Display context to know which type of frame is currently displayed
export type AnzeigeKontext = 'ENTITAET' | 'ALLGEMEIN' | 'NOTFALL' | 'INAKTIV';

// Defines the complete state context (the 'data') of the Frame Machine.
export interface FrameContext {
  // List management
  entitaetListe: string[];
  allgemeineListe: string[];
  notfallListe: string[];
  
  // Pointer management
  aktuellerEntitaetIndex: number;
  aktuellerAllgemeinIndex: number;
  aktuellerNotfallIndex: number;
  
  // Defines which list currently serves as the source
  anzeigeKontext: AnzeigeKontext;
  // Stores the current frame sent to the UI
  aktuellerFrame: string;
  // Stores the state from which the emergency was received
  herkunftsZustand: string;
}

// ----------------------------------------------------
// 2. EVENTS: All possible inputs for the State Machine
// ----------------------------------------------------

// Defines all event types as constants for better maintainability.
export const FrameEventTypes = {
  // Lifecycle
  SCHLIESSEN: 'SCHLIESSEN',
  ZURUCKSETZEN: 'ZURUCKSETZEN',
  AUSSCHALTEN: 'AUSSCHALTEN',
  
  // Navigation
  NAECHSTER_FRAME: 'NAECHSTER_FRAME',
  VORHERIGER_FRAME: 'VORHERIGER_FRAME',
  SUCHE_FRAME: 'SUCHE_FRAME',
  
  // Emergency
  NOTFALL_EMPFANGEN: 'NOTFALL_EMPFANGEN',
  USER_BESTAETIGT_NOTFALL: 'USER_BESTAETIGT_NOTFALL',
  
  // Data
  LADE_NEUE_LISTE: 'LADE_NEUE_LISTE',
} as const;

// Defines all events that the machine can process.
export type FrameEvent =
  // Lifecycle events
  | { type: typeof FrameEventTypes.SCHLIESSEN }
  | { type: typeof FrameEventTypes.ZURUCKSETZEN }
  | { type: typeof FrameEventTypes.AUSSCHALTEN }

  // Navigation events
  | { type: typeof FrameEventTypes.NAECHSTER_FRAME }
  | { type: typeof FrameEventTypes.VORHERIGER_FRAME }
  | { type: typeof FrameEventTypes.SUCHE_FRAME; frameName: string }

  // Emergency events
  | { type: typeof FrameEventTypes.NOTFALL_EMPFANGEN; list: string[] }
  | { type: typeof FrameEventTypes.USER_BESTAETIGT_NOTFALL; accepted: boolean }

  // Data events
  | { type: typeof FrameEventTypes.LADE_NEUE_LISTE; list: string[]; context: 'ENTITAET' | 'ALLGEMEIN' };

// ----------------------------------------------------
// 3. TYPE DEFINITIONS: Machine Types
// ----------------------------------------------------

// A type alias for the Frame Machine definition (configuration).
// This helps with type safety and clarity in the code.
export type FrameMachineDefinition = {
    context: FrameContext,
    events: FrameEvent
    output: void
};

/**
 * Defines the clean, serializable snapshot structure
 * sent to the client (CAIS.ME).
 * This is the 'public' view of the state.
 */
export interface CleanSnapshot {
  currentState: unknown;
  currentFrame: string;
  context: FrameContext;
  sessionId: string;
}