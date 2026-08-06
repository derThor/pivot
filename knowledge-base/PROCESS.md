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
  [frontend-shadcn-base-ui.md](./frontend/frontend-shadcn-base-ui.md))

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

## Struktur: Unterordner pro Themenbereich

Seit 2026-08-02 (15 Einträge erreicht) liegen die Einträge in
Unterordnern nach Themenbereich:

- `auth/` – Login/Token-Flow, Backend und Frontend
- `content/` – Content-Modell, -Editor, -CRUD
- `media/` – Upload, Bearbeiten/Löschen, Vorschau
- `frontend/` – Frontend-Themen ohne eigenen größeren Bereich (UI-Basis,
  projektweite UI-Konventionen, Benutzerverwaltung-UI, Taxonomie-UI)
- `tooling/` – Monorepo/Build/Test-Infrastruktur

`INDEX.md`, `PROCESS.md` und `TEMPLATE.md` bleiben auf oberster Ebene.

**Neuen Eintrag anlegen:**

1. Passt das Thema zu einem bestehenden Ordner? → Datei dort anlegen.
2. Kein passender Ordner vorhanden? → Datei zunächst direkt in
   `knowledge-base/` (flach) anlegen. Ein neuer Themenbereich bekommt erst
   dann einen eigenen Ordner, wenn er 3–4 Einträge erreicht hat – für ein
   bis zwei Dateien lohnt sich die Verschachtelung nicht.
3. Bei Links zwischen Einträgen: relative Pfade verwenden
   (`./andere-datei.md` innerhalb desselben Ordners,
   `../anderer-ordner/datei.md` ordnerübergreifend). Links von einem
   Unterordner nach `docs/` brauchen ein zusätzliches `../`
   (`../../docs/ROADMAP.md`, nicht `../docs/ROADMAP.md`).

## Stil

- Kurz und konkret, keine Wiederholung von Code, der sich selbst erklärt.
- Immer mit Datum versehen (Format `YYYY-MM-DD`), damit Aussagen später
  zeitlich einordbar bleiben.
- Auf betroffene Dateien mit Pfad verweisen, nicht den Code duplizieren.
