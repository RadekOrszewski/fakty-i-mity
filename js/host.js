import { createStore, isDemo } from './store.js';
import { STATEMENTS, QUIZ_TITLE } from './statements.js';
import { DEFAULT_DURATION, REVEAL_IN_TWO_STEPS, ROOM_TTL_HOURS } from './config.js';
import { $, $$, esc, md, fmt, label, teamsOf, answeredCount, ranking, toast, demoBadge, showFatal, WINNERS_MSG } from './common.js';

const app = $('#app');
const ANSWERS = Object.fromEntries(STATEMENTS.map((s) => [s.id, s.answer]));
const COMMENTS = Object.fromEntries(STATEMENTS.map((s) => [s.id, s.comment || '']));
const N = STATEMENTS.length;

let store, code, room, mounted = null, closing = false;
const now = () => Date.now() + store.offset();

init();

async function init() {
  try {
    store = await createStore();
    if (isDemo) demoBadge();
    await store.cleanup(ROOM_TTL_HOURS * 3600e3);

    // Odświeżenie strony prowadzącego wraca do tego samego pokoju.
    code = sessionStorage.getItem('ksdquiz:hostRoom');
    const existing = code ? await store.get(code) : null;
    if (!existing || existing.hostUid !== store.uid) code = await newRoom();

    store.subscribe(code, (r) => { room = r; render(); }, (e) => showFatal(app, e));
    setInterval(onTick, 250);
    addEventListener('keydown', onKey);
  } catch (e) {
    showFatal(app, e);
  }
}

async function newRoom() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(''); }
  while (await store.get(c));
  await store.create(c, {
    createdAt: Date.now() + store.offset(),
    hostUid: store.uid,
    title: QUIZ_TITLE,
    phase: 'lobby',
    duration: DEFAULT_DURATION,
    statements: STATEMENTS.map(({ id, text }) => ({ id, text })),
  });
  sessionStorage.setItem('ksdquiz:hostRoom', c);
  return c;
}

const set = (patch) => store.update(code, patch).catch((e) => { console.error(e); toast('Nie udało się zapisać zmiany'); });

function playUrl() {
  const u = new URL('play.html', location.href);
  u.search = '';
  u.searchParams.set('room', code);
  if (new URLSearchParams(location.search).has('demo')) u.searchParams.set('demo', '1');
  return u.toString();
}

// ── Render ──────────────────────────────────────────────────

function render() {
  if (!room) { mounted = null; return renderEnded(); }
  const key = room.phase + (room.phase === 'reveal' ? `:${room.revealIndex}:${!!room.revealShown}` : '');
  if (key !== mounted) { mounted = key; VIEWS[room.phase].mount(); }
  VIEWS[room.phase].update?.();
}

const VIEWS = {
  lobby: {
    mount() {
      const url = playUrl();
      app.innerHTML = `
        <div class="lobby">
          <section class="join-card">
            <div class="eyebrow">Zeskanujcie kod</div>
            <div id="qr" class="qr" aria-label="Kod QR do strony quizu"></div>
            <div class="join-alt">lub wejdźcie na<br><a class="mono" href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a></div>
            <div class="room-code"><span>kod pokoju</span><b class="mono">${code}</b></div>
          </section>
          <section class="lobby-side">
            <div class="eyebrow">Quiz w drużynach</div>
            <h1>${esc(room.title)}</h1>
            <p class="lead">${N} stwierdzeń. Wspólnie zdecydujcie, które są prawdziwe, a które fałszywe.</p>
            <h2>Drużyny <span id="team-count" class="count"></span></h2>
            <ul id="teams" class="team-chips"></ul>
            <div class="duration" role="group" aria-label="Czas na odpowiedzi">
              <span>Czas na odpowiedzi</span>
              ${[3, 5, 7, 10].map((m) => `<button class="chip" data-min="${m}">${m} min</button>`).join('')}
            </div>
            <button id="start" class="btn primary big">Start</button>
          </section>
        </div>`;
      if (window.QRCode) {
        new QRCode($('#qr'), { text: url, width: 320, height: 320, colorDark: '#13204a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      } else {
        $('#qr').innerHTML = '<p class="muted">Nie udało się wczytać generatora QR. Podaj uczestnikom adres poniżej.</p>';
      }
      $$('.duration .chip').forEach((b) => b.onclick = () => set({ duration: +b.dataset.min * 60 }));
      $('#start').onclick = () => {
        const d = room.duration || DEFAULT_DURATION;
        set({ phase: 'answering', phaseEndsAt: now() + d * 1000, phaseTotal: d * 1000 });
      };
    },
    update() {
      const teams = teamsOf(room);
      $('#team-count').textContent = teams.length || '';
      $('#teams').innerHTML = teams.length
        ? teams.map((t) => `<li class="team-chip">${esc(t.name)}<button class="x" data-id="${esc(t.id)}" title="Usuń drużynę" aria-label="Usuń drużynę ${esc(t.name)}">×</button></li>`).join('')
        : '<li class="muted">Czekamy na pierwszą drużynę…</li>';
      $$('#teams .x').forEach((b) => b.onclick = () => {
        if (confirm('Usunąć tę drużynę z gry?')) set({ ['teams/' + b.dataset.id]: null });
      });
      $$('.duration .chip').forEach((b) => b.classList.toggle('on', +b.dataset.min * 60 === (room.duration || DEFAULT_DURATION)));
      $('#start').disabled = teams.length === 0;
    },
  },

  answering: {
    mount() {
      closing = false;
      app.innerHTML = `
        <div class="answering">
          <div class="eyebrow">Drużyny ustalają odpowiedzi</div>
          <div id="timer" class="timer mono">0:00</div>
          <div class="timer-bar"><i id="tbar"></i></div>
          <div id="progress" class="team-progress"></div>
          <div class="host-actions">
            <button id="addmin" class="btn ghost">+1 min</button>
            <button id="endnow" class="btn ghost">Zakończ teraz</button>
          </div>
        </div>`;
      $('#addmin').onclick = () => set({
        phaseEndsAt: Math.max(room.phaseEndsAt, now()) + 60e3,
        phaseTotal: (room.phaseTotal || 0) + 60e3,
      });
      $('#endnow').onclick = () => { if (confirm('Zakończyć zbieranie odpowiedzi?')) closeAnswering('host'); };
      onTick();
    },
    update() {
      const teams = teamsOf(room);
      $('#progress').innerHTML = teams.map((t) => {
        const n = answeredCount(t, STATEMENTS);
        return `<div class="tp ${t.submitted ? 'done' : ''}">
          <div class="tp-name">${esc(t.name)}</div>
          <div class="tp-bar"><i style="width:${(n / N) * 100}%"></i></div>
          <div class="tp-status mono">${t.submitted ? '✓ wysłane' : `${n}/${N}`}</div>
        </div>`;
      }).join('') || '<p class="muted">Brak drużyn</p>';
      if (teams.length && teams.every((t) => t.submitted)) closeAnswering('all');
    },
  },

  closed: {
    mount() {
      const teams = teamsOf(room);
      const reason = room.closedBy === 'all' ? 'Wszystkie drużyny oddały odpowiedzi' : room.closedBy === 'host' ? 'Zbieranie odpowiedzi zakończone' : 'Czas minął';
      app.innerHTML = `
        <div class="center-msg">
          <div class="eyebrow">Koniec odpowiadania</div>
          <h1>${reason}</h1>
          <ul class="closed-list">${teams.map((t) => `<li><b>${esc(t.name)}</b><span class="mono">${answeredCount(t, STATEMENTS)}/${N} odpowiedzi</span></li>`).join('')}</ul>
          <button id="go" class="btn primary big">Odsłaniamy odpowiedzi →</button>
        </div>`;
      $('#go').onclick = () => goTo(0, false);
    },
  },

  reveal: {
    mount() {
      const i = room.revealIndex || 0;
      const s = STATEMENTS[i];
      const correct = s.answer;
      const shown = !!room.revealShown;
      const teams = teamsOf(room);
      const hits = teams.filter((t) => t.answers[s.id] === correct).length;
      const last = i === N - 1;
      app.innerHTML = `
        <div class="reveal">
          <div class="reveal-top">
            <span class="eyebrow">Stwierdzenie ${i + 1} z ${N}</span>
            <div class="dots">${STATEMENTS.map((_, k) => `<i class="${k < i ? 'past' : k === i ? 'now' : ''}"></i>`).join('')}</div>
          </div>
          <blockquote class="statement">${md(s.text)}</blockquote>
          <div class="verdict ${shown ? (correct ? 'is-true' : 'is-false') : 'pending'}">
            ${shown ? (correct ? 'Prawda' : 'Fałsz') : 'Jak odpowiedziały drużyny?'}
          </div>
          ${shown && COMMENTS[s.id] ? `<p class="comment">${md(COMMENTS[s.id])}</p>` : ''}
          <div class="team-answers">
            ${teams.map((t) => {
              const a = t.answers[s.id];
              const ok = a === correct;
              return `<div class="ta ${shown ? (ok ? 'ok' : 'bad') : ''}">
                <div class="ta-name">${esc(t.name)}</div>
                <div class="ta-ans">${label(a)}</div>
                ${shown ? `<div class="ta-mark" aria-label="${ok ? 'dobrze' : 'źle'}">${ok ? '✓' : '✗'}</div>` : ''}
              </div>`;
            }).join('')}
          </div>
          ${shown ? `<p class="tally">${hits} z ${teams.length} ${plural(teams.length)} ${hits === 1 ? 'trafiła' : 'trafiło'}</p>` : ''}
          <nav class="reveal-nav">
            <button id="prev" class="btn ghost" ${i === 0 && !shown ? 'disabled' : ''}>←</button>
            <button id="next" class="btn primary">${!shown ? 'Odsłoń odpowiedź' : last ? 'Tablica wyników →' : 'Następne →'}</button>
          </nav>
          <p class="hint">Strzałki ← → lub spacja</p>
        </div>`;
      $('#prev').onclick = back;
      $('#next').onclick = forward;
    },
  },

  leaderboard: {
    mount() {
      const teams = teamsOf(room);
      const rows = ranking(teams, ANSWERS);
      const best = Math.max(1, ...rows.map((r) => r.score));
      app.innerHTML = `
        <div class="board">
          <section class="board-rank">
            <div class="eyebrow">Tablica wyników</div>
            <ol class="ranking">
              ${rows.map((r) => `
                <li class="${r.place === 1 ? 'first' : ''}">
                  <span class="place mono">${r.place}.</span>
                  <span class="r-name">${esc(r.name)}</span>
                  <span class="r-bar"><i style="width:${(r.score / best) * 100}%"></i></span>
                  <span class="r-score mono">${r.score}/${N}</span>
                </li>`).join('')}
            </ol>
            <div class="winners">${esc(WINNERS_MSG)}</div>
          </section>
          <section class="board-matrix">
            <div class="eyebrow">Wszystkie odpowiedzi</div>
            <div class="matrix-wrap">
              <table class="matrix">
                <thead><tr><th>#</th><th class="st">Stwierdzenie</th><th>Poprawna</th>${teams.map((t) => `<th class="tn">${esc(t.name)}</th>`).join('')}</tr></thead>
                <tbody>
                  ${STATEMENTS.map((s, k) => `<tr>
                    <td class="mono">${k + 1}</td>
                    <td class="st">${md(s.text)}</td>
                    <td><span class="pill ${s.answer ? 'is-true' : 'is-false'}">${s.answer ? 'P' : 'F'}</span></td>
                    ${teams.map((t) => {
                      const a = t.answers[s.id];
                      const ok = a === s.answer;
                      return `<td class="cell ${ok ? 'ok' : 'bad'}" title="${esc(t.name)}: ${label(a)}">${ok ? '✓' : '✗'}</td>`;
                    }).join('')}
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </section>
          <nav class="board-nav">
            <button id="back" class="btn ghost">← Wróć do odpowiedzi</button>
            <button id="end" class="btn danger">Zakończ sesję i usuń dane</button>
          </nav>
        </div>`;
      $('#back').onclick = () => goTo(N - 1, true);
      $('#end').onclick = endSession;
    },
  },
};

function renderEnded() {
  app.innerHTML = `
    <div class="center-msg">
      <div class="eyebrow">Sesja zakończona</div>
      <h1>Dane zostały usunięte</h1>
      <p class="lead">Wyniki tej gry nie są już nigdzie przechowywane.</p>
      <button id="again" class="btn primary big">Nowa gra</button>
    </div>`;
  $('#again').onclick = () => { sessionStorage.removeItem('ksdquiz:hostRoom'); location.reload(); };
}

// ── Logika faz ──────────────────────────────────────────────

function onTick() {
  if (!room || room.phase !== 'answering') return;
  const left = room.phaseEndsAt - now();
  const t = $('#timer'), bar = $('#tbar');
  if (t) {
    t.textContent = fmt(left);
    t.classList.toggle('warn', left < 30e3);
  }
  if (bar) bar.style.width = `${Math.max(0, Math.min(1, left / (room.phaseTotal || 1))) * 100}%`;
  if (left <= 0) closeAnswering('time');
}

function closeAnswering(by) {
  if (closing) return;
  closing = true;
  set({ phase: 'closed', closedBy: by, phaseEndsAt: now() });
}

function goTo(i, shown) {
  if (!REVEAL_IN_TWO_STEPS) shown = true;
  const patch = { phase: 'reveal', revealIndex: i, revealShown: shown };
  // Klucz odpowiedzi trafia do bazy dopiero w momencie odsłonięcia,
  // więc telefony drużyn nie znają rozwiązań wcześniej.
  if (shown) patch['key/' + STATEMENTS[i].id] = STATEMENTS[i].answer;
  set(patch);
}

function forward() {
  const i = room.revealIndex || 0;
  if (!room.revealShown) return goTo(i, true);
  if (i < N - 1) return goTo(i + 1, false);
  set({ phase: 'leaderboard', key: ANSWERS });
}

function back() {
  const i = room.revealIndex || 0;
  if (room.revealShown && REVEAL_IN_TWO_STEPS) return goTo(i, false);
  if (i > 0) goTo(i - 1, true);
}

function onKey(e) {
  if (!room || e.target.closest('input, textarea')) return;
  if (room.phase === 'reveal') {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); forward(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); back(); }
  }
}

async function endSession() {
  if (!confirm('Zakończyć sesję? Wszystkie odpowiedzi zostaną trwale usunięte.')) return;
  await store.remove(code);
  sessionStorage.removeItem('ksdquiz:hostRoom');
}

function plural(n) {
  if (n === 1) return 'drużyny';
  return 'drużyn';
}
