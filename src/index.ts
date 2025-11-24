import express from 'express';
import { apiRoutes } from './api/routes';
import { config } from './config';
import path from 'path';

// Initialisiert die Express-Anwendung
// Dies ist der Haupt-Entry-Point der Anwendung. Hier wird der Server gestartet.
const app = express();

// --- Globale Middleware ---

// WICHTIG: Aktiviert das Parsen von JSON-Request-Bodies
// Ohne dies wäre req.body in sendEvent() 'undefined'
app.use(express.json());


// Statischer Pfad für den Inspector
const inspectorStaticPath = path.join(__dirname, '/ui/inspector');
app.use('/inspector', express.static(inspectorStaticPath));

// --- Routen-Registrierung ---

// Registriert alle API-Routen (aus routes.ts)
// unter dem globalen Präfix /api
app.use('/api', apiRoutes);

// --- Globale Fehlerbehandlung (Einfach) ---
// (Optional, aber empfohlen)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Ein interner Serverfehler ist aufgetreten.' });
});

// --- Server-Start ---
app.listen(config.port, () => {
  console.log('----------------------------------------------------------------');
  console.log('>> Frame-Management-Service <<\n');

  console.log(`Frame-Management-Service läuft auf ---> http://localhost:${config.port}`);
  console.log(`Inspector verfügbar unter ---> http://localhost:${config.port}/inspector`);
  console.log('----------------------------------------------------------------');
});