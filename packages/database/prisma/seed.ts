import { PrismaClient } from "../generated/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

// Rechte-Katalog: muss synchron gehalten werden mit
// apps/api/src/roles/permissions.catalog.ts (bewusst dupliziert statt über
// Package-Grenzen hinweg geteilt, siehe knowledge-base/auth/rbac-rework.md).
const PERMISSIONS: { resource: string; action: string }[] = [
  { resource: "content", action: "read" },
  { resource: "content", action: "create" },
  { resource: "content", action: "update" },
  { resource: "content", action: "delete" },
  { resource: "content", action: "publish" },
  { resource: "content", action: "schedule" },
  { resource: "media", action: "read" },
  { resource: "media", action: "create" },
  { resource: "media", action: "update" },
  { resource: "media", action: "delete" },
  { resource: "categories", action: "read" },
  { resource: "categories", action: "create" },
  { resource: "categories", action: "update" },
  { resource: "categories", action: "delete" },
  { resource: "tags", action: "read" },
  { resource: "tags", action: "create" },
  { resource: "tags", action: "update" },
  { resource: "tags", action: "delete" },
  { resource: "navigation", action: "read" },
  { resource: "navigation", action: "update" },
  { resource: "navigation", action: "reorder" },
  { resource: "module-types", action: "read" },
  { resource: "gallery", action: "read" },
  { resource: "gallery", action: "create" },
  { resource: "gallery", action: "update" },
  { resource: "gallery", action: "delete" },
  { resource: "faq", action: "read" },
  { resource: "faq", action: "create" },
  { resource: "faq", action: "update" },
  { resource: "faq", action: "delete" },
  { resource: "preview-links", action: "read" },
  { resource: "preview-links", action: "create" },
  { resource: "preview-links", action: "revoke" },
  { resource: "users", action: "read" },
  { resource: "users", action: "invite" },
  { resource: "users", action: "update" },
  { resource: "users", action: "deactivate" },
  { resource: "users", action: "delete" },
  { resource: "users", action: "impersonate" },
  { resource: "roles", action: "read" },
  { resource: "roles", action: "create" },
  { resource: "roles", action: "update" },
  { resource: "settings", action: "read" },
  { resource: "settings", action: "update" },
  // Firma-Stammdaten getrennt von `settings` (Nutzervorgabe, 2026-08-21:
  // "admin soll aber firma sehen können", siehe permissions.catalog.ts).
  { resource: "company", action: "read" },
  { resource: "company", action: "update" },
  { resource: "privacy", action: "read" },
  { resource: "privacy", action: "create" },
  { resource: "privacy", action: "update" },
  { resource: "privacy", action: "delete" },
];

// Alte, jetzt durch feingranulare Aktionen ersetzte Bundle-Rechte – werden
// nach dem Anlegen der neuen Rechte gelöscht (cascadet automatisch alle
// `RolePermission`-Zeilen weg, die noch darauf verweisen). Kein
// Schema-Migrationsschritt nötig, `Permission` ist rein datengetrieben.
const OBSOLETE_PERMISSIONS: { resource: string; action: string }[] = [
  { resource: "users", action: "manage" },
  { resource: "roles", action: "manage" },
  { resource: "settings", action: "manage" },
  // Webhooks leben seit 2026-08-21 unter Einstellungen und brauchen daher
  // kein eigenes Rechte-Bündel mehr (Nutzervorgabe: "webhooks brauchen
  // keine eigenen rechte mehr, soll komplett über einstellungen gehen") –
  // ersetzt durch `settings:read`/`settings:update`.
  { resource: "webhooks", action: "read" },
  { resource: "webhooks", action: "create" },
  { resource: "webhooks", action: "update" },
  { resource: "webhooks", action: "delete" },
];

// Namens-Migration (Nutzervorgabe, 2026-08-16): die bisherigen 4
// Rollennamen ("Admin"/"Editor"/"Autor"/"Nutzer") wurden umbenannt statt
// neu angelegt (per `upsert` über den jeweils NEUEN Namen unten – die
// alten Zeilen existieren dadurch nicht mehr, `User.roleId` bleibt aber
// unverändert, da nur `name` geändert wird, nicht die Zeile selbst
// gelöscht/neu erstellt wird). "Autor" behält zufällig denselben Namen.
// Reihenfolge/Beschreibungen 1:1 nach Bildvorlage.
//
// Später (noch am 2026-08-16) auf Nutzervorgabe wieder auf 3 Rollen
// reduziert: Chefredaktion, Autor, Medienpflege, Formular-Manager entfernt
// (per Direktzugriff auf die DB gelöscht, siehe
// knowledge-base/auth/rbac-rework.md – der Seed legt entfernte Rollen
// nicht automatisch an, nur noch vorhandene werden aktualisiert).
const ROLES: {
  name: string;
  description: string;
  isDefault?: boolean;
  canAccessDashboard: boolean;
  sortOrder: number;
  permissions: { resource: string; action: string }[];
}[] = [
  // Über Administrator angesiedelt (Nutzervorgabe, 2026-08-21: "die kann
  // alles. einstellungen können nur pivot machen. keine admins") – hat als
  // einzige Rolle uneingeschränkt PERMISSIONS inkl. `settings:*`.
  // Administrator verliert dafür unten `settings:read`/`settings:update`
  // komplett, nicht nur `settings:update` wie zuvor bei Manager. Zusätzlich
  // besonders geschützt (siehe UsersService.assertMayAssignRole,
  // AuthService.impersonate/requireTwoFactorForAdmins): nur Pivot selbst
  // darf die Rolle vergeben, Pivot-Konten sind nicht impersonierbar und
  // fallen unter dieselbe 2FA-Pflicht wie Administrator.
  {
    name: "Pivot",
    description:
      "Uneingeschränkter Zugriff auf alle Bereiche, inklusive der globalen Einstellungen – die einzige Rolle mit Einstellungs-Zugriff.",
    canAccessDashboard: true,
    sortOrder: 0,
    permissions: PERMISSIONS,
  },
  {
    name: "Administrator",
    description:
      "Voller Zugriff auf alle Bereiche außer den globalen Einstellungen (vorbehalten der Rolle Pivot).",
    canAccessDashboard: true,
    sortOrder: 1,
    permissions: PERMISSIONS.filter((p) => p.resource !== "settings"),
  },
  // Direkt unter Administrator (Nutzervorgabe, 2026-08-16): operative
  // Vollmacht für praktisch alles Tagesgeschäft, aber bewusst OHNE die
  // beiden Rechte, die die Rechte-/Rollen-Architektur selbst verändern
  // könnten (`roles:create`/`roles:update`). `roles:read` bleibt Teil von
  // `PERMISSIONS` und damit inbegriffen. `settings` (auch lesend) komplett
  // ausgenommen (Nutzervorgabe, 2026-08-21: "manager darf keine
  // einstellungen lesen. recht entfernen" – vorher durfte Manager lesend
  // zugreifen, jetzt darf ausschließlich Pivot `settings:*`). Firma-
  // Stammdaten (`company:*`) bleiben davon unberührt, da eigenes Recht.
  // Ebenfalls ausgenommen (2026-08-16): `users:delete` (Anonymisierung,
  // nicht reversibel) und `users:impersonate` (Admin-Impersonation) –
  // beide bleiben Administrator vorbehalten.
  {
    name: "Manager",
    description:
      "Operative Leitung: verwaltet Inhalte, Medien, Benutzer, Firmendaten und alle Erweiterungen – außer Rollen/Rechte und globale Einstellungen. Webhooks leben seit 2026-08-21 unter Einstellungen (settings:update) und sind damit ebenfalls ausgenommen.",
    canAccessDashboard: true,
    sortOrder: 2,
    permissions: PERMISSIONS.filter(
      (p) =>
        !(p.resource === "roles" && p.action !== "read") &&
        p.resource !== "settings" &&
        !(p.resource === "users" && ["delete", "impersonate"].includes(p.action)),
    ),
  },
  {
    name: "Redakteur",
    description: "Pflegt Inhalte, veröffentlicht aber nicht selbst.",
    canAccessDashboard: true,
    sortOrder: 3,
    permissions: PERMISSIONS.filter(
      (p) =>
        (p.resource === "content" &&
          ["read", "create", "update", "schedule"].includes(p.action)) ||
        (p.resource === "media" &&
          ["read", "create", "update"].includes(p.action)) ||
        (["categories", "tags"].includes(p.resource) &&
          ["read", "create", "update"].includes(p.action)),
    ),
  },
  {
    name: "Gast",
    description:
      "Registrierter Benutzer ohne Zugriff auf das Verwaltungs-Dashboard.",
    isDefault: true,
    canAccessDashboard: false,
    sortOrder: 4,
    permissions: [],
  },
];

async function main() {
  const permissionRecords = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      }),
    ),
  );
  const permissionIdByKey = new Map(
    permissionRecords.map((p) => [`${p.resource}:${p.action}`, p.id]),
  );

  // Alt-Name -> Neu-Name (Nutzervorgabe, 2026-08-16: auf die 7
  // Beispiel-Rollen umstellen) – per `id` umbenennen statt neu anzulegen,
  // damit `User.roleId` erhalten bleibt (kein Datenverlust für bereits
  // zugewiesene Nutzer). Ein simples `upsert({ where: { name: NEUER_NAME } })`
  // würde das NICHT leisten: es fände unter dem neuen Namen nichts, legte
  // eine zusätzliche, leere Rolle an und ließe die alte verwaist stehen.
  const ROLE_RENAMES: Record<string, string> = {
    Admin: "Administrator",
    Editor: "Chefredaktion",
    Nutzer: "Gast / Praktikum",
    "Gast / Praktikum": "Gast",
  };

  const roleByName = new Map<string, { id: string }>();
  for (const roleDef of ROLES) {
    const oldName = Object.entries(ROLE_RENAMES).find(
      ([, newName]) => newName === roleDef.name,
    )?.[0];
    const existing = await prisma.role.findFirst({
      where: { name: oldName ? { in: [oldName, roleDef.name] } : roleDef.name },
    });

    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: {
            name: roleDef.name,
            description: roleDef.description,
            isDefault: roleDef.isDefault ?? false,
            canAccessDashboard: roleDef.canAccessDashboard,
            sortOrder: roleDef.sortOrder,
          },
        })
      : await prisma.role.create({
          data: {
            name: roleDef.name,
            sortOrder: roleDef.sortOrder,
            description: roleDef.description,
            isSystem: true,
            isDefault: roleDef.isDefault ?? false,
            canAccessDashboard: roleDef.canAccessDashboard,
          },
        });
    roleByName.set(roleDef.name, role);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: roleDef.permissions.map((p) => ({
        roleId: role.id,
        permissionId: permissionIdByKey.get(`${p.resource}:${p.action}`)!,
      })),
    });
  }

  // Alte Bundle-Rechte entfernen (siehe OBSOLETE_PERMISSIONS oben) –
  // `onDelete: Cascade` auf `RolePermission.permission` räumt betroffene
  // Zuordnungen automatisch mit ab.
  await prisma.permission.deleteMany({
    where: { OR: OBSOLETE_PERMISSIONS.map((p) => ({ resource: p.resource, action: p.action })) },
  });

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  // Systemordner für Logo-Uploads (Einstellungen → Firma) – darf nicht
  // gelöscht werden (isSystem), daher hier statt on-demand angelegt.
  const existingLogoFolder = await prisma.mediaFolder.findFirst({
    where: { name: 'Logo', parentId: null },
  });
  if (!existingLogoFolder) {
    await prisma.mediaFolder.create({
      data: { name: 'Logo', parentId: null, isSystem: true },
    });
  } else if (!existingLogoFolder.isSystem) {
    await prisma.mediaFolder.update({
      where: { id: existingLogoFolder.id },
      data: { isSystem: true },
    });
  }

  // Systemordner für Profilfoto-Uploads (Mein Konto/Benutzer) – gleiches
  // Muster wie "Logo": Ordner selbst nicht löschbar (isSystem), einzelne
  // Bilder darin (z.B. nach Nutzer-Löschung) aber schon (Nutzervorgabe,
  // 2026-08-17).
  const existingAvatarFolder = await prisma.mediaFolder.findFirst({
    where: { name: 'Avatare', parentId: null },
  });
  if (!existingAvatarFolder) {
    await prisma.mediaFolder.create({
      data: { name: 'Avatare', parentId: null, isSystem: true },
    });
  } else if (!existingAvatarFolder.isSystem) {
    await prisma.mediaFolder.update({
      where: { id: existingAvatarFolder.id },
      data: { isSystem: true },
    });
  }

  // Systemordner für AV-Vertrag-Uploads (Datenschutz → Rechtstexte →
  // Betroffenenrechte) – gleiches Muster wie "Logo"/"Avatare": Ordner
  // selbst nicht löschbar (isSystem), damit "AV-Vertrag herunterladen"
  // (zippt den ganzen Ordnerinhalt) immer einen festen, verlässlichen Ort
  // hat (Nutzervorgabe, 2026-08-19).
  const existingAvsFolder = await prisma.mediaFolder.findFirst({
    where: { name: 'AVs', parentId: null },
  });
  if (!existingAvsFolder) {
    await prisma.mediaFolder.create({
      data: { name: 'AVs', parentId: null, isSystem: true },
    });
  } else if (!existingAvsFolder.isSystem) {
    await prisma.mediaFolder.update({
      where: { id: existingAvsFolder.id },
      data: { isSystem: true },
    });
  }

  const adminRole = roleByName.get("Administrator")!;
  const admin = await prisma.user.upsert({
    where: { email: "admin@pivot.dev" },
    update: {},
    create: {
      email: "admin@pivot.dev",
      firstName: null,
      lastName: "Admin",
      userRoles: { create: { roleId: adminRole.id } },
      emailVerifiedAt: new Date(),
      passwordHash: await argon2.hash("ChangeMe123!"),
    },
  });

  await prisma.contentType.upsert({
    where: { slug: "page" },
    update: {},
    create: {
      name: "Seite",
      slug: "page",
      schema: {
        fields: [{ name: "blocks", type: "modules" }],
      },
    },
  });

  // Basis-Modul-Bibliothek für den Seiten-Designer (Drag&Drop-Editor,
  // siehe knowledge-base/content/page-designer.md). Wie Content-Typen
  // aktuell nur per Seed gepflegt, keine eigene Verwaltungs-UI.
  // Offline-sicherer Platzhalter statt eines echten Bild-Uploads/externen
  // Placeholder-Dienstes – wird beim Einfügen eines Bild-Bausteins als
  // Dummy-Bild vorbefüllt, bis der Nutzer ein echtes Bild auswählt.
  const dummyImage = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#e2e8f0"/><text x="400" y="235" font-family="sans-serif" font-size="28" fill="#94a3b8" text-anchor="middle">Beispielbild</text></svg>',
  )}`;
  const loremIpsumShort =
    "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.";

  interface ModuleField {
    name: string;
    type: string;
    required?: boolean;
    option?: boolean;
    variant?: "button" | "quote" | "caption" | "cover";
    // `unknown` statt `string`, weil Repeater-Beispieldaten Arrays sind.
    example?: unknown;
    // Nur für `type: "repeater"`: Schema der Unterfelder pro Eintrag.
    fields?: ModuleField[];
  }

  const moduleTypes: {
    name: string;
    slug: string;
    icon: string;
    schema: { fields: ModuleField[] };
  }[] = [
    {
      name: "Rich-Text",
      slug: "rich-text",
      icon: "FileText",
      schema: {
        fields: [
          {
            name: "content",
            type: "richtext",
            required: true,
            example: `<p>${loremIpsumShort}</p>`,
          },
        ],
      },
    },
    {
      name: "Bild",
      slug: "image",
      icon: "Image",
      schema: {
        fields: [
          { name: "imageUrl", type: "image", required: true, example: dummyImage },
          { name: "altText", type: "string", option: true, example: "Beispielbild" },
        ],
      },
    },
    {
      name: "Bild + Text",
      slug: "image-text",
      icon: "Columns2",
      schema: {
        fields: [
          { name: "imageUrl", type: "image", required: true, example: dummyImage },
          { name: "altText", type: "string", option: true, example: "Beispielbild" },
          {
            name: "text",
            type: "richtext",
            required: true,
            example: `<p>${loremIpsumShort}</p>`,
          },
        ],
      },
    },
    {
      name: "Video",
      slug: "video",
      icon: "Video",
      schema: {
        fields: [{ name: "video", type: "video", required: true }],
      },
    },
    {
      // Vollflächiges Hero-/Cover-Modul: Bild-Feld mit `variant: "cover"`
      // markiert das Hintergrundbild als Vollflächen-Hintergrund statt
      // normaler Fließ-/Ausrichtungs-Logik (siehe isCoverModuleType/
      // CoverOutput in block-field-output.tsx – Form-/Variant-Erkennung
      // statt Slug-Abfrage, wie bei allen anderen Bausteinen hier).
      name: "Cover",
      slug: "cover",
      icon: "LayoutTemplate",
      schema: {
        fields: [
          {
            name: "backgroundImage",
            type: "image",
            required: true,
            variant: "cover",
            example: dummyImage,
          },
          {
            name: "heading",
            type: "string",
            required: true,
            example: "Überschrift",
          },
          {
            name: "subtext",
            type: "string",
            example: "Kurzer Untertext für den Cover-Bereich.",
          },
          {
            name: "buttonLabel",
            type: "string",
            variant: "button",
            example: "Jetzt entdecken",
          },
          { name: "buttonUrl", type: "string", option: true, example: "/" },
        ],
      },
    },
    {
      name: "CTA-Button",
      slug: "cta-button",
      icon: "MousePointerClick",
      schema: {
        fields: [
          {
            name: "label",
            type: "string",
            required: true,
            variant: "button",
            example: "Jetzt entdecken",
          },
          { name: "url", type: "string", required: true, option: true, example: "/" },
        ],
      },
    },
    {
      name: "Zitat",
      slug: "quote",
      icon: "Quote",
      schema: {
        fields: [
          {
            name: "quote",
            type: "text",
            required: true,
            variant: "quote",
            example: loremIpsumShort,
          },
          {
            name: "author",
            type: "string",
            variant: "caption",
            example: "Max Mustermann",
          },
        ],
      },
    },
    {
      // Feste Anzahl (4) quadratischer Bild-Kacheln im Raster – kein
      // Repeater-Feldtyp, bewusst einfach als vier normale "image"-Felder
      // modelliert (siehe knowledge-base/media/). Die 2x2-Grid-Darstellung
      // wird generisch anhand "mehr als ein Bild-Feld im selben Modul"
      // erkannt (block-field-output.tsx `isTilesModule`), nicht am Slug.
      name: "Kacheln",
      slug: "tiles",
      icon: "LayoutGrid",
      schema: {
        fields: [
          { name: "image1", type: "image", required: true, example: dummyImage },
          { name: "image2", type: "image", required: true, example: dummyImage },
          { name: "image3", type: "image", required: true, example: dummyImage },
          { name: "image4", type: "image", required: true, example: dummyImage },
        ],
      },
    },
    {
      // Kein eigenes Feld nötig – wird generisch über "Modul ohne
      // sichtbares Feld" erkannt (`isDividerModule` in
      // block-field-output.tsx), nicht über den Slug.
      name: "Trenner",
      slug: "divider",
      icon: "SeparatorHorizontal",
      schema: { fields: [] },
    },
    {
      // Repeater-Feldtyp (variable Anzahl Einträge) ohne Bild-Unterfeld ->
      // wird generisch als Akkordeon gerendert (`BlockFieldOutput`,
      // Gegenstück zu `isGalleryRepeater`).
      name: "Akkordeon/FAQ",
      slug: "faq",
      icon: "HelpCircle",
      schema: {
        fields: [
          {
            name: "description",
            type: "string",
            example: "Kurze Beschreibung dieser FAQ-Gruppe.",
          },
          {
            name: "items",
            type: "repeater",
            required: true,
            fields: [
              { name: "question", type: "string", required: true },
              { name: "answer", type: "richtext", required: true },
              // Steuert Sichtbarkeit auf der öffentlichen Ausgabe (siehe
              // `BlockFieldOutput` Akkordeon-Zweig) – fehlt der Wert (ältere
              // Einträge vor Einführung dieses Felds), gilt eine Frage als
              // veröffentlicht (`!== false`-Prüfung statt striktem `=== true`).
              { name: "published", type: "boolean" },
            ],
            example: [
              {
                id: crypto.randomUUID(),
                values: {
                  question: "Wie lange dauert der Versand?",
                  answer: `<p>${loremIpsumShort}</p>`,
                  published: true,
                },
              },
              {
                id: crypto.randomUUID(),
                values: {
                  question: "Kann ich meine Bestellung stornieren?",
                  answer: `<p>${loremIpsumShort}</p>`,
                  published: true,
                },
              },
            ],
          },
        ],
      },
    },
    {
      // Repeater-Feldtyp mit Bild-Unterfeld -> wird generisch als
      // Bild-Raster gerendert (`isGalleryRepeater` in
      // block-field-output.tsx).
      name: "Bildergalerie",
      slug: "gallery",
      icon: "Images",
      schema: {
        fields: [
          {
            name: "items",
            type: "repeater",
            required: true,
            fields: [
              { name: "image", type: "image", required: true },
              { name: "caption", type: "text", option: true },
            ],
            example: [
              { id: crypto.randomUUID(), values: { image: dummyImage } },
              { id: crypto.randomUUID(), values: { image: dummyImage } },
              { id: crypto.randomUUID(), values: { image: dummyImage } },
            ],
          },
        ],
      },
    },
  ];
  for (const moduleType of moduleTypes) {
    // `update: moduleType` (statt No-Op) – Modul-Typen sind laut
    // ModuleTypesController bewusst nur per Seed gepflegt ("keine eigene
    // Verwaltungs-UI"), der Seed ist also die Quelle der Wahrheit und muss
    // bestehende Zeilen bei Schema-Änderungen (z.B. neue Felder) auch bei
    // erneutem Lauf aktualisieren können.
    await prisma.moduleType.upsert({
      where: { slug: moduleType.slug },
      update: moduleType,
      create: moduleType,
    });
  }

  console.log(`Seed abgeschlossen. Admin-User: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
