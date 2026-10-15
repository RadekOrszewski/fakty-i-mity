export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// **pogrubienie** → <strong>
export function md(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function fmt(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export const label = (v) => (v === true ? 'True' : v === false ? 'False' : '—');

export function playersOf(room) {
  return Object.entries(room?.players || {})
    .map(([id, t]) => ({ id, ...t, answers: t.answers || {} }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

export function statementsOf(room) {
  const s = room?.statements || [];
  return Array.isArray(s) ? s.filter(Boolean) : Object.values(s);
}

export function answeredCount(player, statements) {
  return statements.filter((s) => typeof player.answers[s.id] === 'boolean').length;
}

export function scoreOf(player, key) {
  return Object.entries(key || {}).filter(([sid, v]) => player.answers[sid] === v).length;
}

// Ranking „sportowy”: remisy dzielą miejsce (1, 1, 3…)
export function ranking(players, key) {
  const rows = players.map((t) => ({ ...t, score: scoreOf(t, key) })).sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.place = i > 0 && r.score === rows[i - 1].score ? rows[i - 1].place : i + 1; });
  return rows;
}

export function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

export function demoBadge() {
  const b = document.createElement('div');
  b.className = 'demo-badge';
  b.innerHTML = '<b>Demo mode</b><span> · data stays in this browser only</span>';
  (document.querySelector('.brand-bar') || document.body).append(b);
}

// Tłumaczy typowe błędy Firebase na konkretną wskazówkę, co poprawić.
export function explainError(e) {
  const raw = String(e?.code || '') + ' ' + String(e?.message || e || '');
  const r = raw.toLowerCase();
  let hint = 'Unknown error. Open the browser console (F12 → Console) for details.';
  if (r.includes('permission_denied') || r.includes('permission denied'))
    hint = 'The database is denying access. In Firebase: Realtime Database → Rules → paste the full contents of database.rules.json and click Publish.';
  else if (r.includes('admin-restricted-operation') || r.includes('operation-not-allowed'))
    hint = 'Anonymous sign-in is disabled. In Firebase: Authentication → Sign-in method → Anonymous → Enable.';
  else if (r.includes('unauthorized-domain') || r.includes('requests-from-referer'))
    hint = 'This domain is not allowed. In Firebase: Authentication → Settings → Authorized domains → add radekorszewski.github.io (no https, no path).';
  else if (r.includes('api-key-not-valid') || r.includes('invalid-api-key'))
    hint = 'Invalid apiKey in js/config.js. Copy the config again from Project settings.';
  else if (r.includes('timeout'))
    hint = 'No response from the database. Check that databaseURL in js/config.js exactly matches the address shown on the Realtime Database screen, and that the database has been created.';
  else if (r.includes('failed to fetch') || r.includes('importing a module') || r.includes('network'))
    hint = 'Could not load the Firebase libraries. Check your internet connection or content blockers.';
  return { hint, raw: raw.trim() };
}

export function showFatal(el, e) {
  console.error(e);
  const { hint, raw } = explainError(e);
  el.innerHTML = `<div class="center-msg fatal">
    <div class="eyebrow">Connection problem</div>
    <h1>Could not set up the game</h1>
    <p class="lead">${esc(hint)}</p>
    <p class="muted small mono">${esc(raw)}</p>
    <button class="btn ghost" onclick="location.reload()">Try again</button>
  </div>`;
}

export const WINNERS_MSG = 'You are all winners, because you all learned something!';
