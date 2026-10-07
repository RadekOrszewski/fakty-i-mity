// ─────────────────────────────────────────────────────────────
//  Konfiguracja quizu
// ─────────────────────────────────────────────────────────────
//
//  1) Tryb DEMO (bez Firebase): zostaw FIREBASE_CONFIG = null.
//     Wszystko działa w jednej przeglądarce: otwórz index.html
//     w jednej karcie i play.html w kolejnych (każda karta = drużyna).
//
//  2) Tryb NA ŻYWO: wklej tu obiekt konfiguracyjny z Firebase
//     (Project settings → General → Your apps → Web app → Config).
//     Instrukcja krok po kroku: README.md
//
//  Tryb demo można wymusić zawsze, dopisując ?demo=1 do adresu.

export const FIREBASE_CONFIG = null;

/*
export const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "twoj-projekt.firebaseapp.com",
  databaseURL: "https://twoj-projekt-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "twoj-projekt",
  appId: "...",
};
*/

// Domyślny czas na ustalenie odpowiedzi (sekundy). Prowadzący może go zmienić w lobby.
export const DEFAULT_DURATION = 300;

// true  = przy każdym stwierdzeniu najpierw widać odpowiedzi drużyn, a poprawna
//         odpowiedź pojawia się po kolejnym kliknięciu (miejsce na dyskusję).
// false = poprawna odpowiedź i wyniki drużyn pokazują się od razu.
export const REVEAL_IN_TWO_STEPS = true;

// Po ilu godzinach stare pokoje są usuwane przy zakładaniu nowego.
export const ROOM_TTL_HOURS = 24;
