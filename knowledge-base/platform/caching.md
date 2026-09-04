# Caching (Backend & Frontend)

**Nutzervorgabe, 2026-09-03:** *„bau mir unter einstellungen einen neuen
Menüpunkt, caching und hier settings für backend cache und frontend caching
und jeweils einen button, wo ich den sofort löschen kann"* – anschließend
präzisiert: *„caching als eigener punkt. oberpunkt"*, also eine eigene
Gruppe in der Einstellungs-Navigation statt eines Bereichs unter „Betrieb".

## Zwei völlig verschiedene Zwischenspeicher

Der Begriff „Cache" meint hier zwei Dinge, die nichts miteinander zu tun
haben – deshalb zwei Karten statt einer:

| | Backend | Frontend |
| --- | --- | --- |
| Wo | `CacheService`, im Arbeitsspeicher des API-Prozesses | Next.js Data/Full Route Cache in `apps/site` |
| Was | Ergebnisse wiederholter Datenbankabfragen | Antworten der Content-Delivery-API und gerenderte Seiten |
| Wer nutzt es | aktuell **nur** `UsersService.getNotificationCounts()` | jede Seite der öffentlichen Website |
| Leeren | `POST /settings/clear-cache` | `revalidatePath("/", "layout")` im Website-Prozess |

Dass der Backend-Cache genau **einen** Nutzer hat, ist kein Versehen: er
war von Anfang an als gemeinsamer Einstiegspunkt gedacht (siehe
`cache/cache.service.ts`), es ist bisher nur ein Bedarf entstanden. Die
Einstellung wirkt damit heute genau auf diese eine Abfrage – das steht so
auch in der Karte.

## Einstellungen

`AppSettings`: `backendCacheEnabled`, `backendCacheTtlSeconds`,
`frontendCacheEnabled`, `frontendCacheTtlSeconds`.

**Die Backend-Einstellungen werden VOR dem Cache-Zugriff gelesen**, nicht
in der Factory von `getOrSet()`: die Dauer muss feststehen, bevor gecacht
wird, und bei abgeschaltetem Cache soll gar nicht erst nachgeschlagen
werden. `SettingsService.get()` cacht selbst, der zusätzliche Aufruf kostet
nichts.

**Die Frontend-Einstellungen reisen über `GET /public/site`** – dieselbe
Antwort, die das Layout ohnehin bei jedem Rendern holt (Next.js führt
identische Aufrufe innerhalb eines Renderdurchlaufs zusammen, es entsteht
keine zusätzliche Anfrage). Diese eine Abfrage muss eine feste Dauer haben,
sonst müsste man die Einstellung kennen, um die Einstellung zu holen.

## Warum die Frontend-Dauer erst bei 60 Sekunden beginnt

Die Seiten in `apps/site` tragen `export const revalidate = 60`, und dieser
Wert **muss ein Literal bleiben** – Next.js wertet ihn statisch aus, eine
Variable oder ein importierter Wert funktioniert dort nicht. Alles unter 60
Sekunden wäre an der Stelle also wirkungslos: die gerenderte Seite bliebe
trotzdem bis zu einer Minute stehen.

Statt das zu verschweigen, beginnt die Auswahl bei einer Minute (60 / 300 /
900 / 3600 Sekunden). So stimmt die Anzeige immer mit dem überein, was
tatsächlich passiert. Die Alternative – das `revalidate` aus den Seiten
entfernen und alles über die Fetch-Ebene steuern – hätte die Seiten bei
jedem Aufruf neu rendern lassen; das ist ein zu hoher Preis für einen
Regler, den niemand unter eine Minute stellen will.

**Abgeschaltet ist dagegen wirklich abgeschaltet:** `cache: "no-store"`
nimmt die Route zusätzlich aus der statischen Erzeugung heraus.

## Der Frontend-Knopf: Autorisierung ohne gemeinsames Geheimnis

Nur der Next.js-Prozess der Website kennt seinen eigenen Zwischenspeicher.
Die Administration muss ihn also über HTTP anstoßen – und diese Route darf
nicht offen stehen.

Der naheliegende Weg wäre ein `REVALIDATE_SECRET` in der Umgebung **beider**
Anwendungen. Bewusst nicht gemacht: eine Variable, die auf zwei Seiten
gepflegt werden muss, wird beim Aufsetzen einer neuen Installation
garantiert vergessen, und der Knopf ist dann still kaputt.

Stattdessen:

1. `POST /api/settings/clear-frontend-cache` (Administration, BFF) ermittelt
   die Adresse der Website über `resolveSiteBaseUrl()` – dieselbe
   vierstufige Staffelung wie die Seitenvorschau, 2026-09-03 nach
   `lib/site-base-url.ts` gezogen, damit es sie nur einmal gibt.
2. Sie ruft dort `POST /api/revalidate` auf und reicht das Zugriffstoken
   des angemeldeten Nutzers durch.
3. Die Website legt das Token der API vor (`GET /auth/me`) und verlangt
   `settings:update` – dieselbe Hürde wie für jede andere Einstellung.

Geprüft: ohne Token 401, mit ungültigem Token 401.

## Achtung bei zwei Installationen auf einer Maschine

`resolveSiteBaseUrl()` fällt in der Entwicklung auf `http://localhost:3002`
zurück. Eine zweite Installation (hier: strasev) läuft dort nicht und würde
sonst den Cache der **fremden** Website leeren – bzw. deren Seiten als
Vorschau zeigen. Solche Installationen setzen `SITE_URL`; für strasev steht
das seit 2026-09-03 in `apps/web/.env.local` (`http://localhost:3012`).

## Update 2026-09-03: Ereignisgesteuert statt Zeitablauf

Nutzerfrage direkt nach dem Bau: *„sollte caching nicht länger sein? nur
wenn sich was verändert sollte der angepasst werden?"* – berechtigt. Der
Zeitablauf war der einzige Weg, auf dem eine Änderung sichtbar wurde; das
war 2026-08-31 eine bewusste Kompromissentscheidung, weil es damals keine
Möglichkeit gab, die Website von außen anzustoßen. Mit dem Leeren-Knopf gab
es sie plötzlich.

**Neue Rollenverteilung:**

| | vorher | jetzt |
| --- | --- | --- |
| Änderung wird sichtbar | nach Ablauf der Zeit (bis zu 60 s) | **sofort**, über den Auslöser |
| Zeitablauf | der Mechanismus | nur noch Sicherheitsnetz, falls ein Auslöser ausfällt |

Deshalb sind die Minutenwerte unter einer Viertelstunde aus der Auswahl
verschwunden (Nutzervorgabe: *„1 und 5 minute kann weg"*); geblieben sind
15 Minuten, 30 Minuten, 1 Stunde (Vorgabe) und 1 Tag. Woche und Monat
standen kurz zur Debatte und sind bewusst wieder raus: je länger der Wert,
desto länger bliebe eine Seite falsch, wenn ein Auslöser einmal nicht
durchkommt – ein Netz mit einem Monat Maschenweite ist keins mehr.

### Wer löst aus

`SiteCacheService.invalidate(reason)` – bewusst ohne `await` aufzurufen,
das Leeren eines fremden Caches darf nie die Antwort an den Nutzer
verzögern oder scheitern lassen. Aufrufe innerhalb von 2 Sekunden werden
zusammengefasst, damit eine Massenaktion die Website einmal anstößt statt
zwanzigmal.

| Bereich | Warum |
| --- | --- |
| Inhalte (veröffentlicht, geändert, Papierkorb, wiederhergestellt, endgültig gelöscht) | der offensichtliche Fall |
| Kategorien | betreffen die Website doppelt: Archivseite **und** der Pfad jedes Beitrags darin |
| Menüs und Menüpunkte | bilden Header und Footer |
| Rechtstexte | dritte Footer-Spalte |
| Einstellungen | aber nur die 14 Felder aus `SITE_RELEVANT_SETTING_KEYS` – Passwortregeln oder Job-Zeiten gehen die Website nichts an |

**Warum die API und nicht die Administration:** Inhalte werden auch von der
geplanten Veröffentlichung (Cron) live geschaltet. Dort gibt es keinen
angemeldeten Nutzer und keinen Browser, der etwas anstoßen könnte.

### Autorisierung des Maschinen-Wegs

Die Website muss nun zwei Aufrufer unterscheiden, und beide sollen ohne ein
gemeinsames Geheimnis in der Umgebung auskommen:

1. **Mensch** (Knopf in den Einstellungen): Zugriffstoken durchgereicht,
   die Website legt es der API vor (`GET /auth/me`) und verlangt
   `settings:update`.
2. **API** (Auslöser): stellt sich selbst ein Token mit der Zweck-Marke
   `site-revalidate` und einer Minute Lebensdauer aus. Die Website kann die
   Signatur nicht selbst prüfen – sie ist symmetrisch, den Schlüssel hat
   nur die API –, also legt sie es der API vor
   (`POST /public/revalidation-check`). Ausstellen kann so ein Token nur,
   wer den JWT-Schlüssel hat.

Beim Testen aufgefallen und behoben: der Dienst las anfangs `JWT_SECRET`,
die Variable heißt in diesem Projekt aber `JWT_ACCESS_SECRET`. Mit
`getOrThrow` statt `get` fällt so etwas künftig beim Start auf und nicht
erst beim ersten Auslöser.

Geprüft: gültiges Token → `{"valid":true}` und die Website antwortet mit
200; Token mit anderem Zweck → `{"valid":false}`; ohne Token 401; mit
Unsinn 403.

### Zweite Installation auf derselben Maschine

Auch die API fällt in der Entwicklung auf `http://localhost:3002` zurück
und würde sonst die Website der **ersten** Installation leeren. strasev
setzt deshalb `SITE_URL=http://localhost:3012` – seit 2026-09-03 in
`apps/api/.env` **und** `apps/web/.env.local`, denn beide Seiten stoßen an.

### Was bewusst KEINEN Auslöser hat: Formulare

Nutzerfrage, 2026-09-04, nach einer falschen Einschätzung von mir
("Formulare haben keinen Auslöser, soll ich das nachrüsten?"). Nachgesehen:
**es gibt nichts nachzurüsten**, und ein Auslöser wäre sogar schädlich –
er würde bei jeder Formularänderung den gesamten Website-Cache wegwerfen,
ohne dass sich an der Sache etwas ändert.

Formulare liegen nämlich gar nicht im Cache. `PublicForm`
(`apps/site/src/components/public-form.tsx`) ist eine **Client**-Komponente
und holt die Definition erst im Browser über
`/api/forms/public/[id]` – und diese Route läuft mit `cache: "no-store"`.
Sie existiert nur, weil die API per `CORS_ORIGIN` genau eine Herkunft
erlaubt: ein Durchreicher, kein Zwischenspeicher. Eine Feldänderung ist
deshalb beim nächsten Laden sofort sichtbar.

Im Cache liegt nur die Seite drumherum mit der Referenz auf das Formular
(`formId` im Baustein). Welches Formular eine Seite einbindet, ist eine
Inhaltsänderung – und die stößt die Invalidierung ohnehin an.

**Merksatz für die Suche nach weiteren Lücken:** die Frage ist nicht "wird
das Ding auf der Website angezeigt?", sondern "wird es SERVERSEITIG
gerendert oder mit `next: { revalidate }` geladen?". Alles, was der Browser
selbst nachlädt, braucht keinen Auslöser.
