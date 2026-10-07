// Warstwa danych: jeden interfejs, dwie implementacje.
//  • demo     – localStorage + zdarzenia 'storage' (karty w jednej przeglądarce)
//  • firebase – Firebase Realtime Database + anonimowe logowanie
//
// Interfejs:
//   uid, mode, offset()            – id tej karty/urządzenia, tryb, przesunięcie zegara serwera (ms)
//   get(code)                      – jednorazowy odczyt pokoju
//   create(code, data)             – utworzenie pokoju
//   update(code, {'a/b': v, ...})  – zapis wielu ścieżek naraz (null = usuń)
//   remove(code)                   – usunięcie pokoju
//   subscribe(code, fn)            – fn(room|null) przy każdej zmianie
//   cleanup(ttlMs)                 – usunięcie pokojów starszych niż ttl

import { FIREBASE_CONFIG } from './config.js';

const params = new URLSearchParams(location.search);
export const isDemo = params.has('demo') || !FIREBASE_CONFIG;

export async function createStore() {
  return isDemo ? demoStore() : firebaseStore();
}

function setPath(obj, path, val) {
  const parts = path.split('/').filter(Boolean);
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  const k = parts[parts.length - 1];
  if (val === null || val === undefined) delete o[k];
  else o[k] = JSON.parse(JSON.stringify(val));
}

function demoStore() {
  const P = 'ksdquiz:room:';
  const listeners = new Map();
  const read = (c) => { try { return JSON.parse(localStorage.getItem(P + c)); } catch { return null; } };
  const emit = (c) => { const v = read(c); (listeners.get(c) || []).forEach((f) => f(v)); };
  addEventListener('storage', (e) => { if (e.key && e.key.startsWith(P)) emit(e.key.slice(P.length)); });

  let uid = sessionStorage.getItem('ksdquiz:uid');
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('ksdquiz:uid', uid); }

  return {
    mode: 'demo',
    uid,
    offset: () => 0,
    async get(c) { return read(c); },
    async create(c, data) { localStorage.setItem(P + c, JSON.stringify(data)); emit(c); },
    async update(c, patch) {
      const r = read(c);
      if (!r) throw new Error('Pokój nie istnieje');
      for (const [p, v] of Object.entries(patch)) setPath(r, p, v);
      localStorage.setItem(P + c, JSON.stringify(r));
      emit(c);
    },
    async remove(c) { localStorage.removeItem(P + c); emit(c); },
    subscribe(c, f) {
      if (!listeners.has(c)) listeners.set(c, new Set());
      listeners.get(c).add(f);
      f(read(c));
      return () => listeners.get(c).delete(f);
    },
    async cleanup(ttl) {
      const limit = Date.now() - ttl;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(P)) continue;
        try { const v = JSON.parse(localStorage.getItem(k)); if (!v || v.createdAt < limit) localStorage.removeItem(k); }
        catch { localStorage.removeItem(k); }
      }
    },
  };
}

async function firebaseStore() {
  const base = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const [{ initializeApp }, A, D] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-database.js'),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  // Sesja per karta: odświeżenie strony zachowuje tożsamość drużyny,
  // a dwie karty w jednej przeglądarce to dwie różne drużyny.
  await A.setPersistence(auth, A.browserSessionPersistence);
  await auth.authStateReady();
  if (!auth.currentUser) await A.signInAnonymously(auth);

  const db = D.getDatabase(app);
  let off = 0;
  D.onValue(D.ref(db, '.info/serverTimeOffset'), (s) => { off = s.val() || 0; });
  const r = (c) => D.ref(db, 'rooms/' + c);

  return {
    mode: 'firebase',
    uid: auth.currentUser.uid,
    offset: () => off,
    async get(c) { return (await D.get(r(c))).val(); },
    create: (c, d) => D.set(r(c), d),
    update: (c, p) => D.update(r(c), p),
    remove: (c) => D.remove(r(c)),
    subscribe(c, f) { return D.onValue(r(c), (s) => f(s.val())); },
    async cleanup(ttl) {
      try {
        const q = D.query(D.ref(db, 'rooms'), D.orderByChild('createdAt'), D.endAt(Date.now() + off - ttl));
        const snap = await D.get(q);
        const jobs = [];
        snap.forEach((ch) => { jobs.push(D.remove(ch.ref)); });
        await Promise.allSettled(jobs);
      } catch (e) { console.warn('Sprzątanie starych pokojów nie powiodło się', e); }
    },
  };
}
