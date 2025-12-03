import express from 'express';
import { apiRoutes } from './api/routes';
import { config } from './config';
import path from 'path';

// Initializes the Express application
// This is the main entry point of the application. The server is started here.
const app = express();

// --- Global Middleware ---

// IMPORTANT: Enables parsing of JSON request bodies
// Without this, req.body in sendEvent() would be 'undefined'
app.use(express.json());


// Static path for the GUI 
const inspectorStaticPath = path.join(__dirname, '/ui/inspector');
app.use('/inspector', express.static(inspectorStaticPath));

// --- Route Registration ---

// Registers all API routes (from routes.ts)
// under the global prefix /api
app.use('/api', apiRoutes);

// --- Global Error Handling (Simple) ---
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ error: 'An internal server error occurred.' });
});

// --- Server Start ---
app.listen(config.port, () => {
  console.log('----------------------------------------------------------------\n');
  console.log('>> Frame-Management-Service <<\n');

  console.log(`Frame-Management-Service running on ---> http://localhost:${config.port}`);
  console.log(`GUI Session Management available at ---> http://localhost:${config.port}/inspector`);
  console.log('\n----------------------------------------------------------------\n');
});