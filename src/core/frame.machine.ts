import { setup, assign, raise } from 'xstate';
import type { FrameContext, FrameMachineDefinition } from './machine.types';

// Frame fallback constants
const LEERER_FRAME = 'LEERER_FRAME';
const BESTAETIGUNG_FRAME = 'BESTAETIGUNG_FRAME';

// ----------------------------------------------------
// FRAME STATE MACHINE DEFINITION
// This file defines the State Machine for the Frame Management Service
// with XState 5 setup() API.
// ----------------------------------------------------

/**
 * 1. Initial Context
 * Defines the starting values for the machine context
 */
export const initialContext: FrameContext = {
  entitaetListe: [],
  allgemeineListe: [],
  notfallListe: [],
  aktuellerEntitaetIndex: 0,
  aktuellerAllgemeinIndex: 0,
  aktuellerNotfallIndex: 0,
  anzeigeKontext: 'INAKTIV',
  aktuellerFrame: '',
  herkunftsZustand: 'Inaktiv', // Tracks the source state for emergency mode logic
};

// Helper function to get the active context based on anzeigeKontext
const getActiveContext = (context: FrameContext) => {
  switch (context.anzeigeKontext) {
    case 'ENTITAET':
      return {
        list: context.entitaetListe,
        index: context.aktuellerEntitaetIndex,
        key: 'aktuellerEntitaetIndex' as const
      };
    case 'ALLGEMEIN':
      return {
        list: context.allgemeineListe,
        index: context.aktuellerAllgemeinIndex,
        key: 'aktuellerAllgemeinIndex' as const
      };
    case 'NOTFALL':
      return {
        list: context.notfallListe,
        index: context.aktuellerNotfallIndex,
        key: 'aktuellerNotfallIndex' as const
      };
    default:
      return null;
  }
};

/**
 * 2. State Machine Creation with XState 5 setup()
 * and Definition of Actions, Guards and Types
 */
export const frameMachine = setup({
  // Type safety, defines types for context, events and machine structure
  types: {} as FrameMachineDefinition,

  // ---- Actions ----
  // Actions update the context or perform side effects
  actions: {
    // ---- Context Update Actions ----
    // Loads a new list into the context and resets the index
    setNewList: assign(({ event }) => {
      if (event.type !== 'LADE_NEUE_LISTE') return {};

      const updates: Partial<FrameContext> = {};
      const firstFrame = event.list[0] ?? LEERER_FRAME;

      if (event.context === 'ENTITAET') {
        updates.entitaetListe = event.list;
        updates.aktuellerEntitaetIndex = 0;
        updates.aktuellerFrame = firstFrame;
      } 
      else if (event.context === 'ALLGEMEIN') {
        updates.allgemeineListe = event.list;
        updates.aktuellerAllgemeinIndex = 0;
        updates.aktuellerFrame = firstFrame;
      } 
      else {
        updates.aktuellerFrame = firstFrame;
      }

      return updates;
    }),
    // Initializes emergency mode with the provided emergency list
    initNotfallModus: assign(({ event }) => {
      if (event.type !== 'NOTFALL_EMPFANGEN') return {};
      
      return {
        notfallListe: event.list,
        aktuellerNotfallIndex: 0,
        anzeigeKontext: 'NOTFALL', 
        aktuellerFrame: BESTAETIGUNG_FRAME
      };
    }),
    // ---- Frame Navigation Actions ----
    // Navigates to next/previous frames by updating indices
    frameNavigation: assign(({ context, event }) => {
      const delta = event.type === 'NAECHSTER_FRAME' ? 1 : -1;
      const active = getActiveContext(context);

      if (!active) return {}; 

      const newIndex = active.index + delta;

      // Boundary check
      if (newIndex < 0 || newIndex >= active.list.length) return {};

      return {
        [active.key]: newIndex,
        aktuellerFrame: active.list[newIndex]
      };
    }),
    // Searches for a frame in the current list and updates the index and frame if found
    searchFrame: assign(({ context, event }) => {
      if (event.type !== 'SUCHE_FRAME') return {};
      
      const active = getActiveContext(context);
      if (!active) return {};

      const foundIndex = active.list.indexOf(event.frameName);

      if (foundIndex !== -1) {
        return {
          [active.key]: foundIndex,
          aktuellerFrame: active.list[foundIndex]
        };
      }
      return {}; 
    }),
    // ---- Frame Send Actions ----
    // Sets the current frame based on the active context
    setAktuellerFrame: assign({
      aktuellerFrame: ({ context }) => {
        const active = getActiveContext(context);
        if (!active || !active.list[active.index]) return LEERER_FRAME;
        return active.list[active.index];
      }
    }),
    sendBestaetigungFrame: assign(() => ({ aktuellerFrame: BESTAETIGUNG_FRAME })),
    sendLeererFrame: assign({ aktuellerFrame: LEERER_FRAME }),
  },
  
  // ---- Guards ----
  // Conditions that control transitions based on context and events
  guards: {
    "herkunftIstArbeitsModus": ({ context }) => 
      context.herkunftsZustand === 'ArbeitsModus',
    "herkunftIsInaktiv": ({ context }) => 
      context.herkunftsZustand === 'Inaktiv',
    "isEntitaetKontext": ({ event }) => 
      event.type === 'LADE_NEUE_LISTE' && event.context === 'ENTITAET',
    "isAllgemeinKontext": ({ event }) => 
      event.type === 'LADE_NEUE_LISTE' && event.context === 'ALLGEMEIN',
    "isSameAnzeigeKontext": ({ context, event }) => {
      if (event.type !== 'LADE_NEUE_LISTE') return false;
      return context.anzeigeKontext === event.context;
    },
    "isAntwortTrue": ({ event }) => 
      event.type === 'USER_BESTAETIGT_NOTFALL' && event.accepted === true,
    "hasNextFrame": ({ context }) => {
      const active = getActiveContext(context);
      if (!active || !active.list.length) return false;
      return active.index < active.list.length - 1;
    },
    "hasPreviousFrame": ({ context }) => {
      const active = getActiveContext(context);
      if (!active || !active.list.length) return false;
      return active.index > 0;
    },
  },

  /**
   * 3. Machine Definition
   * Defines states, transitions and global events
   */
}).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QDMBOBDAtmAsugxgBYCWAdmAMQByA8gCoBiAggDIsD6AojgArNUBxTlQDaABgC6iUAAcA9rGIAXYnNLSQAD0QBmABwB2AHQAmEwEYArADZbB8ybEmDAGhABPRAFpz5vUcMATisAFkdLHRDzMT0AX1i3NCxcAhJyCgAtAFUAJSyAYQBpAGVOOgzhcSkkEHlFFTUNbQQrPWsjHWtLRwMnCNs3TwQfPwCDYJDAywMTPR0DOISQJOw8IjIwIwBJUnQAaxUANwoWJgARTnYqTizLli3iuk4qjTrlVXUa5t9Jo2nzAzWJxzSKBEyDRAGSymcyBMTWKGdEIzEKWeKJDCrVIbba7A7EY6nC5XG53B5PETmaqyBTvRpfRDmLrmIz2Ew6BwGeZcmIQhBQmFwhH9ZEmVHo5aYlLrci4-ZHChMLLFYr5AASrCeokkr1pDU+oG+lmCpkMYlhOkCqLEIT0fK8Oj+swBcyiMWNIRCEpW0rSmyYqAARmBlLAcHIIABXWAUVVq+6cFWVHU1N76pqMybGY1mMT6HRiAxcyx88J-ezzT16VHTRYY5JrP1GAPB0PhqMx4oFNWXBg5Jg4Z4pmn1D4ZlqREKmXpWyyerr6Pn2KdiOc2gFWqIRb1Sxs4lshpRhiPR6hMTjqx6cHLsPsDofU2p6scMlpFlmWnT6MxWhEhJfmCua5ROMnpWDoO4NtisoHm2J4xgAajQOQ9jkWxCDed6Di8qbPvShqMmufzWLCYTsmIm7gh4iB6A4rI2noxqFrRMzWJBWIyv6QaHseHYnOclzXLc7D3FeOEjnSBpaIyMTGG01hkSEwq2jofK0SY9G2kxCwAiYbFLD6e4wdxcEdkYnCkCoSjoGASj8cSQlkmJw5PqO+HSROBhTo4gEhBRc7WCY0x8pYNistMSnzIEBZOAY7G+vuJlHu20bNgANmlMDYGQ9mCaSInkg+upuVJ3z6GIHRAlylrspYTJ2tRCBKRpOjOIECyBCRJG0fp9YcU2VByEoyDoBlKWduqCZJtqj5pi+BEICR0LRIE0XMl+nWqY1XiWP4oU6MacJ6XoEyhfFRmbINw2jWl42xpNWyJqUohUsVknjoFGl6PCCx1YBVhefaviOhYvhTECoUIua53QZdQ0jWN8FGAAQnA1m2cQMCkBQyrXuwyOJnQ550OhdBXPQzBsOJrnva+IRfn8ehM1ywQ9JtfL0xVB3yQC8JwlyvWSlBnFGFdCO3UjqOwOjKhYzjpQ3gTjzE6T5OMKwLCUrNeGlYgn2sjMjjfXOJ2tXyBb+F5gRtL431M2KMMi2LN3jc2pAAF4hnLVDnpeTyYf22EuXN7nNMijqWIW1hIhRYIOEu9gdDW5ogYY5gQQZu6w6L8Mu0jTAe17YDY0hKHXuheNYUVuEleOyLtBR6fRK1EMDI1XTGKtZhivTBbdILhnZ87iNmQXnuY8Xsbdr2gfVxJ6avt9LIxEFHrBLtgEhWIFUp9b9OTEiixLKQEZwBog+cW9C8LV+2ZM4YloOIW7PbY47ShVE1hwpaCwr47TY7HlASK+80PJP2hJHAsClgi-lXEDGIfw-DzFCoCCw0cvSZ2Fk2WCyV4IgNDjJUY0RSJKS-jYKiQw9KBFMHmCwVpnCAUnP-RKrZcFmQslZGySh8G6xaPCdoxDNy2HBhQxAkx-DWG+r0JwTgFJWAHlnEWODeKpTVOSZCDx1R42yMrKgZweHjmiAiDo+gphQkBNMVwjU-JAVatMWYehnC7QUVglhPFXZMAyllEMUkQ68L8BYP49crSrmcIxBqQxxFGEkYWbejg9JRDrELfqOJh4Sw7AY18+gIH3xZk-cY0cQoR1jtHC0XQwRKWYbKNJrspYywnr4nWdcvIBGEV0YR8xrB8j8P4A6q0vJfk6GKWYVS4bXRHqlMeRdGm1zptFAI7IxQchOmYcwRSWS2EMGQhEVpGKjKMGcYgxdpZMEDDAWARA0oKFgMXTJC0-C2kZuMMwooTBgi2kMLwURWRKTzLYMwjEHEYPiEAA */
    // Machine definition
    id: 'frameMachine',
    context: initialContext,
    initial: 'Inaktiv',

    // Global Events
    // Events that can be processed from any state
    on: {
      NOTFALL_EMPFANGEN: {
        target: '.NotfallModus',
        actions: 'initNotfallModus',
      },
      ZURUCKSETZEN: {
        target: '.Inaktiv',
        actions: assign(() => ({ ...initialContext })),
      },
    },

    states: {
      // ---- STATE 1: INAKTIV ----
      // Initial state, waits for new lists or shutdown
      Inaktiv: {
        entry: [ 
          'sendLeererFrame' , 
          assign({ herkunftsZustand: 'Inaktiv', anzeigeKontext: 'INAKTIV' }),
        ],
        on: {
          LADE_NEUE_LISTE: [
          {
            guard: 'isEntitaetKontext',
            target: 'ArbeitsModus.Entitaet',
            actions: 'setNewList',
          },
          {
            guard: 'isAllgemeinKontext',
            target: 'ArbeitsModus.Allgemein',
            actions: 'setNewList',
          }
        ],
          AUSSCHALTEN: {
            target: 'DienstAbgeschlossen',
          },
        },
      },

      // ---- STATE 2: ARBEITSMODUS ----
      // Handles entity and general frames with navigation
      // Uses substates for Entitaet and Allgemein
      // as well as a history state to remember the last used substate
      ArbeitsModus: {
        entry: assign({ herkunftsZustand: 'ArbeitsModus' }),
        on: {
          SCHLIESSEN: { target: 'Inaktiv' },
          SUCHE_FRAME: {
            actions: 'searchFrame'
          },
          NAECHSTER_FRAME: {
            guard: 'hasNextFrame',
            actions: 'frameNavigation',
          },
          VORHERIGER_FRAME: {
            guard: 'hasPreviousFrame',
            actions: 'frameNavigation',
          },
          LADE_NEUE_LISTE:{ 
            guard: 'isSameAnzeigeKontext',   
            actions: 'setNewList',
            reenter: true
          },
        },
        initial: 'Entitaet',
        states: {
            // --- SUBSTATE: Entitaet ---
            // Displays entity frames with navigation
          Entitaet: {
            entry: [assign({ anzeigeKontext: 'ENTITAET' }), 'setAktuellerFrame'],
            on: {
              LADE_NEUE_LISTE:{ 
                guard: 'isAllgemeinKontext', 
                target: 'Allgemein', 
                actions: 'setNewList' 
              }
            }
          },
          // --- SUBSTATE: HISTORY_STATE ---
          /**
           * HISTORISCHER_ZUSTAND is a shallow history state.
           * It remembers whether 'Entitaet' or 'Allgemein' was last active within 'ArbeitsModus'.
           * When exiting and re-entering 'ArbeitsModus' (e.g., after emergency mode), the machine returns to the last used substate.
           */
          HISTORISCHER_ZUSTAND: {
            type: 'history',
            history: 'shallow',
          },
          // --- SUBSTATE: Allgemein ---
          // Displays general frames with navigation
          Allgemein: {
            entry: [assign({ anzeigeKontext: 'ALLGEMEIN' }), 'setAktuellerFrame'],
            on: {
              LADE_NEUE_LISTE: { 
                guard: 'isEntitaetKontext', 
                target: 'Entitaet', 
                actions: 'setNewList' 
              }
            }
          }
        }
      },

      // ---- STATE 3: EMERGENCY MODE ----
      // Handles emergency frames with confirmation and navigation
      NotfallModus: {
        initial: 'Bestaetigen',
        entry: assign({ anzeigeKontext: 'NOTFALL' }),
        // Transitions to exit emergency mode based on source state
        on: {
          SCHLIESSEN: [
            {
              guard: 'herkunftIstArbeitsModus',
              target: 'ArbeitsModus.HISTORISCHER_ZUSTAND'
            },
            {
              guard: 'herkunftIsInaktiv',
              target: 'Inaktiv'
            }
          ]
        },
        states: {
          // --- SUBSTATE: BESTAETIGEN ---
          // Asks the user to confirm the emergency mode
          Bestaetigen: {
            entry: 'sendBestaetigungFrame',
            on: {
              USER_BESTAETIGT_NOTFALL: [
                {
                  guard: 'isAntwortTrue',
                  target: 'Anzeigen',              
                },
                {
                  actions: raise({ type: 'SCHLIESSEN' }),
                  target: '#frameMachine.Inaktiv',
                }
              ]
            }
          },
          // --- SUBSTATE: ANZEIGEN ---
          // Displays emergency frames with navigation
          Anzeigen: {
            entry: 'setAktuellerFrame',
            on: {
              NAECHSTER_FRAME: { 
                guard: 'hasNextFrame', 
                actions: 'frameNavigation' 
              },
              VORHERIGER_FRAME: { 
                guard: 'hasPreviousFrame', 
                actions: 'frameNavigation' 
              },
              SUCHE_FRAME: {
                actions: 'searchFrame'
              }
            }
          }
        },
      },

      // ---- STATE 4: FINAL ----
      // Final state when the service is completed
      DienstAbgeschlossen: {
        type: 'final',
        entry: ['sendLeererFrame'],
      }
    },
  });