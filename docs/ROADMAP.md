# Roadmap – strasev CMS

## Phase 0 – Grundgerüst (abgeschlossen, 2026-08-02)

- Monorepo (Turborepo + pnpm) aufgesetzt
- NestJS-Backend mit Auth (JWT + Refresh Rotation), Users- und
  Content-Modul, Prisma-Schema, Swagger, Security-Header, Rate-Limiting
- Next.js-Frontend mit shadcn/ui: Dashboard-Layout, Sidebar, Login-Formular,
  Content-Übersicht (Platzhalterdaten)
- Knowledge Base initialisiert

## Phase 1 – End-to-End MVP

- [x] Frontend an die API anbinden (Login-Flow, Token-Handling,
      Content-Liste mit echten Daten)
- [x] Content-Editor-Formular (dynamisch aus `ContentType.schema` generiert)
- [x] Medien-Upload-Endpoint (lokal oder S3-kompatibel) + Medien-Bibliothek-UI
- [x] Benutzerverwaltung-UI (Liste, Anlegen, Rollen ändern)
- [x] Kategorien/Tags-Verwaltung (Backend-Endpoints + UI)
- [x] Erste automatisierte Tests für Auth- und Content-Flows

## Phase 2 – Redaktionelle Reife

- [x] Content bearbeiten (Edit-Formular für bestehende Einträge; Backend
      `PATCH /content/:id` existiert bereits) und löschen (`DELETE
      /content/:id` existiert bereits) im Frontend nutzen
- [x] Medien bearbeiten (Alt-Text ändern) und löschen – Backend-Endpoint
      `DELETE /media/:id` fehlt noch komplett, nicht nur die UI
- [ ] Benutzer vollständig bearbeiten (Name/E-Mail/Aktiv-Status, nicht nur
      Rolle) und löschen – Backend-Endpoints `PATCH`/`DELETE /users/:id`
      existieren bereits, im Frontend bisher nur Rollen-Änderung genutzt
- [ ] Rich-Text/Block-Editor für Content-Body
- [ ] Versions-Diff & Rollback-UI (Backend-Daten bereits vorhanden)
- [ ] Scheduler-Job: `SCHEDULED` → `PUBLISHED` zum Zielzeitpunkt (Redis/BullMQ)
- [ ] Volltextsuche (Postgres `tsvector` als erster Schritt)
- [ ] Content-Vorschau-Links (signierte, zeitlich begrenzte URLs)
- [ ] Webhooks bei Publish/Update-Events

## Phase 3 – Plattform-Härtung

- [ ] CI/CD-Pipeline (Lint, Typecheck, Tests, Build, ggf. Turborepo Remote
      Cache)
- [ ] Passwort-Reset per E-Mail, 2FA/TOTP
- [ ] Audit-Log tatsächlich befüllen (aktuell nur Datenmodell)
- [ ] Dark-Mode-Umschalter im Dashboard
- [ ] Redis-Anbindung für Caching/Sessions aktivieren

## Phase 4 – Erweiterung (optional, nach Bedarf)

- [ ] Mehrsprachigkeit vollständig (Locale-Switching in UI, Fallback-Ketten)
- [ ] GraphQL-Layer parallel zu REST
- [ ] Multi-Site-Unterstützung (`Site`-Modell, Content pro Site skopiert)
- [ ] OAuth/Social Login, SSO/SAML
- [ ] Plugin-/Erweiterungsarchitektur

## Priorisierungsprinzip

Reihenfolge orientiert sich daran, was ein Redaktionsteam für den täglichen
Betrieb zuerst braucht (Login → Inhalte anlegen/bearbeiten → Medien →
Suche/Vorschau), bevor Skalierungs- und Enterprise-Themen (SSO, Multi-Site,
GraphQL) angegangen werden. Die Reihenfolge kann jederzeit an neue
Anforderungen angepasst werden – dann bitte auch hier aktualisieren.
