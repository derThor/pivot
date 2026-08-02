# Update-Prozess der Knowledge Base

## Regel

**Jedes neue Feature bekommt vor Abschluss der Aufgabe einen Knowledge-Base-Eintrag
oder eine Aktualisierung eines bestehenden Eintrags.** Das gilt für:

- neue Backend-Module/Endpoints
- neue Frontend-Bereiche/Komponententypen
- Änderungen am Datenmodell (Prisma-Schema)
- nicht-triviale Architektur- oder Tooling-Entscheidungen
- Workarounds für Bugs/Eigenheiten von Dependencies (z.B. das
  `render`-statt-`asChild`-Pattern von Base UI, siehe
  [frontend-shadcn-base-ui.md](./frontend-shadcn-base-ui.md))

Kleine Bugfixes oder reine Refactorings ohne neues Verhalten benötigen keinen
eigenen Eintrag.

## Ablauf bei einem neuen Feature

1. Feature implementieren (Code + ggf. Migration).
2. Prüfen: gibt es bereits einen passenden Eintrag in `knowledge-base/`, der
   erweitert werden sollte, oder braucht es einen neuen?
3. Eintrag nach dem Schema in [TEMPLATE.md](./TEMPLATE.md) anlegen/aktualisieren:
   Was wurde gebaut, warum diese Lösung (nicht nur "was"), welche
   Stolpersteine gab es, welche Dateien sind relevant.
4. Eintrag in der Tabelle in [INDEX.md](./INDEX.md) verlinken bzw. das
   "Zuletzt aktualisiert"-Datum aktualisieren.
5. Falls das Feature den Funktionsumfang des CMS verändert: auch
   [`docs/FEATURES.md`](../docs/FEATURES.md) aktualisieren (Status-Spalte).
6. Falls das Feature einen neuen Roadmap-Punkt abschließt: den entsprechenden
   Punkt in [`docs/ROADMAP.md`](../docs/ROADMAP.md) abhaken.

## Warum ein separates System zu `docs/`

- `docs/` beantwortet **Plan-Fragen**: Wohin geht die Reise, was ist der
  Sollzustand, welche Reihenfolge ergibt Sinn.
- `knowledge-base/` beantwortet **Ist-Fragen**: Was wurde konkret gebaut, wie
  funktioniert es, welche nicht offensichtlichen Entscheidungen/Fallstricke
  gibt es. Das ist der Teil, der bei reiner Code-Lektüre am ehesten verloren
  geht (das "Warum" hinter einer Entscheidung).

## Struktur: wann in Unterordner gruppieren

Aktuell liegen alle Einträge flach in `knowledge-base/`, unterschieden durch
sprechende Datei-Präfixe (`auth-*`, `content-*`, `frontend-*`,
`tooling-*`). Das bleibt so, solange:

- kein Themenbereich (Präfix) 4 oder mehr Dateien hat, und
- die Gesamtzahl der Einträge unter ca. 12–15 liegt (die Tabelle in
  [INDEX.md](./INDEX.md) bleibt sonst unübersichtlich).

Wird eine dieser Schwellen überschritten: Unterordner pro Themenbereich
anlegen (z.B. `knowledge-base/auth/`, `knowledge-base/content/`,
`knowledge-base/frontend/`), bestehende Dateien passend verschieben und
die Links in `INDEX.md` entsprechend anpassen. Nicht vorher aufteilen –
zu frühe Verschachtelung macht das Nachschlagen bei einer Handvoll
Dateien eher schwerer als leichter.

## Stil

- Kurz und konkret, keine Wiederholung von Code, der sich selbst erklärt.
- Immer mit Datum versehen (Format `YYYY-MM-DD`), damit Aussagen später
  zeitlich einordbar bleiben.
- Auf betroffene Dateien mit Pfad verweisen, nicht den Code duplizieren.
