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
    /** @xstate-layout N4IgpgJg5mDOIC5QDMBOBDAtmAsugxgBYCWAdmAMQByA8gCoBiAggDIsD6AojgArNUBxTlQDaABgC6iUAAcA9rGIAXYnNLSQAD0QBmAOwBOAHQ6AbGIM6DpgKxiALAZs6ANCACeiALQAmU6aN7MRsARnMQuz0fMR8dAF84tzQsXAIScgoALQBVACVsgGEAaQBlTjpM4XEpJBB5RRU1DW0EMPsQkwMxPQj-Hps9Vw9vP3sjHx89Q0mZkKd7BKSMbDwiMjAjAElSdABrFQA3ChYmABFOdipObIuWTZK6TmqNeuVVdVqWkJ0zIxtTAxdWJiAEhAAcQ08CDsRhB9mcP267R0DkWIGSKzS6y2O32xCOJ3Ol2ut3ujxEIRqsgUbyan0QIT0pjGIUZ9n8PgiIT8bihMLhCJRemRYgiaIxqTW5Bxe0OFCY2RKJQKAAlWI9RJIXjTGh9QF8wU4TCELFZgvYwWD7LzvJbAj52ZzkQMuqZxctJekNkxUAAjMDKWA4OQQACusAoypVd04SqqWtqr11zQZthsgR08MmVgtFtMNtaYI6QVZYitfgM8JCC0S6I9qy9Rh9-sDwbDEZKhRVFwYuSYOCeCepDXeKda9nsPnGNkdKP0pm++eGCGFY05PiLTh0-z0NgM7pSDexzYDSiDIfD1CYnFVD04uXYvf7g6pdR1o-pCGifiMYJ8LsMYIzCXKFV3GblLWcF0DD-A9MSlb0-VPc92woAA1Ghcm7XJNiEB8nwHZ5E3fOl9QZHoxE6UVHAGGxnAdAsrTGTN9DCJkInsH44M9Y8kNbC8I0JC4rhudg7jvIjh1pPUtAZOY9GNcwgkMGD7F3RiJxMTielMdiZx0HxuKPaUT349sjGEOhNjoa86GOM5hJJMSyRfbUR1I2Tx1sEwwT0CE1InbcfgLNSFJ8Aw2L8cLul8oysRMvizzbcMmzYIQB02Kh7KJETSQkoc33cmSviiYxd0tQY9G6QxIUQAZKIdMJnFMJjrHiWsJWMjYqDkJRkHQAAbAbko7VUYzjTVXyTD8yOhaxxgnUUbDBOxlt0gsvD8wJHFsQEN1ZQYQjihCjB6vrBuGgTIzGzZYzKURKTc6Sx3CP5fOFCKJgMnwNogoxLEmAE7G+sI3Q6+t4u63r+qGkajAAITgJR0DAFQYFIChFXvdh4djGzylwuhLnoZg2Ekwrns-TidDeiqrG5bo2pC-8jGZCZORsWJYhsY7GzOmHLvMxHYGR1HiHRzGygfXGHlswnicYVgWApKaSOKxAAv+w1J0rCxdwiGwCx0Vlf0raJDHZMR9EzXnsX5i64aYUgAC8Awlqhr1vR58L7QiCumjyWgtBrzH0YVTGNvyrcYk1WccTiF1MaIyyO8HD0h07oYdgSmxdt2wAxjCsPvXDsYI1ziKKsdQtZiOLX0Ms64LfwwX+gwoj88FwuFMFbele3YZzp3XfFgvIy7HtfYrqTk0-MFRVhP86MrCLlurAs7Eo6jVMzSxmV7tFSBDOANE6yGntn2afg6MxTWsOwaNqhAvG3MYy1FDlzdsGslnTk7tllPiC+M1PIREsCYOEJpGRmG3L9FmRZ1wQhRLpK0+407wUbKZJKAlgGBzkj+UIKI6KligXoAsow24AjEA4B05g6I-zrH-TBiUUIpUstZWyuD1atDmOmV0vkBhWHXAYDeZYjAmiTnuboVsHA83QTxBKLZsHmRVGSTC9xVTYxyLLKgpwuFjgOmMQhwRQhQNFGQ5cVhjBWlBGCcwjNqFyN-hg3iSjWGwFSiwdKnBMr6M-NEO0oMzAQgXPPJOojW4SIsOCfwO0Bh9yhudQe7Y-FXxWrTXy9NzZM2XBuEw9DORVT-FVJkB9nEKMSQLOGwtRZowLqkzyakaYGScFbB01g-wgVTDTaIM4SyyP3noBJmckmCxSsPfOMkA7cMcDTP8BlOLggMBMEIG9ja118kDXSlYVrDNOMQAuIsmC+hgLAIgA0FCwHqZXSms1ORiIjgZcwydObWmXF4Vkb9bAOnnlmduyyEgJCAA */
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