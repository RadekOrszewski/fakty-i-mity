// Treść quizu. Podmień ten plik, żeby użyć narzędzia na innym module.
//
//  id       – unikalny identyfikator (litery/cyfry, bez kropek i ukośników)
//  text     – stwierdzenie; **pogrubienie** jak w Markdown
//  answer   – true = prawda, false = fałsz
//  comment  – (opcjonalnie) krótki komentarz pokazywany po odsłonięciu odpowiedzi
//
// Uwaga: ten plik jest publiczny w repozytorium. Strona drużyn go nie wczytuje
// (dostaje tylko treść stwierdzeń, bez odpowiedzi), ale ktoś, kto zna adres
// repo, mógłby go podejrzeć.

export const QUIZ_TITLE = 'Kanban: fakty i mity';

export const STATEMENTS = [
  { id: 's01', answer: false, text: 'Czas realizacji zawsze zależy od wielkości zadania' },
  { id: 's02', answer: false, text: '„Pull” oznacza, że każda osoba **samodzielnie** decyduje **co** wybrać jako następne do realizacji' },
  { id: 's03', answer: true,  text: 'Kanban to sposób na doskonalenie dostarczania usług' },
  { id: 's04', answer: false, text: 'Kanban zapewnia, że **wszyscy zawsze** są zajęci' },
  { id: 's05', answer: true,  text: 'Metoda Kanban używa tablic do wizualizacji zadań, przepływu i ryzyka związanego z dostarczanymi elementami' },
  { id: 's06', answer: true,  text: 'Raz nadany priorytet (klasa usług) może ulec zmianie w trakcie pracy nad zadaniem' },
  { id: 's07', answer: true,  text: 'Kanban pomaga uzyskać zdolność do odpowiadania na zmienne zapotrzebowanie na usługi i zmiany w środowisku biznesowym' },
  { id: 's08', answer: false, text: 'Kanban sprawdza się najlepiej w zespołach utrzymaniowych IT' },
  { id: 's09', answer: false, text: 'Kanban jest głównie skupiony na zwiększaniu przepustowości zespołu' },
  { id: 's10', answer: false, text: 'Kanban to rodzaj metodyki prowadzenia projektów' },
  { id: 's11', answer: true,  text: 'W głębszym sensie Kanban to metoda przeprowadzania zmian drogą ewolucyjną' },
  { id: 's12', answer: false, text: 'Kanban wymaga wprowadzenia określonej listy praktyk w ściśle ustalonej kolejności' },
];
