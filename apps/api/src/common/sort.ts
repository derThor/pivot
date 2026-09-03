export type SortDirection = 'asc' | 'desc';

/**
 * Baut die Prisma-Reihenfolge aus den Query-Parametern – gegen eine
 * Positivliste je Liste (Nutzervorgabe, 2026-09-03).
 *
 * **Warum eine Positivliste und kein `{ [sortBy]: dir }`:** der Wert kommt
 * aus der URL. Ein durchgereichter Feldname wäre eine Einladung, nach
 * beliebigen Spalten zu sortieren – auch nach solchen, die es in der
 * Antwort gar nicht gibt, und über Relationen hinweg. Die Liste
 * entscheidet, wonach sortiert werden darf; alles andere fällt still auf
 * die Standard-Reihenfolge zurück.
 *
 * Die Einträge sind Funktionen und keine fertigen Objekte, damit eine
 * Liste auch über eine Relation sortieren kann
 * (`{ author: { lastName: dir } }`) oder mehrere Felder kombinieren
 * (`[{ sortOrder: dir }, { name: 'asc' }]`).
 */
export function resolveOrderBy<T>(
  allowed: Record<string, (dir: SortDirection) => T>,
  fallback: T,
  sortBy?: string,
  sortDir?: SortDirection,
): T {
  if (!sortBy) return fallback;
  const build = allowed[sortBy];
  if (!build) return fallback;
  return build(sortDir === 'asc' ? 'asc' : 'desc');
}
