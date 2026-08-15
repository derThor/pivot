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
  { resource: "users", action: "manage" },
  { resource: "roles", action: "manage" },
  { resource: "settings", action: "manage" },
];

const ROLES: {
  name: string;
  description: string;
  isDefault?: boolean;
  canAccessDashboard: boolean;
  permissions: { resource: string; action: string }[];
}[] = [
  {
    name: "Admin",
    description: "Voller Zugriff auf alle Bereiche.",
    canAccessDashboard: true,
    permissions: PERMISSIONS,
  },
  {
    name: "Editor",
    description: "Kann Inhalte, Medien, Kategorien und Tags verwalten.",
    canAccessDashboard: true,
    permissions: PERMISSIONS.filter((p) =>
      ["content", "media", "categories", "tags"].includes(p.resource),
    ),
  },
  {
    name: "Autor",
    description: "Kann Inhalte und Medien anlegen und bearbeiten.",
    canAccessDashboard: true,
    permissions: PERMISSIONS.filter(
      (p) =>
        ["content", "media"].includes(p.resource) && p.action !== "delete",
    ),
  },
  {
    name: "Nutzer",
    description:
      "Registrierter Benutzer ohne Zugriff auf das Verwaltungs-Dashboard.",
    isDefault: true,
    canAccessDashboard: false,
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

  const roleByName = new Map<string, { id: string }>();
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        description: roleDef.description,
        isDefault: roleDef.isDefault ?? false,
        canAccessDashboard: roleDef.canAccessDashboard,
      },
      create: {
        name: roleDef.name,
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

  const adminRole = roleByName.get("Admin")!;
  const admin = await prisma.user.upsert({
    where: { email: "admin@pivot.dev" },
    update: {},
    create: {
      email: "admin@pivot.dev",
      firstName: null,
      lastName: "Admin",
      roleId: adminRole.id,
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
