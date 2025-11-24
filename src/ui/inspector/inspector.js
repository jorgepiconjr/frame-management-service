// -------------------------------------------------
// Inspector UI für Sitzungen
// Hier kommen die Funktionen und Logik für den Inspektor
// der die UI für Sitzungen verwaltet und anzeigt.
// http://localhost:3000/inspector
// -------------------------------------------------

const API_BASE = '/api';

// DOM-Elemente
const cardsRoot = document.getElementById('cardsRoot');
const template = document.getElementById('cardTemplate');
const refreshBtn = document.getElementById('refreshBtn');
const createBtn = document.getElementById('createSessionBtn');
const newSessionInput = document.getElementById('newSessionId');
const pollInput = document.getElementById('pollInterval');
const togglePollBtn = document.getElementById('togglePollBtn');

let pollTimer = null;
let known = new Map(); // sessionId -> DOM element

/**
 * Sitzungen vom Server (/api/session/sessions) abrufen
 * @returns {Promise<CleanSnapshot[]>} Liste der Sitzungen
 */
async function fetchSessions() {
  try {
    const res = await fetch(`${API_BASE}/session/sessions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    // normalize: expect { count, sessions: CleanSnapshot[] } or array
    let sessions = [];
    if (Array.isArray(body)) sessions = body;
    else if (body && Array.isArray(body.sessions)) sessions = body.sessions;
    else if (body && body.count >= 0 && Array.isArray(body.sessions)) sessions = body.sessions;
    else {
      console.warn('Unexpected sessions shape', body);
      return [];
    }
    return sessions;
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
    return [];
  }
}

/**
 * Function zum "Verschönern" von Werten für die Anzeige
 * @param {any} v Wert 
 * @returns {string} "Verschönerter" String
 */
function pretty(v) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/**
 * Funktion zum Erstellen oder Aktualisieren einer Karten-DOM für eine Sitzung
 * @param {CleanSnapshot} snap Sitzungssnapshot
 * @return {void} 
 */
function createOrUpdateCard(snap) {
  const id = snap.sessionId;
  let el = known.get(id);
  if (!el) {
    const node = template.content.cloneNode(true);
    el = node.querySelector('.card');
    el.querySelector('.sid').textContent = id;
    el.querySelector('.btn-delete').addEventListener('click', () => deleteSession(id));
    el.querySelector('.btn-send-event').addEventListener('click', () => promptAndSendEvent(id));
    cardsRoot.prepend(el); // newest on top
    known.set(id, el);
  }
  el.querySelector('.state').textContent = pretty(snap.currentState);
  el.querySelector('.frame').textContent = snap.currentFrame ?? '';
  el.querySelector('.context').textContent = pretty(snap.context ?? {});
}

/**
 * Funktion zum Entfernen von Karten für Sitzungen, die nicht mehr existieren
 * @param {CleanSnapshot[]} currentSessions 
 * @return {void}
 */
function removeMissingSessions(currentSessions) {
  const currentIds = new Set(currentSessions.map(s => s.sessionId));
  for (const id of Array.from(known.keys())) {
    if (!currentIds.has(id)) {
      const el = known.get(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
      known.delete(id);
    }
  }
}

/**
 * Funktion zum sofortigen Aktualisieren der Sitzungskarten
 * @return {Promise<void>}
 */
async function refreshNow() {
  const sessions = await fetchSessions();
  sessions.forEach(createOrUpdateCard);
  removeMissingSessions(sessions);
}

/**
 * Funktion zum Erstellen einer neuen Sitzung
 * @returns {Promise<void>}
 */
async function createSession() {
  const id = (newSessionInput.value || '').trim();
  if (!id) return alert('Provide session id');
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(id)}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert('Create failed: ' + (err.error || res.status));
    return;
  }
  await refreshNow();
  newSessionInput.value = '';
}

/**
 * Funktion zum Löschen einer Sitzung
 * @param {string} id Sitzungs-ID
 * @returns {Promise<void>}
 */
async function deleteSession(id) {
  if (!confirm(`Delete session ${id}?`)) return;
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    alert('Delete failed: ' + res.status);
    return;
  }
  await refreshNow();
}

/** Funktion zum Eingeben und Senden eines Ereignisses an eine Sitzung
 * @param {string} sessionId Sitzungs-ID
 * @returns {Promise<void>}
 */
async function promptAndSendEvent(sessionId) {
  // Simple JSON input prompt: user types {"type":"NAECHSTER_FRAME"}
  const txt = prompt('Enter event JSON (e.g. {"type":"NAECHSTER_FRAME"})');
  if (!txt) return;
  let payload;
  try { payload = JSON.parse(txt); } catch (e) { return alert('Invalid JSON'); }
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert('Event failed: ' + (err.error || res.status));
    return;
  }
  // server returns updated snapshot -> update UI
  const newSnap = await res.json();
  createOrUpdateCard(newSnap);
}

// Event-Listener
refreshBtn.addEventListener('click', refreshNow);
createBtn.addEventListener('click', createSession);
togglePollBtn.addEventListener('click', () => {
  if (pollTimer) stopPolling();
  else startPolling(Number(pollInput.value) || 1000);
});

/**
 * Funktion zum Starten/Stoppen des Pollings
 * @param {number} ms 
 * @returns 
 */
function startPolling(ms = 1000) {
  if (pollTimer) return;
  pollTimer = setInterval(refreshNow, ms);
  togglePollBtn.textContent = 'Stop Polling';
}
function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
  togglePollBtn.textContent = 'Start Polling';
}

startPolling(Number(pollInput.value) || 1000);
refreshNow();