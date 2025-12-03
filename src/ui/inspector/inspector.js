// -------------------------------------------------
// GUI for session management
// Here come the functions and logic for the inspector
// that manages and displays the UI for sessions.
// http://localhost:3000/inspector
// -------------------------------------------------

const API_BASE = '/api';

// DOM elements
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
 * Fetch all sessions from server (/api/session/sessions)
 * @returns {Promise<CleanSnapshot[]>} List of sessions
 */
async function fetchSessions() {
  try {
    const res = await fetch(`${API_BASE}/session/sessions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
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
 * Function to prettify values for display
 * @param {any} v Value 
 * @returns {string} Prettified string
 */
function pretty(v) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/**
 * Function to create or update a card DOM for a session
 * @param {CleanSnapshot} snap Session snapshot
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
 * Function to remove cards for sessions that no longer exist
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
 * Function to immediately refresh the session cards
 * @return {Promise<void>}
 */
async function refreshNow() {
  const sessions = await fetchSessions();
  sessions.forEach(createOrUpdateCard);
  removeMissingSessions(sessions);
}

/**
 * Function to create a new session
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
 * Function to delete a session
 * @param {string} id Session ID
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

/**
 * Function to prompt and send an event to a session
 * @param {string} sessionId Session ID
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

// Event listeners
refreshBtn.addEventListener('click', refreshNow);
createBtn.addEventListener('click', createSession);
togglePollBtn.addEventListener('click', () => {
  if (pollTimer) stopPolling();
  else startPolling(Number(pollInput.value) || 1000);
});

/**
 * Function to start/stop polling
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