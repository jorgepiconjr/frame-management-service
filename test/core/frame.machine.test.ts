import { createActor, waitFor } from 'xstate';
import { frameMachine } from '../../src/core/frame.machine';


/* --------------------------------------------------------------
  FRAME MACHINE TESTS
  Diese Tests konzentrieren sich auf die Logik und Zustandsübergänge der frame.machine.ts.
  Sie stellen sicher, dass die Maschine korrekt auf verschiedene Ereignisse reagiert
  und die erwarteten Zustandsübergänge und Logik durchführt.
-------------------------------------------------------------- */

describe('frameMachine NotfallModus', () => {

  // =======================================================
  // TESTS FOR NOTFALL MODUS TRANSITIONS 
  // =======================================================

  // TEST 1: Korrigiert - Benutzer lehnt Notfall ab
  it('should transition to Inaktiv when USER_BESTAETIGT_NOTFALL is sent with bestaetigung: false', async () => {
    const actor = createActor(frameMachine).start();
    actor.send({ type: 'NOTFALL_EMPFANGEN', notfallListe: ['EMERGENCY'] });

    // Warte, bis die Maschine im Bestätigungszustand angekommen ist
    await waitFor(actor, (snapshot) => snapshot.matches({ NotfallModus: 'Bestaetigen' }));
    
    // Sende die 'nein'-Antwort des Benutzers
    actor.send({ type: 'USER_BESTAETIGT_NOTFALL', bestaetigung: false });

    // Warte, bis die Maschine nach dem internen 'raise' den Endzustand 'Inaktiv' erreicht
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches('Inaktiv'));

    expect(finalSnapshot.value).toBe('Inaktiv');
  });

  // TEST 2: Korrigiert - Benutzer bestätigt Notfall
  it('should transition to NotfallModus.Anzeigen when USER_BESTAETIGT_NOTFALL is sent with bestaetigung: true', async () => {
    const actor = createActor(frameMachine).start();
    actor.send({ type: 'NOTFALL_EMPFANGEN', notfallListe: ['EMERGENCY'] });

    await waitFor(actor, (snapshot) => snapshot.matches({ NotfallModus: 'Bestaetigen' }));

    actor.send({ type: 'USER_BESTAETIGT_NOTFALL', bestaetigung: true });

    // In diesem Fall ist der Übergang direkt, aber die Verwendung von waitFor ist weiterhin Best Practice.
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches({ NotfallModus: 'Anzeigen' }));
    
    expect(finalSnapshot.value).toEqual({ NotfallModus: 'Anzeigen' });
  });

  // TEST 3: Korrigiert - SCHLIESSEN aus Notfall, wenn Ursprung Inaktiv war
  it('should return to Inaktiv when SCHLIESSEN is sent from NotfallModus if origin was Inaktiv', async () => {
    const actor = createActor(frameMachine).start();

    // Stelle sicher, dass wir in 'Inaktiv' starten
    expect(actor.getSnapshot().matches('Inaktiv')).toBe(true);
    
    // Löse den Notfall aus
    actor.send({ type: 'NOTFALL_EMPFANGEN', notfallListe: ['EMERGENCY'] });
    await waitFor(actor, (snapshot) => snapshot.matches('NotfallModus'));
    
    // Sende das Schließen-Ereignis
    actor.send({ type: 'SCHLIESSEN' });

    // Warte, bis die Maschine zu Inaktiv zurückkehrt
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches('Inaktiv'));

    expect(finalSnapshot.value).toBe('Inaktiv');
    // Prüfe außerdem, dass der Ursprungs-Kontext korrekt verwendet wurde
    expect(finalSnapshot.context.herkunftsZustand).toBe('Inaktiv');
  });

  // =======================================================
  // TESTS FOR HISTORY STATE FUNCTIONALITY
  // =======================================================

  // TEST 4: NEU - Rückkehr zu ArbeitsModus.ENTITAET nach Unterbrechung
  it('should return to ArbeitsModus.ENTITAET after emergency if it was interrupted there', async () => {
    const actor = createActor(frameMachine).start();

    // 1. Lege die Maschine in den spezifischen Zustand, zu dem wir zurückkehren wollen
    actor.send({ type: 'LADE_NEUE_LISTE', liste: ['patient1', 'patient2'], kontext: 'ENTITAET' });
    await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'ENTITAET' } as any));
    
    // Prüfe, dass wir uns tatsächlich im richtigen Zustand befinden
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'ENTITAET' });

    // 2. Löse die Unterbrechung aus
    actor.send({ type: 'NOTFALL_EMPFANGEN', notfallListe: ['EMERGENCY'] });
    await waitFor(actor, (snapshot) => snapshot.matches('NotfallModus'));

    // Prüfe, dass der Ursprungszustand korrekt im Kontext gespeichert wurde
    expect(actor.getSnapshot().context.herkunftsZustand).toBe('ArbeitsModus');

    // 3. Sende das SCHLIESSEN-Ereignis, um den Notfallmodus zu verlassen
    actor.send({ type: 'SCHLIESSEN' });

    // 4. Warte, bis die Maschine in den korrekten History-Zustand zurückkehrt
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'ENTITAET' } as any));

    // 5. Stelle sicher, dass wir wieder dort sind, wo wir gestartet haben
    expect(finalSnapshot.value).toEqual({ ArbeitsModus: 'ENTITAET' });
  });

  // TEST 5: NEU - Rückkehr zu ArbeitsModus.ALLGEMEIN nach Unterbrechung
  it('should return to ArbeitsModus.ALLGEMEIN after emergency if it was interrupted there', async () => {
    const actor = createActor(frameMachine).start();

    // 1. Lege die Maschine zuerst in ENTITAET, dann wechsle zu ALLGEMEIN
    actor.send({ type: 'LADE_NEUE_LISTE', liste: ['patient1'], kontext: 'ENTITAET' });

    await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'ENTITAET' } as any));

    // Prüfe, dass wir uns tatsächlich im richtigen Zustand befinden
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'ENTITAET' });
  
    actor.send({ type: 'LADE_NEUE_LISTE', liste: ['general1'], kontext: 'ALLGEMEIN' });

    await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'ALLGEMEIN' } as any));
    
    // Prüfe, dass wir im richtigen Subzustand sind
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'ALLGEMEIN' });

    // 2. Löse die Unterbrechung aus
    actor.send({ type: 'NOTFALL_EMPFANGEN', notfallListe: ['EMERGENCY'] });

    await waitFor(actor, (snapshot) => snapshot.matches('NotfallModus'));
    expect(actor.getSnapshot().context.herkunftsZustand).toBe('ArbeitsModus');

    // 3. Sende das SCHLIESSEN-Ereignis
    actor.send({ type: 'SCHLIESSEN' });

    // 4. Warte, bis die Maschine in den ALLGEMEIN-History-Zustand zurückkehrt
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'ALLGEMEIN' } as any));

    // 5. Stelle sicher, dass wir wieder im korrekten Subzustand sind
    expect(finalSnapshot.value).toEqual({ ArbeitsModus: 'ALLGEMEIN' });
  });
});

describe('Frame Machine Logic & Scenarios', () => {

  // ---------------------------------------------------------
  // SZENARIO 1: Standard-Workflow (Entität)
  // ---------------------------------------------------------
  it('Szenario 1: Sollte eine Liste laden und durch Frames navigieren (NAECHSTER_FRAME, VORHERIGER_FRAME) in Zustand \'ENTITAET\'', () => {
    const actor = createActor(frameMachine).start();
    
    // 1. Initialzustand
    expect(actor.getSnapshot().value).toBe('Inaktiv');

    // 2. Liste laden (Übergang zu ArbeitsModus.ENTITAET)
    const testListe = ['E1', 'E2', 'E3'];
    actor.send({ 
      type: 'LADE_NEUE_LISTE', 
      liste: testListe, 
      kontext: 'ENTITAET' 
    });

    const snap1 = actor.getSnapshot();
    // Prüfen auf Verbundzustand { ArbeitsModus: 'ENTITAET' }
    expect(snap1.value).toEqual({ ArbeitsModus: 'ENTITAET' });
    expect(snap1.context.entitaetListe).toEqual(testListe);
    expect(snap1.context.aktuellerFrame).toBe('E1'); // Index 0

    // 3. Navigation: Nächster Frame
    actor.send({ type: 'NAECHSTER_FRAME' });
    const snap2 = actor.getSnapshot();
    expect(snap2.context.aktuellerEntitaetIndex).toBe(1);
    expect(snap2.context.aktuellerFrame).toBe('E2');

    // 4. Navigation: Vorheriger Frame
    actor.send({ type: 'VORHERIGER_FRAME' });
    const snap3 = actor.getSnapshot();
    expect(snap3.context.aktuellerFrame).toBe('E1');
  });

  // ---------------------------------------------------------
  // SZENARIO 2: Listen-Wechsel (Entität -> Allgemein)
  // ---------------------------------------------------------
  it('Szenario 2: Sollte zwischen Entität und Allgemein wechseln', () => {
    const actor = createActor(frameMachine).start();

    // Start mit Entität
    actor.send({ type: 'LADE_NEUE_LISTE', liste: ['E1'], kontext: 'ENTITAET' });
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'ENTITAET' });

    // Wechsel zu Allgemein
    actor.send({ type: 'LADE_NEUE_LISTE', liste: ['A1', 'A2'], kontext: 'ALLGEMEIN' });
    
    const snap = actor.getSnapshot();
    expect(snap.value).toEqual({ ArbeitsModus: 'ALLGEMEIN' });
    expect(snap.context.anzeigeKontext).toBe('ALLGEMEIN');
    expect(snap.context.aktuellerFrame).toBe('A1');
  });

  // ---------------------------------------------------------
  // SZENARIO 3: Notfall-Unterbrechung & History (Komplex)
  // ---------------------------------------------------------
  it('Szenario 3: Sollte Notfall behandeln und zum korrekten Sub-Zustand in \'ArbeitsModus\' zurückkehren', () => {
    const actor = createActor(frameMachine).start();

    // 1. Wir starten im Modus ALLGEMEIN
    actor.send({ type: 'LADE_NEUE_LISTE', liste: ['A1', 'A2'], kontext: 'ALLGEMEIN' });
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'ALLGEMEIN' });

    // 2. Notfall tritt ein
    const notfallListe = ['N1', 'N2'];
    actor.send({ type: 'NOTFALL_EMPFANGEN', notfallListe });

    const snapNotfall = actor.getSnapshot();
    // Muss im Substate 'Bestaetigen' sein
    expect(snapNotfall.value).toEqual({ NotfallModus: 'Bestaetigen' }); 
    expect(snapNotfall.context.notfallListe).toEqual(notfallListe);

    // 3. User bestätigt Notfall (-> Anzeigen)
    actor.send({ type: 'USER_BESTAETIGT_NOTFALL', bestaetigung: true });
    expect(actor.getSnapshot().value).toEqual({ NotfallModus: 'Anzeigen' });
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('N1');

    // 4. Notfall wird beendet (Systemseitig)
    actor.send({ type: 'SCHLIESSEN' }); // Dies löst den History-Übergang aus

    // 5. PRÜFUNG: Sind wir wieder in ALLGEMEIN? (History Check)
    const snapReturn = actor.getSnapshot();
    expect(snapReturn.value).toEqual({ ArbeitsModus: 'ALLGEMEIN' });
    expect(snapReturn.context.anzeigeKontext).toBe('ALLGEMEIN');
  });
});

// ---------------------------------------------------------
// SZENARIO 4: Suchfunktionalität (event: SUCHE_FRAME)
// ---------------------------------------------------------
describe('Test Suchfunktionalität (event: SUCHE_FRAME) für zukünftige Spracheeingabe', () => {

  it('sollte im ENTITAET-Modus einen existierenden Frame finden und dahin springen', () => {
    // 1. Maschine starten
    const actor = createActor(frameMachine);
    actor.start();

    // 2. Liste laden (Startzustand herstellen)
    actor.send({
      type: 'LADE_NEUE_LISTE',
      kontext: 'ENTITAET',
      liste: ['FrameA', 'FrameB', 'FrameC', 'FrameD']
    });

    // Check: Start ist Index 0 ('FrameA')
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('FrameA');
    expect(actor.getSnapshot().context.aktuellerEntitaetIndex).toBe(0);

    // 3. Aktion: Suche nach 'FrameC'
    actor.send({ type: 'SUCHE_FRAME', frameName: 'FrameC' });

    // 4. Erwartung: Frame ist jetzt 'FrameC', Index ist 2
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('FrameC');
    expect(snapshot.context.aktuellerEntitaetIndex).toBe(2);
  });

  it('sollte im ENTITAET-Modus NICHT springen, wenn Frame nicht gefunden wird', () => {
    const actor = createActor(frameMachine);
    actor.start();

    actor.send({
      type: 'LADE_NEUE_LISTE',
      kontext: 'ENTITAET',
      liste: ['FrameA', 'FrameB']
    });

    // Wir sind bei FrameA
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('FrameA');

    // Suche nach nicht existentem Frame
    actor.send({ type: 'SUCHE_FRAME', frameName: 'FrameC' });

    // Erwartung: Alles bleibt wie vorher
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('FrameA');
    expect(snapshot.context.aktuellerEntitaetIndex).toBe(0);
  });

  it('sollte im ALLGEMEIN-Modus funktionieren', () => {
    // Maschine starten
    const actor = createActor(frameMachine);
    actor.start();

    // Wir wechseln in den ALLGEMEIN Modus
    actor.send({
      type: 'LADE_NEUE_LISTE',
      kontext: 'ALLGEMEIN',
      liste: ['Info1', 'Info2', 'Info3']
    });

    expect(actor.getSnapshot().matches({ ArbeitsModus: 'ALLGEMEIN' })).toBe(true);

    // Suche nach 'Info3'
    actor.send({ type: 'SUCHE_FRAME', frameName: 'Info3' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('Info3');
    expect(snapshot.context.aktuellerAllgemeinIndex).toBe(2);
  });

  it('sollte im NOTFALL-Modus (Status Anzeigen) funktionieren', () => {
    // Maschine starten
    const actor = createActor(frameMachine);
    actor.start();

    // 1. Notfall empfangen
    actor.send({
      type: 'NOTFALL_EMPFANGEN',
      notfallListe: ['Alarm1', 'Alarm2', 'Alarm3']
    });

    // 2. Notfall bestätigen (um in den State "Anzeigen" zu kommen)
    actor.send({
      type: 'USER_BESTAETIGT_NOTFALL',
      bestaetigung: true
    });

    // Sicherstellen, dass wir im richtigen State sind
    expect(actor.getSnapshot().matches({ NotfallModus: 'Anzeigen' })).toBe(true);
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('Alarm1');

    // 3. Suche ausführen
    actor.send({ type: 'SUCHE_FRAME', frameName: 'Alarm2' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('Alarm2');
    expect(snapshot.context.aktuellerNotfallIndex).toBe(1);
  });

  it('sollte im NOTFALL-Modus (Status Bestaetigen) die Suche IGNORIEREN', () => {
    // Maschine starten
    const actor = createActor(frameMachine);
    actor.start();

    // Notfall empfangen
    actor.send({
      type: 'NOTFALL_EMPFANGEN',
      notfallListe: ['Alarm1', 'Alarm2']
    });

    // Wir sind jetzt in 'NotfallModus.Bestaetigen' (noch nicht 'Anzeigen')
    expect(actor.getSnapshot().matches({ NotfallModus: 'Bestaetigen' })).toBe(true);
    
    // Wir versuchen zu suchen, obwohl wir noch bestätigen müssen
    actor.send({ type: 'SUCHE_FRAME', frameName: 'Alarm2' });

    const snapshot = actor.getSnapshot();
    // Die Suche sollte keinen Effekt haben, da das Event in diesem State nicht definiert ist
    // Der Frame sollte immer noch der Bestätigungs-Frame sein
    expect(snapshot.context.aktuellerFrame).toBe('BESTAETIGUNG_FRAME'); 
    expect(snapshot.context.aktuellerNotfallIndex).toBe(0);
  });

  it('sollte korrekt umschalten, wenn man zwischen Listen wechselt', () => {
    // Maschine starten
    const actor = createActor(frameMachine);
    actor.start();

    // Erst Entität laden
    actor.send({ type: 'LADE_NEUE_LISTE', kontext: 'ENTITAET', liste: ['E1', 'E2'] });
    
    // Dann Allgemein laden
    actor.send({ type: 'LADE_NEUE_LISTE', kontext: 'ALLGEMEIN', liste: ['A1', 'A2', 'A3'] });

    // Suche im Allgemein-Kontext
    actor.send({ type: 'SUCHE_FRAME', frameName: 'A2' });
    
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('A2');
    expect(actor.getSnapshot().context.aktuellerAllgemeinIndex).toBe(1);

    // Zurück zu Entität wechseln
    actor.send({ type: 'LADE_NEUE_LISTE', kontext: 'ENTITAET', liste: ['E1', 'E2'] });

    // Suche im Entität-Kontext (sollte nicht in der alten Allgemein-Liste suchen)
    actor.send({ type: 'SUCHE_FRAME', frameName: 'E2' });

    expect(actor.getSnapshot().context.aktuellerFrame).toBe('E2');
    expect(actor.getSnapshot().context.aktuellerEntitaetIndex).toBe(1);
  });
});