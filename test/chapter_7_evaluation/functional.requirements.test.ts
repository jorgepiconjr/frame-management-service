import { createActor, waitFor } from 'xstate';
import { frameMachine } from '../../src/core/frame.machine';

describe('7.2 Validation of Functional Requirements', () => {
    
    it('7.2.1. Managing Parallel Sessions: should manage parallel sessions in isolation', async () => {
    // 1. Create two independent actors
    const actorA = createActor(frameMachine).start();
    const actorB = createActor(frameMachine).start();

    // 2. Send different initialization events
    actorA.send({ type: 'LADE_NEUE_LISTE', list: ['E1', 'E2', 'E3'], context: 'ENTITAET' });
    actorB.send({ type: 'LADE_NEUE_LISTE', list: ['A1', 'A2', 'A3'], context: 'ALLGEMEIN' });

    // Wait until both actors are in working mode
    await waitFor(actorA, (snapshot) => snapshot.matches({ ArbeitsModus: 'Entitaet' }));
    await waitFor(actorB, (snapshot) => snapshot.matches({ ArbeitsModus: 'Allgemein' }));
    
    // 3. Send identical navigation events
    actorA.send({ type: 'NAECHSTER_FRAME' }); // Expected frame: E2
    actorB.send({ type: 'NAECHSTER_FRAME' }); // Expected frame: A2

    // 4. Check if the states are independent and correct
    const snapA = actorA.getSnapshot();
    expect(snapA.context.aktuellerFrame).toBe('E2');
    
    const snapB = actorB.getSnapshot();
    expect(snapB.context.aktuellerFrame).toBe('A2');
    });

    it('7.2.2 Flexible Navigation: should allow flexible forward, backward, and search navigation', async () => {
    // 1. Create actor and initialize with test data
    const actorA = createActor(frameMachine).start();
    actorA.send({ type: 'LADE_NEUE_LISTE', list: ['E1', 'E2', 'E3', 'E4'], context: 'ENTITAET' });
    await waitFor(actorA, (snapshot) => snapshot.matches({ ArbeitsModus: 'Entitaet' }));
    
    // 2. Test forward navigation
    actorA.send({ type: 'NAECHSTER_FRAME' }); 
    let snapA = actorA.getSnapshot();
    expect(snapA.context.aktuellerFrame).toBe('E2');

    // 3. Test backward navigation
    actorA.send({ type: 'VORHERIGER_FRAME' }); 
    snapA = actorA.getSnapshot();
    expect(snapA.context.aktuellerFrame).toBe('E1');

    // 4. Test targeted search
    actorA.send({ type: 'SUCHE_FRAME', frameName: 'E4' }); 
    snapA = actorA.getSnapshot();
    expect(snapA.context.aktuellerFrame).toBe('E4');
    });

    it('7.2.3 Context Dependency and Dynamics: should act context-dependently and respond to emergencies', async () => {
    const actorA = createActor(frameMachine).start();

    // 1. Set context to ENTITY and check state
    actorA.send({ type: 'LADE_NEUE_LISTE', list: ['E1', 'E2'], context: 'ENTITAET' });
    await waitFor(actorA, (snapshot) => snapshot.matches({ ArbeitsModus: 'Entitaet' }));
    let snapA = actorA.getSnapshot();
    expect(snapA.matches({ ArbeitsModus: 'Entitaet' })).toBe(true);
    expect(snapA.context.aktuellerFrame).toBe('E1');

    // 2. Switch context to GENERAL and check state again
    actorA.send({ type: 'LADE_NEUE_LISTE', list: ['A1', 'A2'], context: 'ALLGEMEIN' });
    await waitFor(actorA, (snapshot) => snapshot.matches({ ArbeitsModus: 'Allgemein' }));
    snapA = actorA.getSnapshot();
    expect(snapA.matches({ ArbeitsModus: 'Allgemein' })).toBe(true);
    expect(snapA.context.aktuellerFrame).toBe('A1');

    // 3. Trigger emergency interruption and check confirmation state
    actorA.send({ type: 'NOTFALL_EMPFANGEN', list: ['N1', 'N2'] });
    await waitFor(actorA, (snapshot) => snapshot.matches({ NotfallModus: 'Bestaetigen' }));
    snapA = actorA.getSnapshot();
    expect(snapA.matches({ NotfallModus: 'Bestaetigen' })).toBe(true);
    expect(snapA.context.aktuellerFrame).toBe('BESTAETIGUNG_FRAME');

    // 4. Confirm emergency and check final emergency display state
    actorA.send({ type: 'USER_BESTAETIGT_NOTFALL', accepted: true });
    await waitFor(actorA, (snapshot) => snapshot.matches({ NotfallModus: 'Anzeigen' }));
    snapA = actorA.getSnapshot();
    expect(snapA.matches({ NotfallModus: 'Anzeigen' })).toBe(true);
    expect(snapA.context.aktuellerFrame).toBe('N1');
    });
    
});
