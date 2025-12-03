// --- memory-check.ts ---------------------------------------
// Dieser Test misst den Speicherverbrauch beim Erstellen von Sessions
// und dem Senden von Events. Ziel ist es, Memory Leaks zu identifizieren.
// ---------------------------------------------------------------

import { sessionService } from '../../src/services/session.service';

const ITERATIONS = 100;

// Garbage Collection erzwingen (falls Node mit --expose-gc gestartet wird), sonst warten
if (global.gc) { global.gc(); }

const startMemory = process.memoryUsage().heapTotal;

console.log('----- Starte Memory Check: createSession(500) -----');
console.log(`Start Memory: ${(startMemory / 1024 / 1024).toFixed(2)} MB`);

// 100 Sessions erzeugen
for (let i = 0; i < ITERATIONS; i++) {
    sessionService.createSession(`load-test-session-${i}`);
    sessionService.sendEvent(`load-test-session-${i}`, {
        type: 'LADE_NEUE_LISTE',
        list: Array(10).fill(null).map((_, idx) => `Item ${idx + 1}`),
        context: 'ALLGEMEIN'
    });
}

const endMemory = process.memoryUsage().heapTotal;
const usedMemory = endMemory - startMemory;
const kbPerSession = (usedMemory / ITERATIONS) / 1024;

console.log(`End Memory: ${(endMemory / 1024 / 1024).toFixed(2)} MB`);
console.log(`Gesamtverbrauch (End - Start) für ${ITERATIONS} Sessions: ${(usedMemory / 1024 / 1024).toFixed(2)} MB`);
console.log(`Durchschnitt pro Session: ${kbPerSession.toFixed(2)} KB`);
console.log('----------------------------------------');
