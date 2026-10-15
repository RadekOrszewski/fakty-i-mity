// Treść quizu. Podmień ten plik, żeby użyć narzędzia na innym module.
//
//  id       – unikalny identyfikator (litery/cyfry, bez kropek i ukośników)
//  text     – stwierdzenie; **pogrubienie** jak w Markdown
//  answer   – true = prawda, false = fałsz
//  comment  – (opcjonalnie) krótki komentarz pokazywany po odsłonięciu odpowiedzi
//
// Uwaga: ten plik jest publiczny w repozytorium. Strona graczy go nie wczytuje
// (dostaje tylko treść stwierdzeń, bez odpowiedzi), ale ktoś, kto zna adres
// repo, mógłby go podejrzeć.

export const QUIZ_TITLE = 'Kanban: Facts and Myths';

export const STATEMENTS = [
  { id: 's01', answer: false, text: 'Lead time always depends on the size of the work item' },
  { id: 's02', answer: false, text: '“Pull” means that each person decides **on their own** **what** to work on next' },
  { id: 's03', answer: true,  text: 'Kanban is a way to improve service delivery' },
  { id: 's04', answer: false, text: 'Kanban ensures that **everyone is always** busy' },
  { id: 's05', answer: true,  text: 'The Kanban Method uses boards to visualize work, flow and the risks related to the items being delivered' },
  { id: 's06', answer: true,  text: 'Once assigned, a priority (class of service) can change while the item is being worked on' },
  { id: 's07', answer: true,  text: 'Kanban helps build the ability to respond to changing demand for services and to changes in the business environment' },
  { id: 's08', answer: false, text: 'Kanban works best in IT maintenance teams' },
  { id: 's09', answer: false, text: 'Kanban is mainly focused on increasing team throughput' },
  { id: 's10', answer: false, text: 'Kanban is a type of project management methodology' },
  { id: 's11', answer: true,  text: 'At a deeper level, Kanban is a method for evolutionary change' },
  { id: 's12', answer: false, text: 'Kanban requires introducing a defined list of practices in a strictly fixed order' },
];
