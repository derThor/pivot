# Knowledge Base – strasev CMS

Diese Knowledge Base hält technisches Wissen fest, das sich nicht allein aus
dem Code erschließt: Entscheidungen, Stolpersteine, Konventionen und der
Stand einzelner Features. Sie ergänzt die [Projektplan-Dokumente](../docs/)
(die eher "wohin wollen wir" beantworten) um "was haben wir gebaut und warum
genau so".

**Update-Prozess: siehe [PROCESS.md](./PROCESS.md).** Kurzfassung: bei jedem
neuen Feature wird hier ein Eintrag ergänzt oder ein bestehender aktualisiert
– das ist keine Ausnahme, sondern Teil der Feature-Definition-of-Done.

## Einträge

| Datei | Thema | Zuletzt aktualisiert |
|---|---|---|
| [monorepo-setup.md](./monorepo-setup.md) | Turborepo/pnpm-Grundgerüst, Workspace-Struktur | 2026-08-02 |
| [auth-jwt-refresh-rotation.md](./auth-jwt-refresh-rotation.md) | JWT Auth, Refresh-Token-Rotation, RBAC | 2026-08-02 |
| [content-versioning.md](./content-versioning.md) | Content-Modell, automatische Versionierung | 2026-08-02 |
| [frontend-shadcn-base-ui.md](./frontend-shadcn-base-ui.md) | shadcn/ui auf Base-UI-Basis, `render`-statt-`asChild`-Pattern | 2026-08-02 |
| [tooling-pnpm-build-approvals.md](./tooling-pnpm-build-approvals.md) | pnpm-Build-Skript-Freigaben (`allowBuilds`) | 2026-08-02 |
| [frontend-auth-flow.md](./frontend-auth-flow.md) | httpOnly-Cookie-Session via BFF-Route-Handler + Middleware-Gate/Silent-Refresh | 2026-08-02 |
| [content-editor-dynamic-forms.md](./content-editor-dynamic-forms.md) | Content-Types-API + dynamisch aus `ContentType.schema` generiertes Editor-Formular | 2026-08-02 |
| [user-management-ui.md](./user-management-ui.md) | Benutzerverwaltung-UI (Liste, Anlegen, Rollen ändern) | 2026-08-02 |
| [media-upload.md](./media-upload.md) | Medien-Upload (lokal) + Medien-Bibliothek-UI | 2026-08-02 |
| [taxonomy-management.md](./taxonomy-management.md) | Kategorien/Tags-Verwaltung (CRUD + UI) | 2026-08-02 |
| [ui-convention-crud-and-delete-confirmation.md](./ui-convention-crud-and-delete-confirmation.md) | Konvention: Anlegen→Bearbeiten+Löschen, Löschen immer mit Bestätigungs-Popup (`ConfirmDeleteDialog`) | 2026-08-02 |
| [e2e-testing-setup.md](./e2e-testing-setup.md) | Erste E2E-Tests (Auth-/Content-Flow), eigene Testdatenbank | 2026-08-02 |
| [content-edit-delete.md](./content-edit-delete.md) | Content bearbeiten (Edit-Formular) und löschen (mit Bestätigung) | 2026-08-02 |
| [media-edit-delete.md](./media-edit-delete.md) | Medien bearbeiten (Alt-Text) und löschen (inkl. Datei von Disk) | 2026-08-02 |
| [media-preview.md](./media-preview.md) | Medien-Vorschau-Popup; `next/headers`-Stolperstein in Client-Komponenten | 2026-08-02 |

## Offene Wissenslücken (bewusst vermerkt)

- Kein Eintrag zu Deployment/CI, da noch nicht umgesetzt (siehe
  [ROADMAP.md](../docs/ROADMAP.md) Phase 3)
- Kein Eintrag zu Redis-Nutzung, da Container nur vorbereitet, aber nicht
  angebunden ist
