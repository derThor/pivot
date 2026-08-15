# `loading.tsx` zeigt immer sofort, nicht nur bei echter Verzögerung

**Datum:** 2026-08-15
**Betroffene Bereiche:** apps/web (App Router, `src/app/dashboard/**`)

## Was wurde versucht

Nach dem Masonry-Spaltenzahl-Flip-Fix bei Medien (siehe
[media-library-redesign.md](../media/media-library-redesign.md)) wurde
testweise Next.js-Routen-`loading.tsx` für FAQs, Galerien, Medien und
Tags ergänzt, mit der Erwartung: "nur laden, wenn wirklich noch nichts
da ist, sonst soll man davon nichts mitbekommen" (Nutzervorgabe).

**Live-Test-Ergebnis**: Der Skeleton wurde bei FAQs/Galerien **bei
jeder Navigation** angezeigt, obwohl diese Seiten vorher ohne
`loading.tsx` nie spürbar geladen haben ("war vorher nie am laden").

## Warum das nicht funktioniert wie erwartet

**Falsche Annahme korrigiert**: Next.js' `loading.js`-Konvention zeigt
den Fallback bei einer Client-seitigen `<Link>`-Navigation **sofort**
an, sobald die Route betreten wird – nicht erst nach einer gewissen
Wartezeit. Das ist kein React-`Suspense`-"blendet erst bei echter
Verzögerung ein"-Verhalten (wie man von reinem `startTransition` +
`Suspense` erwarten könnte), sondern eine bewusste Next.js-Design-
Entscheidung: sobald eine Route ein `loading.tsx` hat, wird es bei
jeder Navigation dorthin unmittelbar gerendert, unabhängig davon, wie
schnell die eigentlichen Daten da sind. Es gibt **keine eingebaute
Schwelle** ("nur anzeigen, wenn Laden > 200ms dauert").

**Fix**: Die 4 `loading.tsx`-Dateien wieder entfernt (waren echte UX-
Verschlechterung, kein Fix). Das eigentliche Flip-Problem (Medien-
Masonry-Spaltenzahl) war ohnehin schon separat über `useLayoutEffect`
statt `useEffect` gelöst (siehe Medien-Doku) – dort ging es um eine
clientseitige Layout-Messung, kein Server-Daten-Ladezustand.

## Lehre für künftige Fälle

- **`loading.tsx` (Next.js App Router) eignet sich nicht für "nur bei
  echter Verzögerung anzeigen"** – wer das will, braucht einen
  manuellen, verzögerten Suspense-Fallback (z.B. eigene Wrapper-
  Komponente mit `setTimeout`/Timer, die den Fallback erst nach einer
  Mindestwartezeit überhaupt rendert), nicht die Routen-Konvention.
  Deutlich aufwendiger – vor dem Bau erst klären, ob der Aufwand für
  die betroffene Seite wirklich gerechtfertigt ist (bei schnellen,
  lokalen/kleinen Datenmengen in der Regel nicht).
- **Flip-/Layout-Sprung-Bugs** (Inhalt springt von falscher zu
  richtiger Größe) und **fehlendes Ladefeedback bei langsamen
  Server-Requests** sind zwei unterschiedliche Probleme mit
  unterschiedlichen Lösungen – ersteres ist eine clientseitige
  Layout-Messung, die vor dem ersten Paint korrigiert werden muss
  (`useLayoutEffect`), zweiteres bräuchte (falls überhaupt gewünscht)
  einen bewusst verzögerten Skeleton, keine Standard-`loading.tsx`.
