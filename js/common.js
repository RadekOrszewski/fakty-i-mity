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

// Tłumaczy typowe błędy Firebase na konkretną wskazówkę, co poprawić.
export function explainError(e) {
  const raw = String(e?.code || '') + ' ' + String(e?.message || e || '');
  const r = raw.toLowerCase();
  let hint = 'Nieznany błąd. Otwórz konsolę przeglądarki (F12 → Console), tam są szczegóły.';
  if (r.includes('permission_denied') || r.includes('permission denied'))
    hint = 'Baza odrzuca dostęp. W Firebase: Realtime Database → Rules → wklej całą zawartość pliku database.rules.json i kliknij Publish.';
  else if (r.includes('admin-restricted-operation') || r.includes('operation-not-allowed'))
    hint = 'Logowanie anonimowe jest wyłączone. W Firebase: Authentication → Sign-in method → Anonymous → Enable.';
  else if (r.includes('unauthorized-domain') || r.includes('requests-from-referer'))
    hint = 'Domena strony nie jest dozwolona. W Firebase: Authentication → Settings → Authorized domains → dodaj radekorszewski.github.io (bez https i bez ścieżki).';
  else if (r.includes('api-key-not-valid') || r.includes('invalid-api-key'))
    hint = 'Nieprawidłowy apiKey w js/config.js. Skopiuj konfigurację ponownie z Project settings.';
  else if (r.includes('timeout'))
    hint = 'Brak odpowiedzi z bazy. Sprawdź, czy databaseURL w js/config.js jest dokładnie taki jak adres na ekranie Realtime Database, i czy baza została utworzona.';
  else if (r.includes('failed to fetch') || r.includes('importing a module') || r.includes('network'))
    hint = 'Nie udało się pobrać bibliotek Firebase. Sprawdź połączenie z internetem lub blokery treści.';
  return { hint, raw: raw.trim() };
}

export function showFatal(el, e) {
  console.error(e);
  const { hint, raw } = explainError(e);
  el.innerHTML = `<div class="center-msg fatal">
    <div class="eyebrow">Problem z połączeniem</div>
    <h1>Nie udało się przygotować gry</h1>
    <p class="lead">${esc(hint)}</p>
    <p class="muted small mono">${esc(raw)}</p>
    <button class="btn ghost" onclick="location.reload()">Spróbuj ponownie</button>
  </div>`;
}

export const WINNERS_MSG = 'Wszyscy jesteście zwycięzcami, bo czegoś się nauczyliście!';
