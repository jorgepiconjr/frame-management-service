import { setup, createMachine, assign, raise } from 'xstate';
import type { FrameContext, FrameMachineDefinition } from './machine.types';

// ----------------------------------------------------
// FRAME STATE MACHINE DEFINITION
// Diese Datei definiert die State Machine für das Frame-Management-Service
// mit XState 5 setup() API.
// ----------------------------------------------------

/**
 * 1. Initialer Kontext
 * Definiert die Startwerte für den Maschinenkontext
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
  herkunftsZustand: 'Inaktiv', // Trackt den Ursprungszustand für Notfallmodus-Logik
};

// Hilfsfunktion, um den aktiven Kontext basierend auf anzeigeKontext zu erhalten
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
 * 2. Erstellung der State Machine mit XState 5 setup()
 * und Definition von Aktionen, Guards und Typen
 */
export const frameMachine = setup({
  // Typsicherheit, definiert die Typen für Kontext, Events und Maschinenstruktur
  types: {} as FrameMachineDefinition,

  // ---- Aktionen ----
  // Aktionen aktualisieren den Kontext oder führen Nebenwirkungen aus
  actions: {
    // ---- Kontext-Aktualisierungsaktionen ----
    // Lädt eine neue Liste in den Kontext und setzt den Index zurück
    setNeueListe: assign(({ event }) => {
      if (event.type !== 'LADE_NEUE_LISTE') return {};

      const updates: Partial<FrameContext> = {};
      const firstFrame = event.liste[0] ?? 'LEERER_FRAME';

      if (event.kontext === 'ENTITAET') {
        updates.entitaetListe = event.liste;
        updates.aktuellerEntitaetIndex = 0;
        updates.aktuellerFrame = firstFrame;
      } 
      else if (event.kontext === 'ALLGEMEIN') {
        updates.allgemeineListe = event.liste;
        updates.aktuellerAllgemeinIndex = 0;
        updates.aktuellerFrame = firstFrame;
      }

      return updates;
    }),
    // Initialisiert den Notfallmodus mit der übergebenen Notfall-Liste
    initNotfall: assign(({ event }) => {
      if (event.type !== 'NOTFALL_EMPFANGEN') return {};
      
      return {
        notfallListe: event.notfallListe,
        aktuellerNotfallIndex: 0,
        anzeigeKontext: 'NOTFALL', 
        aktuellerFrame: 'BESTAETIGUNG_FRAME'
      };
    }),
    // ---- Frame-Navigationsaktionen ----
    // Navigiert zu nächsten/vorherigen Frames durch Aktualisierung der Indizes
    frameNavigation: assign(({ context, event }) => {
      const delta = event.type === 'NAECHSTER_FRAME' ? 1 : -1;
      const active = getActiveContext(context);

      if (!active) return {}; 

      const newIndex = active.index + delta;

      // Grenzprüfung
      if (newIndex < 0 || newIndex >= active.list.length) return {};

      return {
        [active.key]: newIndex,
        aktuellerFrame: active.list[newIndex]
      };
    }),
    // Sucht einen Frame in der aktuellen Liste und aktualisiert den Index und Frame, wenn gefunden
    sucheFrameInAktuellerListe: assign(({ context, event }) => {
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
    // ---- Frame-Sendeaktionen ----
    // Setzt den aktuellen Frame basierend auf dem aktiven Kontext
    setaktuellerFrame: assign({
      aktuellerFrame: ({ context }) => {
        const active = getActiveContext(context);
        if (!active || !active.list[active.index]) return 'LEERER_FRAME';
        return active.list[active.index];
      }
    }),
    sendeBestaetigungFrameAnUi: assign({ aktuellerFrame: 'BESTAETIGUNG_FRAME' }),
    sendeLeerenFrameAnUi: assign({ aktuellerFrame: 'LEERER_FRAME' }),
  },
  
  // ---- Guards ----
  // Bedingungen, die Übergänge basierend auf Kontext und Events steuern
  guards: {
    "herkunftIstArbeitsModus": ({ context }) => 
      context.herkunftsZustand === 'ArbeitsModus',
    "herkunftIstInaktiv": ({ context }) => 
      context.herkunftsZustand === 'Inaktiv',
    "isEntitaetKontext": ({ event }) => 
      event.type === 'LADE_NEUE_LISTE' && event.kontext === 'ENTITAET',
    "isAllgemeinKontext": ({ event }) => 
      event.type === 'LADE_NEUE_LISTE' && event.kontext === 'ALLGEMEIN',
    "isGleichKontext": ({ context, event }) => {
      if (event.type !== 'LADE_NEUE_LISTE') return false;
      return context.anzeigeKontext === event.kontext;
    },
    "isAntwortTrue": ({ event }) => 
      event.type === 'USER_BESTAETIGT_NOTFALL' && event.bestaetigung === true,
    "hatNaechstenFrame": ({ context }) => {
      const active = getActiveContext(context);
      if (!active || !active.list.length) return false;
      return active.index < active.list.length - 1;
    },
    "hatVorherigenFrame": ({ context }) => {
      const active = getActiveContext(context);
      if (!active || !active.list.length) return false;
      return active.index > 0;
    },
  },

  /**
   * 3. Maschinendefinition (Basis-Struktur)
   * Definiert Zustände, Übergänge und globale Events
   */
}).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QDMBOBDAtmAsugxgBYCWAdmAMQByA8gCoBiAggDIsD6AojgArNUBxTlQDaABgC6iUAAcA9rGIAXYnNLSQAD0QBmAOwBOAHQ6AbGIM6DpgKxiALAZs6ANCACeiALQAmU6aN7MRsARnMQuz0fMR8dAF84tzQsXAIScgoALQBVACVsgGEAaQBlTjpM4XEpJBB5RRU1DW0EMPsQkwMxPQj-Hps9Vw9vP3sjHx89Q0mZkKd7BKSMbDwiMjAjAElSdABrFQA3ChYmABFOdipObIuWTZK6TmqNeuVVdVqWkJ0zIxtTAxdWJiAEhAAcQ08CDsRhB9mcP267R0DkWIGSKzS6y2O32xCOJ3Ol2ut3ujxEIRqsgUbyan0QIT0pjGIUZ9n8PgiIT8bihMLhCJRemRYgiaIxqTW5Bxe0OFCY2RKJQKAAlWI9RJIXjTGh9QF8wU4TCELFZgvYwWD7LzvJbAj52ZzkQMuqZxctJekNkxUAAjMDKWA4OQQACusAoypVd04SqqWtqr11zQZthsgR08MmVgtFtMNtaYI6QVZYitfgM8JCC0S6I9qy9Rh9-sDwbDEZKhRVFwYuSYOCeCepDXeKda9nsPnGNkdKP0pm++eGCGFY05PiLTh0-z0NgM7pSDexzYDSiDIfD1CYnFVD04uXYvf7g6pdR1o-pCGifiMYJ8LsMYIzCXKFV3GblLWcF0DD-A9MSlb0-VPc92woAA1Ghcm7XJNiEB8nwHZ5E3fOl9QZHoxE6UVHAGGxnAdAsrTGTN9DCJkInsH44M9Y8kNbC8I0JC4rhudg7jvIjh1pPUtAZOY9GNcwgkMGD7F3RiJxMTielMdiZx0HxuKPaUT349sjGEOhNjoa86GOM5hJJMSyRfbUR1I2Tx1sEwwT0CE1InbcfgLNSFJ8Aw2L8cLul8oysRMvizzbcMmzYIQB02Kh7KJETSQkoc33cmSviiYxd0tQY9G6QxIUQAZKIdMJnFMJjrHiWsJWMjYqDkJRkHQAAbAbko7VUYzjTVXyTD8yOhaxxgnUUbDBOxlt0gsvD8wJHFsQEN1ZQYQjihCjB6vrBuGgTIzGzZYzKURKTc6Sx3CP5fOFCKJgMnwNogoxLEmAE7G+sI3Q6+t4u63r+qGkajAAITgJR0DAFQYFIChFXvdh4djGzylwuhLnoZg2Ekwrns-TidDeiqrG5bo2pC-8jGZCZORsWJYhsY7GzOmHLvMxHYGR1HiHRzGygfXGHlswnicYVgWApKaSOKxAAv+w1J0rCxdwiGwCx0Vlf0raJDHZMR9EzXnsX5i64aYUgAC8Awlqhr1vR58L7QiCumjyWgtBrzH0YVTGNvyrcYk1WccTiF1MaIyyO8HD0h07oYdgSmxdt2wAxjCsPvXDsYI1ziKKsdQtZiOLX0Ms64LfwwX+gwoj88FwuFMFbele3YZzp3XfFgvIy7HtfYrqTk0-MFRVhP86MrCLlurAs7Eo6jVMzSxmV7tFSBDOANE6yGntn2afg6MxTWsOwaNqhAvG3MYy1FDlzdsGslnTk7tllPiC+M1PIREsCYOEJpGRmG3L9FmRZ1wQhRLpK0+407wUbKZJKAlgGBzkj+UIKI6KligXoAsow24AjEA4B05g6I-zrH-TBiUUIpUstZWyuD1atDmOmV0vkBhWHXAYDeZYjAmiTnuboVsHA83QTxBKLZsHmRVGSTC9xVTYxyLLKgpwuFjgOmMQhwRQhQNFGQ5cVhjBWlBGCcwjNqFyN-hg3iSjWGwFSiwdKnBMr6M-NEO0oMzAQgXPPJOojW4SIsOCfwO0Bh9yhudQe7Y-FXxWrTXy9NzZM2XBuEw9DORVT-FVJkB9nEKMSQLOGwtRZowLqkzyakaYGScFbB01g-wgVTDTaIM4SyyP3noBJmckmCxSsPfOMkA7cMcDTP8BlOLggMBMEIG9ja118kDXSlYVrDNOMQAuIsmC+hgLAIgA0FCwHqZXSms1ORiIjgZcwydObWmXF4Vkb9bAOnnlmduyyEgJCAA */
    // Maschinendefinition
    id: 'frameMachine',
    context: initialContext,
    initial: 'Inaktiv',

    // Globale Events
    // Events, die von jedem Zustand aus verarbeitet werden können
    on: {
      NOTFALL_EMPFANGEN: {
        target: '.NotfallModus',
        actions: 'initNotfall',
      },
      ZURUCKSETZEN: {
        target: '.Inaktiv',
        actions: assign(initialContext),
      },
    },

    states: {
      // ---- ZUSTAND 1: INAKTIV ----
      // Initialer Zustand, wartet auf neue Listen oder Ausschalten
      Inaktiv: {
        entry: [ 
          'sendeLeerenFrameAnUi' , 
          assign({ herkunftsZustand: 'Inaktiv', anzeigeKontext: 'INAKTIV' }),
        ],
        on: {
          LADE_NEUE_LISTE: [
          {
            guard: 'isEntitaetKontext',
            target: 'ArbeitsModus.ENTITAET',
            actions: 'setNeueListe',
          },
          {
            guard: 'isAllgemeinKontext',
            target: 'ArbeitsModus.ALLGEMEIN',
            actions: 'setNeueListe',
          }
        ],
          AUSSCHALTEN: {
            target: 'DienstAbgeschlossen',
          },
        },
      },

      // ---- ZUSTAND 2: ARBEITSMODUS ----
      // Behandelt Entitäts- und Allgemein-Frames mit Navigation
      // Verwendet Subzustände für ENTITAET und ALLGEMEIN
      // sowie einen History-Zustand, um den zuletzt verwendeten Subzustand zu merken
      ArbeitsModus: {
        entry: assign({ herkunftsZustand: 'ArbeitsModus' }),
        on: {
          SCHLIESSEN: { target: 'Inaktiv' },
          SUCHE_FRAME: {
            actions: 'sucheFrameInAktuellerListe'
          },
          NAECHSTER_FRAME: {
            guard: 'hatNaechstenFrame',
            actions: 'frameNavigation',
          },
          VORHERIGER_FRAME: {
            guard: 'hatVorherigenFrame',
            actions: 'frameNavigation',
          },
          LADE_NEUE_LISTE:{ 
            guard: 'isGleichKontext',   
            actions: 'setNeueListe',
            reenter: true
          },
        },
        initial: 'ENTITAET',
        states: {
            // --- SUBSTATE: ENTITAET ---
            // Zeigt Entitäts-Frames mit Navigation
          ENTITAET: {
            entry: [assign({ anzeigeKontext: 'ENTITAET' }), 'setaktuellerFrame'],
            on: {
              LADE_NEUE_LISTE:{ 
                guard: 'isAllgemeinKontext', 
                target: 'ALLGEMEIN', 
                actions: 'setNeueListe' 
              }
            }
          },
          // --- SUBSTATE: HISTORISCHER_ZUSTAND ---
            // Shallow-History-Zustand, merkt sich den zuletzt aktiven Subzustand (ENTITAET oder ALLGEMEIN)
            // Wird genutzt, um nach Verlassen des Notfallmodus wieder in den zuvor verwendeten Subzustand zu springen
          HISTORISCHER_ZUSTAND: {
            type: 'history',
            history: 'shallow',
          },
          // --- SUBSTATE: ALLGEMEIN ---
          // Zeigt Allgemeine Frames mit Navigation
          ALLGEMEIN: {
            entry: [assign({ anzeigeKontext: 'ALLGEMEIN' }), 'setaktuellerFrame'],
            on: {
              LADE_NEUE_LISTE: { 
                guard: 'isEntitaetKontext', 
                target: 'ENTITAET', 
                actions: 'setNeueListe' 
              }
            }
          }
        }
      },

      // ---- ZUSTAND 3: NOTFALLMODUS ----
      // Handhabt Notfall-Frames mit Bestätigung und Navigation
      NotfallModus: {
        initial: 'Bestaetigen',
        entry: assign({ anzeigeKontext: 'NOTFALL' }),
        // Übergänge zum Verlassen des Notfallmodus basierend auf dem Herkunftszustand
        on: {
          SCHLIESSEN: [
            {
              guard: 'herkunftIstArbeitsModus',
              target: 'ArbeitsModus.HISTORISCHER_ZUSTAND'
            },
            {
              guard: 'herkunftIstInaktiv',
              target: 'Inaktiv'
            }
          ]
        },
        states: {
          // --- SUBSTATE: BESTAETIGEN ---
          // Fragt den Benutzer, den Notfallmodus zu bestätigen
          Bestaetigen: {
            entry: 'sendeBestaetigungFrameAnUi',
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
          // Zeigt Notfall-Frames mit Navigation
          Anzeigen: {
            entry: 'setaktuellerFrame',
            on: {
              NAECHSTER_FRAME: { 
                guard: 'hatNaechstenFrame', 
                actions: 'frameNavigation' 
              },
              VORHERIGER_FRAME: { 
                guard: 'hatVorherigenFrame', 
                actions: 'frameNavigation' 
              },
              SUCHE_FRAME: {
                actions: 'sucheFrameInAktuellerListe'
              }
            }
          }
        },
      },

      // ---- ZUSTAND 4: FINAL ----
      // Finaler Zustand, wenn der Dienst abgeschlossen ist
      DienstAbgeschlossen: {
        type: 'final',
        entry: ['sendeLeerenFrameAnUi', assign(initialContext)],
      }
    },
  });