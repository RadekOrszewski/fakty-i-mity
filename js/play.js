import { createStore, isDemo } from './store.js';
import { $, $$, esc, md, fmt, label, playersOf, statementsOf, answeredCount, ranking, toast, demoBadge, showFatal, WINNERS_MSG } from './common.js';

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
    if (!first) return msg('Room not found', `Check the code <b class="mono">${esc(code)}</b> on the host screen.`, true);
    store.subscribe(code, (r) => { room = r; render(); }, (e) => showFatal(app, e));
    setInterval(onTick, 250);
  } catch (e) {
    showFatal(app, e);
  }
}

const set = (patch) => store.update(code, patch).catch((e) => {
  console.error(e);
  toast('Could not save. Time may already be up.');
});

// ── Render ──────────────────────────────────────────────────

function render() {
  if (!room) { mounted = null; return msg('Session ended', 'Thanks for playing! You can close this page.'); }
  me = room.players?.[store.uid] ? { id: store.uid, ...room.players[store.uid], answers: room.players[store.uid].answers || {} } : null;

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
          <h1>What’s your name?</h1>
          <form id="join" class="join-form" autocomplete="off">
            <label for="name" class="sr-only">Name or nickname</label>
            <input id="name" maxlength="30" placeholder="e.g. Alex" required>
            <button class="btn primary big" type="submit">Join</button>
          </form>
          <p class="muted small">Everyone plays on their own phone and answers on their own.</p>
        </div>`;
      $('#name').focus();
      $('#join').onsubmit = async (e) => {
        e.preventDefault();
        const name = $('#name').value.trim().replace(/\s+/g, ' ');
        if (!name) return;
        const taken = playersOf(room).some((t) => t.name.toLowerCase() === name.toLowerCase());
        if (taken) return toast('That name is already taken. Pick another one!');
        await set({ ['players/' + store.uid]: { name, joinedAt: now(), submitted: false } });
      };
    },
  },

  late: {
    mount() { msg('Game in progress', 'Answers are closed. Follow the results on the host screen.'); },
  },

  lobby: {
    mount() {
      app.innerHTML = `
        <div class="phone">
          <div class="eyebrow">You’re in the game</div>
          <h1 class="player-title">${esc(me.name)}</h1>
          <p class="lead">Waiting for the host to start the quiz.</p>
          <div class="pulse" aria-hidden="true"></div>
          <h2 class="small-h">Players in the room</h2>
          <ul id="players" class="player-chips small"></ul>
        </div>`;
    },
    update() {
      $('#players').innerHTML = playersOf(room).map((t) => `<li class="player-chip ${t.id === me.id ? 'me' : ''}">${esc(t.name)}</li>`).join('');
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
              <span class="player-mini">${esc(me.name)}</span>
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
                <div class="tf" role="group" aria-label="Answer to statement ${i + 1}">
                  <button type="button" class="tf-btn t" data-v="1" aria-pressed="false">True</button>
                  <button type="button" class="tf-btn f" data-v="0" aria-pressed="false">False</button>
                </div>
              </li>`).join('')}
          </ol>
          <div class="submit-bar">
            <button id="submit" class="btn primary big wide">Submit answers</button>
            <div id="sent" class="sent" hidden>
              <b>✓ Answers submitted</b>
              <button id="edit" class="btn ghost">Edit answers</button>
            </div>
          </div>
        </div>`;
      $$('.tf-btn').forEach((b) => b.onclick = () => {
        if (me.submitted || timeUp()) return;
        const id = b.closest('.card').dataset.id;
        const v = b.dataset.v === '1';
        local[id] = v;
        paintCards();
        set({ [`players/${store.uid}/answers/${id}`]: v });
      });
      $('#submit').onclick = () => {
        const missing = st.length - answeredCount({ answers: local }, st);
        if (missing && !confirm(`${missing} unanswered. Unanswered statements count as wrong. Submit anyway?`)) return;
        set({ [`players/${store.uid}/submitted`]: true });
      };
      $('#edit').onclick = () => set({ [`players/${store.uid}/submitted`]: false });
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
      msg('Answers closed', `You answered ${answeredCount(me, st)} of ${st.length}. Watch the host screen!`);
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
          <div class="eyebrow">Statement ${i + 1} of ${st.length}</div>
          <p class="statement-sm">${md(s.text)}</p>
          <div class="my-answer">Your answer: <b>${label(mine)}</b></div>
          ${shown
            ? `<div class="verdict-sm ${mine === correct ? 'ok' : 'bad'}">${mine === correct ? '✓ Correct!' : '✗ Not quite'}</div>
               <p class="muted">Correct answer: <b>${label(correct)}</b></p>`
            : '<div class="verdict-sm pending">Waiting for the answer…</div>'}
          <p class="score-line mono">Score: ${score}/${revealedSoFar}</p>
        </div>`;
    },
  },

  leaderboard: {
    mount() {
      const st = statementsOf(room);
      const rows = ranking(playersOf(room), room.key);
      const mine = rows.find((r) => r.id === me.id);
      app.innerHTML = `
        <div class="phone">
          <div class="eyebrow">Game over</div>
          <h1 class="player-title">${esc(me.name)}</h1>
          <div class="big-place"><span class="mono">${ordinal(mine.place)}</span> place</div>
          <p class="score-line mono">${mine.score}/${st.length} correct</p>
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
  if (c) c.textContent = `Answered: ${n}/${st.length}`;
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
      ${retry ? '<a class="btn ghost" href="play.html">Enter a different code</a>' : ''}
    </div>`;
}

function renderCodeForm() {
  app.innerHTML = `
    <div class="phone center">
      <div class="eyebrow">Individual quiz</div>
      <h1>Enter the room code</h1>
      <form id="cf" class="join-form" autocomplete="off">
        <label for="c" class="sr-only">Room code</label>
        <input id="c" class="mono code-input" maxlength="4" placeholder="ABCD" required>
        <button class="btn primary big" type="submit">Next</button>
      </form>
    </div>`;
  $('#cf').onsubmit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(location.search);
    p.set('room', $('#c').value.trim().toUpperCase());
    location.search = p.toString();
  };
}

function ordinal(n) {
  const t = n % 100;
  const suffix = t >= 11 && t <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return n + suffix;
}
