import { EventObject, ActorRef, Snapshot } from 'xstate';

// ----------------------------------------------------
// Typen und Schnittstellen für die State Machine
// Hier werden die Kontexte, Events und Snapshots definiert.
// ----------------------------------------------------


// ----------------------------------------------------
// 1. CONTEXT: Die Daten, die der State Actor verwaltet
// ----------------------------------------------------

// AnzeigeKontext, um zu wissen, welche Art von Frame derzeit angezeigt wird
export type AnzeigeKontext = 'ENTITAET' | 'ALLGEMEIN' | 'NOTFALL' | 'INAKTIV';

// Definiert den vollständigen Zustandskontext (die 'Daten') der Frame Machine.
export interface FrameContext {
  // Listen-Management
  entitaetListe: string[];
  allgemeineListe: string[];
  notfallListe: string[];
  
  // Zeiger-Management
  aktuellerEntitaetIndex: number;
  aktuellerAllgemeinIndex: number;
  aktuellerNotfallIndex: number;
  
  // Definiert, welche Liste derzeit als Quelle dient
  anzeigeKontext: AnzeigeKontext;
  // Speichert den aktuellen Frame, der an die UI gesendet wird
  aktuellerFrame: string;
  // Speichert den Zustand, aus dem der Notfall empfangen wurde
  herkunftsZustand: string;
}

// ----------------------------------------------------
// 2. EVENTS: Alle möglichen Eingaben für die State Machine
// ----------------------------------------------------

// Definiert alle Events, welche die Maschine verarbeiten kann.
export type FrameEvent =
  // Lebenszyklus-Events
  | { type: 'SCHLIESSEN' }
  | { type: 'ZURUCKSETZEN' }
  | { type: 'AUSSCHALTEN' }

  // Navigations-Events
  | { type: 'NAECHSTER_FRAME' }
  | { type: 'VORHERIGER_FRAME' }
  | { type: 'SUCHE_FRAME', frameName: string }

  // Notfall-Events
  | { type: 'NOTFALL_EMPFANGEN'; notfallListe: string[] }
  | { type: 'USER_BESTAETIGT_NOTFALL'; bestaetigung: boolean }

  // Daten-Events
  | { type: 'LADE_NEUE_LISTE'; liste: string[]; kontext: 'ENTITAET' | 'ALLGEMEIN' }
;

// ----------------------------------------------------
// 3. TYP-DEFINITIONEN: Machine-Typen
// ----------------------------------------------------

// Ein Typ-Alias für die Definition der Frame Machine (Konfiguration).
// Dies hilft bei der Typensicherheit und Klarheit im Code.
export type FrameMachineDefinition = {
    context: FrameContext,
    events: FrameEvent
    output: void
};

/**
 * Definiert die saubere, serialisierbare Snapshot-Struktur,
 * die an den Client (CAIS.ME) gesendet wird.
 * Dies ist die 'öffentliche' Sicht auf den Zustand.
 */
export interface CleanSnapshot {
  currentState: unknown;
  currentFrame: string;
  context: FrameContext;
  sessionId: string;
}