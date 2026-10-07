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

export const label = (v) => (v === true ? 'Prawda' : v === false ? 'Fałsz' : '—');

export function teamsOf(room) {
  return Object.entries(room?.teams || {})
    .map(([id, t]) => ({ id, ...t, answers: t.answers || {} }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

export function statementsOf(room) {
  const s = room?.statements || [];
  return Array.isArray(s) ? s.filter(Boolean) : Object.values(s);
}

export function answeredCount(team, statements) {
  return statements.filter((s) => typeof team.answers[s.id] === 'boolean').length;
}

export function scoreOf(team, key) {
  return Object.entries(key || {}).filter(([sid, v]) => team.answers[sid] === v).length;
}

// Ranking „sportowy”: remisy dzielą miejsce (1, 1, 3…)
export function ranking(teams, key) {
  const rows = teams.map((t) => ({ ...t, score: scoreOf(t, key) })).sort((a, b) => b.score - a.score);
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
  b.innerHTML = '<b>Tryb demo</b><span> · dane tylko w tej przeglądarce</span>';
  (document.querySelector('.brand-bar') || document.body).append(b);
}

export const WINNERS_MSG = 'Wszyscy jesteście zwycięzcami, bo czegoś się nauczyliście!';
