# Kanban: fakty i mity — quiz indywidualny

Prowadzący wyświetla kod QR, gracze dołączają ze swoich telefonów, każdy samodzielnie klasyfikuje stwierdzenia jako prawda/fałsz na czas, a potem prowadzący odsłania odpowiedzi jedna po drugiej i pokazuje tablicę wyników.

- `index.html` — ekran prowadzącego (rzutnik)
- `play.html` — ekran gracza (telefon, otwierany z kodu QR)
- `js/statements.js` — treść quizu (podmień, żeby użyć na innym module)
- `js/config.js` — konfiguracja Firebase i ustawienia
- `database.rules.json` — reguły bezpieczeństwa bazy

Statyczna strona (GitHub Pages) + Firebase Realtime Database jako tymczasowy „stół do gry”. Żadnych danych osobowych, tylko imiona lub pseudonimy graczy i ich odpowiedzi. Pokój jest usuwany przyciskiem „Zakończ sesję i usuń dane”, a porzucone pokoje starsze niż 24 h znikają automatycznie przy zakładaniu kolejnego.

## Przebieg gry

1. **Lobby** — QR, adres i kod pokoju. Gracze pojawiają się na liście na żywo (× usuwa omyłkowo dodanego). Wybierasz czas (3/5/7/10 min) i klikasz Start.
2. **Odpowiadanie** — duży timer i postęp każdego gracza. Odpowiedzi zapisują się od razu po kliknięciu. Faza kończy się, gdy wszyscy gracze klikną „Wysyłam”, gdy minie czas albo po „Zakończ teraz”. Jest też „+1 min”.
3. **Odsłanianie** — stwierdzenie i odpowiedzi graczy, kolejne kliknięcie odsłania poprawną odpowiedź z ✓/✗. Sterowanie: strzałki ← → lub spacja (działa też z pilotem do prezentacji).
4. **Tablica wyników** — ranking (remisy dzielą miejsce), macierz wszystkich odpowiedzi i komunikat dla wszystkich.

Telefony graczy na bieżąco pokazują ich wynik przy każdym stwierdzeniu i miejsce na koniec.

Brak odpowiedzi liczy się jako błędna. Jeśli wolisz odsłaniać od razu w jednym kroku, ustaw `REVEAL_IN_TWO_STEPS = false` w `js/config.js`.

## Szybki test bez Firebase (tryb demo)

Gdy `FIREBASE_CONFIG = null`, aplikacja działa w trybie demo: wszystko dzieje się w jednej przeglądarce. Otwórz `index.html` w jednej karcie, a link spod kodu QR w kilku kolejnych kartach — każda karta to osobny gracz.

Moduły JS nie działają z `file://`, więc potrzebny jest lokalny serwer:

```bash
cd ksd-fakty-mity
python3 -m http.server 8000
# otwórz http://localhost:8000
```

## Uruchomienie na żywo

### 1. Firebase (~10 min, darmowy plan Spark)

1. Wejdź na https://console.firebase.google.com i utwórz projekt (Google Analytics niepotrzebne).
2. **Build → Realtime Database → Create database**. Lokalizacja: `europe-west1`. Tryb: *locked mode*.
3. W zakładce **Rules** wklej zawartość `database.rules.json` i kliknij *Publish*.
4. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
5. **Authentication → Settings → Authorized domains** → dodaj `twoj-login.github.io`.
6. **Project settings (⚙️) → General → Your apps → ikona `</>`** → zarejestruj aplikację webową (bez Hostingu) i skopiuj obiekt `firebaseConfig`.
7. Wklej go do `js/config.js` w miejsce `FIREBASE_CONFIG = null`. Sprawdź, czy zawiera `databaseURL`; jeśli nie, skopiuj adres z ekranu Realtime Database.

Klucz `apiKey` w konfiguracji webowej Firebase nie jest sekretem: dostęp do danych pilnują reguły z `database.rules.json`.

### 2. GitHub Pages

1. Utwórz repozytorium i wrzuć zawartość tego folderu (z `index.html` w katalogu głównym).
2. **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Po minucie strona działa pod `https://twoj-login.github.io/nazwa-repo/`.

### 3. Test przed szkoleniem

Otwórz stronę prowadzącego na laptopie i zeskanuj QR dwoma telefonami (albo użyj dwóch różnych przeglądarek). Przejdź cały flow do tablicy wyników i kliknij „Zakończ sesję”.

## Co pilnują reguły bazy

- Tylko prowadzący (anonimowy użytkownik, który założył pokój) zmienia fazę gry i może usunąć pokój.
- Gracz może zapisywać wyłącznie swoje dane i tylko w lobby oraz w trakcie odliczania (plus 3 s tolerancji). Po czasie zapis jest odrzucany po stronie serwera.
- Imię gracza: 1–30 znaków, odpowiedzi tylko true/false.
- Każdy może usunąć pokój starszy niż 24 h — to mechanizm sprzątania.

Poprawne odpowiedzi trafiają do bazy dopiero w momencie odsłonięcia, więc telefon gracza nie zna ich wcześniej. Sam plik `js/statements.js` jest jednak publiczny w repozytorium.

## Dobrze wiedzieć

- Odświeżenie strony (prowadzącego lub gracza) wraca do tej samej gry. Zamknięcie karty i otwarcie nowej tworzy nową tożsamość.
- Jeden gracz = jedno urządzenie.
- Firebase komunikuje się przez HTTPS/WebSocket na porcie 443, więc działa w typowych sieciach firmowych.
- Darmowy plan Firebase (100 jednoczesnych połączeń, 1 GB danych) wystarcza z ogromnym zapasem.
