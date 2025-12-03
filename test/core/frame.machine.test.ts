import { createActor, waitFor } from 'xstate';
import { frameMachine } from '../../src/core/frame.machine';


/* --------------------------------------------------------------
  FRAME MACHINE TESTS
  These tests focus on the logic and state transitions of frame.machine.ts.
  They ensure that the machine responds correctly to various events
  and performs the expected state transitions and logic.
-------------------------------------------------------------- */

describe('frameMachine EmergencyMode', () => {

  // =======================================================
  // TESTS FOR EMERGENCY MODE TRANSITIONS 
  // =======================================================

  // TEST 1: Corrected - User rejects emergency
  it('should transition to Inaktiv when USER_BESTAETIGT_NOTFALL is sent with accepted: false', async () => {
    const actor = createActor(frameMachine).start();
    actor.send({ type: 'NOTFALL_EMPFANGEN', list: ['EMERGENCY'] });

    // Wait until the machine reaches the confirmation state
    await waitFor(actor, (snapshot) => snapshot.matches({ NotfallModus: 'Bestaetigen' }));
    
    // Send the user's 'no' response
    actor.send({ type: 'USER_BESTAETIGT_NOTFALL', accepted: false });

    // Wait until the machine reaches the final state 'Inaktiv' after the internal 'raise'
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches('Inaktiv'));

    expect(finalSnapshot.value).toBe('Inaktiv');
  });

  // TEST 2: Corrected - User confirms emergency
  it('should transition to NotfallModus.Anzeigen when USER_BESTAETIGT_NOTFALL is sent with accepted: true', async () => {
    const actor = createActor(frameMachine).start();
    actor.send({ type: 'NOTFALL_EMPFANGEN', list: ['EMERGENCY'] });

    await waitFor(actor, (snapshot) => snapshot.matches({ NotfallModus: 'Bestaetigen' }));

    actor.send({ type: 'USER_BESTAETIGT_NOTFALL', accepted: true });

    // In this case the transition is direct, but using waitFor is still best practice.
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches({ NotfallModus: 'Anzeigen' }));
    
    expect(finalSnapshot.value).toEqual({ NotfallModus: 'Anzeigen' });
  });

  // TEST 3: Corrected - CLOSE from emergency if origin was Inaktiv
  it('should return to Inaktiv when SCHLIESSEN is sent from NotfallModus if origin was Inaktiv', async () => {
    const actor = createActor(frameMachine).start();

    // Ensure we start in 'Inaktiv'
    expect(actor.getSnapshot().matches('Inaktiv')).toBe(true);
    
    // Trigger the emergency
    actor.send({ type: 'NOTFALL_EMPFANGEN', list: ['EMERGENCY'] });
    await waitFor(actor, (snapshot) => snapshot.matches('NotfallModus'));
    
    // Send the close event
    actor.send({ type: 'SCHLIESSEN' });

    // Wait until the machine returns to Inaktiv
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches('Inaktiv'));

    expect(finalSnapshot.value).toBe('Inaktiv');
    // Also check that the origin context was used correctly
    expect(finalSnapshot.context.herkunftsZustand).toBe('Inaktiv');
  });

  // =======================================================
  // TESTS FOR HISTORY STATE FUNCTIONALITY
  // =======================================================

  // TEST 4: NEW - Return to ArbeitsModus.ENTITAET after interruption
  it('should return to ArbeitsModus.ENTITAET after emergency if it was interrupted there', async () => {
    const actor = createActor(frameMachine).start();

    // 1. Place the machine in the specific state we want to return to
    actor.send({ type: 'LADE_NEUE_LISTE', list: ['patient1', 'patient2'], context: 'ENTITAET' });
    await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'Entitaet' } as any));
    
    // Check that we are actually in the correct state
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'Entitaet' });

    // 2. Trigger the interruption
    actor.send({ type: 'NOTFALL_EMPFANGEN', list: ['EMERGENCY'] });
    await waitFor(actor, (snapshot) => snapshot.matches('NotfallModus'));

    // Check that the origin state was correctly stored in the context
    expect(actor.getSnapshot().context.herkunftsZustand).toBe('ArbeitsModus');

    // 3. Send the CLOSE event to exit emergency mode
    actor.send({ type: 'SCHLIESSEN' });

    // 4. Wait until the machine returns to the correct history state
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'Entitaet' } as any));

    // 5. Ensure we are back where we started
    expect(finalSnapshot.value).toEqual({ ArbeitsModus: 'Entitaet' });
  });

  // TEST 5: NEW - Return to ArbeitsModus.Allgemein after interruption
  it('should return to ArbeitsModus.Allgemein after emergency if it was interrupted there', async () => {
    const actor = createActor(frameMachine).start();

    // 1. First place the machine in ENTITAET, then switch to Allgemein
    actor.send({ type: 'LADE_NEUE_LISTE', list: ['patient1'], context: 'ENTITAET' });

    await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'Entitaet' } as any));

    // Check that we are actually in the correct state
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'Entitaet' });
  
    actor.send({ type: 'LADE_NEUE_LISTE', list: ['general1'], context: 'ALLGEMEIN' });

    await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'Allgemein' } as any));
    
    // Check that we are in the correct substate
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'Allgemein' });

    // 2. Trigger the interruption
    actor.send({ type: 'NOTFALL_EMPFANGEN', list: ['EMERGENCY'] });

    await waitFor(actor, (snapshot) => snapshot.matches('NotfallModus'));
    expect(actor.getSnapshot().context.herkunftsZustand).toBe('ArbeitsModus');

    // 3. Send the CLOSE event
    actor.send({ type: 'SCHLIESSEN' });

    // 4. Wait until the machine returns to the Allgemein history state
    const finalSnapshot = await waitFor(actor, (snapshot) => snapshot.matches({ ArbeitsModus: 'Allgemein' } as any));

    // 5. Ensure we are back in the correct substate
    expect(finalSnapshot.value).toEqual({ ArbeitsModus: 'Allgemein' });
  });
});

describe('Frame Machine Logic & Scenarios', () => {

  // ---------------------------------------------------------
  // SCENARIO 1: Standard workflow (Entity)
  // ---------------------------------------------------------
  it('Scenario 1: Should load a list and navigate through frames (NEXT_FRAME, PREVIOUS_FRAME) in state \'ENTITAET\'', () => {
    const actor = createActor(frameMachine).start();
    
    // 1. Initial state
    expect(actor.getSnapshot().value).toBe('Inaktiv');

    // 2. Load list (transition to ArbeitsModus.ENTITAET)
    const testListe = ['E1', 'E2', 'E3'];
    actor.send({ 
      type: 'LADE_NEUE_LISTE', 
      list: testListe, 
      context: 'ENTITAET' 
    });

    const snap1 = actor.getSnapshot();
    // Check for compound state { ArbeitsModus: 'Entitaet' }
    expect(snap1.value).toEqual({ ArbeitsModus: 'Entitaet' });
    expect(snap1.context.entitaetListe).toEqual(testListe);
    expect(snap1.context.aktuellerFrame).toBe('E1'); // Index 0

    // 3. Navigation: Next frame
    actor.send({ type: 'NAECHSTER_FRAME' });
    const snap2 = actor.getSnapshot();
    expect(snap2.context.aktuellerEntitaetIndex).toBe(1);
    expect(snap2.context.aktuellerFrame).toBe('E2');

    // 4. Navigation: Previous frame
    actor.send({ type: 'VORHERIGER_FRAME' });
    const snap3 = actor.getSnapshot();
    expect(snap3.context.aktuellerFrame).toBe('E1');
  });

  // ---------------------------------------------------------
  // SCENARIO 2: List switching (Entity -> General)
  // ---------------------------------------------------------
  it('Scenario 2: Should switch between Entity and General', () => {
    const actor = createActor(frameMachine).start();

    // Start with Entity
    actor.send({ type: 'LADE_NEUE_LISTE', list: ['E1'], context: 'ENTITAET' });
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'Entitaet' });

    // Switch to General
    actor.send({ type: 'LADE_NEUE_LISTE', list: ['A1', 'A2'], context: 'ALLGEMEIN' });
    
    const snap = actor.getSnapshot();
    expect(snap.value).toEqual({ ArbeitsModus: 'Allgemein' });
    expect(snap.context.anzeigeKontext).toBe('ALLGEMEIN');
    expect(snap.context.aktuellerFrame).toBe('A1');
  });

  // ---------------------------------------------------------
  // SCENARIO 3: Emergency interruption & history (Complex)
  // ---------------------------------------------------------
  it('Scenario 3: Should handle emergency and return to the correct sub-state in \'ArbeitsModus\'', () => {
    const actor = createActor(frameMachine).start();

    // 1. We start in General mode
    actor.send({ type: 'LADE_NEUE_LISTE', list: ['A1', 'A2'], context: 'ALLGEMEIN' });
    expect(actor.getSnapshot().value).toEqual({ ArbeitsModus: 'Allgemein' });

    // 2. Emergency occurs
    const list = ['N1', 'N2'];
    actor.send({ type: 'NOTFALL_EMPFANGEN', list });

    const snapNotfall = actor.getSnapshot();
    // Must be in the 'Bestaetigen' substate
    expect(snapNotfall.value).toEqual({ NotfallModus: 'Bestaetigen' }); 
    expect(snapNotfall.context.notfallListe).toEqual(list);

    // 3. User confirms emergency (-> Anzeigen)
    actor.send({ type: 'USER_BESTAETIGT_NOTFALL', accepted: true });
    expect(actor.getSnapshot().value).toEqual({ NotfallModus: 'Anzeigen' });
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('N1');

    // 4. Emergency is ended (system-side)
    actor.send({ type: 'SCHLIESSEN' }); // This triggers the history transition

    // 5. CHECK: Are we back in General? (History check)
    const snapReturn = actor.getSnapshot();
    expect(snapReturn.value).toEqual({ ArbeitsModus: 'Allgemein' });
    expect(snapReturn.context.anzeigeKontext).toBe('ALLGEMEIN');
  });
});

// ---------------------------------------------------------
// SCENARIO 4: Search functionality (event: SUCHE_FRAME)
// ---------------------------------------------------------
describe('Test search functionality (event: SUCHE_FRAME) for future voice input', () => {

  it('should find and jump to an existing frame in ENTITAET mode', () => {
    // 1. Start machine
    const actor = createActor(frameMachine);
    actor.start();

    // 2. Load list (establish initial state)
    actor.send({
      type: 'LADE_NEUE_LISTE',
      context: 'ENTITAET',
      list: ['FrameA', 'FrameB', 'FrameC', 'FrameD']
    });

    // Check: Start is index 0 ('FrameA')
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('FrameA');
    expect(actor.getSnapshot().context.aktuellerEntitaetIndex).toBe(0);

    // 3. Action: Search for 'FrameC'
    actor.send({ type: 'SUCHE_FRAME', frameName: 'FrameC' });

    // 4. Expectation: Frame is now 'FrameC', index is 2
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('FrameC');
    expect(snapshot.context.aktuellerEntitaetIndex).toBe(2);
  });

  it('should NOT jump in ENTITAET mode if frame is not found', () => {
    const actor = createActor(frameMachine);
    actor.start();

    actor.send({
      type: 'LADE_NEUE_LISTE',
      context: 'ENTITAET',
      list: ['FrameA', 'FrameB']
    });

    // We are at FrameA
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('FrameA');

    // Search for non-existent frame
    actor.send({ type: 'SUCHE_FRAME', frameName: 'FrameC' });

    // Expectation: Everything stays as before
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('FrameA');
    expect(snapshot.context.aktuellerEntitaetIndex).toBe(0);
  });

  it('should work in General mode', () => {
    // Start machine
    const actor = createActor(frameMachine);
    actor.start();

    // We switch to General mode
    actor.send({
      type: 'LADE_NEUE_LISTE',
      context: 'ALLGEMEIN',
      list: ['Info1', 'Info2', 'Info3']
    });

    expect(actor.getSnapshot().matches({ ArbeitsModus: 'Allgemein' })).toBe(true);

    // Search for 'Info3'
    actor.send({ type: 'SUCHE_FRAME', frameName: 'Info3' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('Info3');
    expect(snapshot.context.aktuellerAllgemeinIndex).toBe(2);
  });

  it('should work in EMERGENCY mode (status Anzeigen)', () => {
    // Start machine
    const actor = createActor(frameMachine);
    actor.start();

    // 1. Receive emergency
    actor.send({
      type: 'NOTFALL_EMPFANGEN',
      list: ['Alarm1', 'Alarm2', 'Alarm3']
    });

    // 2. Confirm emergency (to get into the "Anzeigen" state)
    actor.send({
      type: 'USER_BESTAETIGT_NOTFALL',
      accepted: true
    });

    // Ensure we are in the correct state
    expect(actor.getSnapshot().matches({ NotfallModus: 'Anzeigen' })).toBe(true);
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('Alarm1');

    // 3. Perform search
    actor.send({ type: 'SUCHE_FRAME', frameName: 'Alarm2' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.aktuellerFrame).toBe('Alarm2');
    expect(snapshot.context.aktuellerNotfallIndex).toBe(1);
  });

  it('should IGNORE search in EMERGENCY mode (status Bestaetigen)', () => {
    // Start machine
    const actor = createActor(frameMachine);
    actor.start();

    // Receive emergency
    actor.send({
      type: 'NOTFALL_EMPFANGEN',
      list: ['Alarm1', 'Alarm2']
    });

    // We are now in 'NotfallModus.Bestaetigen' (not yet 'Anzeigen')
    expect(actor.getSnapshot().matches({ NotfallModus: 'Bestaetigen' })).toBe(true);
    
    // We try to search, even though we still need to confirm
    actor.send({ type: 'SUCHE_FRAME', frameName: 'Alarm2' });

    const snapshot = actor.getSnapshot();
    // The search should have no effect since the event is not defined in this state
    // The frame should still be the confirmation frame
    expect(snapshot.context.aktuellerFrame).toBe('BESTAETIGUNG_FRAME'); 
    expect(snapshot.context.aktuellerNotfallIndex).toBe(0);
  });

  it('should switch correctly when changing between lists', () => {
    // Start machine
    const actor = createActor(frameMachine);
    actor.start();

    // First load Entity
    actor.send({ type: 'LADE_NEUE_LISTE', context: 'ENTITAET', list: ['E1', 'E2'] });
    
    // Then load General
    actor.send({ type: 'LADE_NEUE_LISTE', context: 'ALLGEMEIN', list: ['A1', 'A2', 'A3'] });

    // Search in General context
    actor.send({ type: 'SUCHE_FRAME', frameName: 'A2' });
    
    expect(actor.getSnapshot().context.aktuellerFrame).toBe('A2');
    expect(actor.getSnapshot().context.aktuellerAllgemeinIndex).toBe(1);

    // Switch back to Entity
    actor.send({ type: 'LADE_NEUE_LISTE', context: 'ENTITAET', list: ['E1', 'E2'] });

    // Search in Entity context (should not search in the old General list)
    actor.send({ type: 'SUCHE_FRAME', frameName: 'E2' });

    expect(actor.getSnapshot().context.aktuellerFrame).toBe('E2');
    expect(actor.getSnapshot().context.aktuellerEntitaetIndex).toBe(1);
  });
});