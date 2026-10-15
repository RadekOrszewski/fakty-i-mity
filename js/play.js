import { createStore, isDemo } from './store.js';
import { $, $$, esc, md, fmt, label, teamsOf, statementsOf, answeredCount, ranking, toast, demoBadge, showFatal, WINNERS_MSG } from './common.js';

const app = $('#app');
const params = new URLSearchParams(location.search);
const code = (params.get('room') || '').toUpperCase().trim();

let store, room, me, mounted = null, local = {};
const now = () => Date.now() + store.offset();

init();

async function init() {
  if (!code) return renderCodeForm();
  try {
    store = await createStore();
    if (isDemo) demoBadge();
    const first = await store.get(code);
    if (!first) return msg('Nie ma takiego pokoju', `Sprawdźcie kod <b class="mono">${esc(code)}</b> na ekranie prowadzącego.`, true);
    store.subscribe(code, (r) => { room = r; render(); }, (e) => showFatal(app, e));
    setInterval(onTick, 250);
  } catch (e) {
    showFatal(app, e);
  }
}

const set = (patch) => store.update(code, patch).catch((e) => {
  console.error(e);
  toast('Nie udało się zapisać. Możliwe, że czas już minął.');
});

// ── Render ──────────────────────────────────────────────────

function render() {
  if (!room) { mounted = null; return msg('Sesja zakończona', 'Dzięki za udział! Możecie zamknąć tę stronę.'); }
  me = room.teams?.[store.uid] ? { id: store.uid, ...room.teams[store.uid], answers: room.teams[store.uid].answers || {} } : null;

  let view;
  if (!me) view = ['lobby', 'answering'].includes(room.phase) ? 'join' : 'late';
  else view = room.phase;
  const key = view + (view === 'reveal' ? `:${room.revealIndex}:${!!room.revealShown}` : '');
  if (key !== mounted) { mounted = key; VIEWS[view].mount(); }
  VIEWS[view].update?.();
}

const VIEWS = {
  join: {
    mount() {
      app.innerHTML = `
        <div class="phone">
          <div class="eyebrow">${esc(room.title)}</div>
          <h1>Jak nazywa się Wasza drużyna?</h1>
          <form id="join" class="join-form" autocomplete="off">
            <label for="name" class="sr-only">Nazwa drużyny</label>
            <input id="name" maxlength="30" placeholder="np. Szybki Przepływ" required>
            <button class="btn primary big" type="submit">Dołączamy</button>
          </form>
          <p class="muted small">Jedna osoba z drużyny wpisuje odpowiedzi, reszta doradza.</p>
        </div>`;
      $('#name').focus();
      $('#join').onsubmit = async (e) => {
        e.preventDefault();
        const name = $('#name').value.trim().replace(/\s+/g, ' ');
        if (!name) return;
        const taken = teamsOf(room).some((t) => t.name.toLowerCase() === name.toLowerCase());
        if (taken) return toast('Ta nazwa jest już zajęta. Wymyślcie inną!');
        await set({ ['teams/' + store.uid]: { name, joinedAt: now(), submitted: false } });
      };
    },
  },

  late: {
    mount() { msg('Gra już trwa', 'Odpowiedzi zostały zamknięte. Śledźcie wyniki na ekranie prowadzącego.'); },
  },

  lobby: {
    mount() {
      app.innerHTML = `
        <div class="phone">
          <div class="eyebrow">Jesteście w grze</div>
          <h1 class="team-title">${esc(me.name)}</h1>
          <p class="lead">Czekamy, aż prowadzący wystartuje quiz.</p>
          <div class="pulse" aria-hidden="true"></div>
          <h2 class="small-h">Drużyny w pokoju</h2>
          <ul id="teams" class="team-chips small"></ul>
        </div>`;
    },
    update() {
      $('#teams').innerHTML = teamsOf(room).map((t) => `<li class="team-chip ${t.id === me.id ? 'me' : ''}">${esc(t.name)}</li>`).join('');
    },
  },

  answering: {
    mount() {
      local = { ...me.answers };
      const st = statementsOf(room);
      app.innerHTML = `
        <div class="phone answering-phone">
          <header class="sticky">
            <div class="sticky-row">
              <span class="team-mini">${esc(me.name)}</span>
              <span id="ptimer" class="ptimer mono">0:00</span>
            </div>
            <div class="sticky-row small">
              <span id="pcount" class="muted"></span>
            </div>
          </header>
          <ol class="cards">
            ${st.map((s, i) => `
              <li class="card" data-id="${esc(s.id)}">
                <div class="card-n mono">${i + 1}</div>
                <p class="card-text">${md(s.text)}</p>
                <div class="tf" role="group" aria-label="Odpowiedź na stwierdzenie ${i + 1}">
                  <button type="button" class="tf-btn t" data-v="1" aria-pressed="false">Prawda</button>
                  <button type="button" class="tf-btn f" data-v="0" aria-pressed="false">Fałsz</button>
                </div>
              </li>`).join('')}
          </ol>
          <div class="submit-bar">
            <button id="submit" class="btn primary big wide">Wysyłamy odpowiedzi</button>
            <div id="sent" class="sent" hidden>
              <b>✓ Odpowiedzi wysłane</b>
              <button id="edit" class="btn ghost">Poprawiamy</button>
            </div>
          </div>
        </div>`;
      $$('.tf-btn').forEach((b) => b.onclick = () => {
        if (me.submitted || timeUp()) return;
        const id = b.closest('.card').dataset.id;
        const v = b.dataset.v === '1';
        local[id] = v;
        paintCards();
        set({ [`teams/${store.uid}/answers/${id}`]: v });
      });
      $('#submit').onclick = () => {
        const missing = st.length - answeredCount({ answers: local }, st);
        if (missing && !confirm(`Brakuje ${missing} odp. Nieoznaczone liczą się jako błędne. Wysłać mimo to?`)) return;
        set({ [`teams/${store.uid}/submitted`]: true });
      };
      $('#edit').onclick = () => set({ [`teams/${store.uid}/submitted`]: false });
      onTick();
    },
    update() {
      // Stan z bazy jest źródłem prawdy, ale nie nadpisujemy świeżych lokalnych kliknięć.
      local = { ...me.answers, ...local };
      paintCards();
    },
  },

  closed: {
    mount() {
      const st = statementsOf(room);
      msg('Odpowiedzi zamknięte', `Zaznaczyliście ${answeredCount(me, st)} z ${st.length}. Patrzcie na ekran prowadzącego!`);
    },
  },

  reveal: {
    mount() {
      const st = statementsOf(room);
      const i = room.revealIndex || 0;
      const s = st[i];
      const correct = room.key?.[s.id];
      const shown = room.revealShown && typeof correct === 'boolean';
      const mine = me.answers[s.id];
      const score = Object.entries(room.key || {}).filter(([id, v]) => me.answers[id] === v).length;
      const revealedSoFar = Object.keys(room.key || {}).length;
      app.innerHTML = `
        <div class="phone">
          <div class="eyebrow">Stwierdzenie ${i + 1} z ${st.length}</div>
          <p class="statement-sm">${md(s.text)}</p>
          <div class="my-answer">Wasza odpowiedź: <b>${label(mine)}</b></div>
          ${shown
            ? `<div class="verdict-sm ${mine === correct ? 'ok' : 'bad'}">${mine === correct ? '✓ Dobrze!' : '✗ Niestety'}</div>
               <p class="muted">Poprawna odpowiedź: <b>${label(correct)}</b></p>`
            : '<div class="verdict-sm pending">Czekamy na rozstrzygnięcie…</div>'}
          <p class="score-line mono">Punkty: ${score}/${revealedSoFar}</p>
        </div>`;
    },
  },

  leaderboard: {
    mount() {
      const st = statementsOf(room);
      const rows = ranking(teamsOf(room), room.key);
      const mine = rows.find((r) => r.id === me.id);
      app.innerHTML = `
        <div class="phone">
          <div class="eyebrow">Koniec gry</div>
          <h1 class="team-title">${esc(me.name)}</h1>
          <div class="big-place"><span class="mono">${mine.place}.</span> miejsce</div>
          <p class="score-line mono">${mine.score}/${st.length} poprawnych</p>
          <div class="winners">${esc(WINNERS_MSG)}</div>
        </div>`;
    },
  },
};

function paintCards() {
  $$('.card').forEach((c) => {
    const v = local[c.dataset.id];
    c.classList.toggle('answered', typeof v === 'boolean');
    c.querySelector('.t').setAttribute('aria-pressed', v === true);
    c.querySelector('.f').setAttribute('aria-pressed', v === false);
  });
  const st = statementsOf(room);
  const n = answeredCount({ answers: local }, st);
  const c = $('#pcount');
  if (c) c.textContent = `Zaznaczone: ${n}/${st.length}`;
  const locked = !!me.submitted || timeUp();
  $('.answering-phone')?.classList.toggle('locked', locked);
  const sub = $('#submit'), sent = $('#sent');
  if (sub) sub.hidden = !!me.submitted;
  if (sent) sent.hidden = !me.submitted;
}

function timeUp() { return room?.phase === 'answering' && room.phaseEndsAt - now() <= 0; }

function onTick() {
  if (!room || room.phase !== 'answering' || !me) return;
  const left = room.phaseEndsAt - now();
  const t = $('#ptimer');
  if (t) { t.textContent = fmt(left); t.classList.toggle('warn', left < 30e3); }
  if (left <= 0 && !$('.answering-phone')?.classList.contains('locked')) paintCards();
}

function msg(title, body, retry = false) {
  app.innerHTML = `
    <div class="phone center">
      <h1>${title}</h1>
      <p class="lead">${body}</p>
      ${retry ? '<a class="btn ghost" href="play.html">Wpisz inny kod</a>' : ''}
    </div>`;
}

function renderCodeForm() {
  app.innerHTML = `
    <div class="phone center">
      <div class="eyebrow">Quiz w drużynach</div>
      <h1>Wpiszcie kod pokoju</h1>
      <form id="cf" class="join-form" autocomplete="off">
        <label for="c" class="sr-only">Kod pokoju</label>
        <input id="c" class="mono code-input" maxlength="4" placeholder="ABCD" required>
        <button class="btn primary big" type="submit">Dalej</button>
      </form>
    </div>`;
  $('#cf').onsubmit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(location.search);
    p.set('room', $('#c').value.trim().toUpperCase());
    location.search = p.toString();
  };
}
