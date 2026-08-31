// Verschoben nach packages/blocks (Schritt 2 des Frontend-Architekturplans,
// siehe knowledge-base/frontend/taxonomy-management.md) – dieser
// Re-Export erhält die bestehenden `@/components/block-field-output`-
// Importe alle anderen Dateien unverändert, ohne 13+ Call-Sites einzeln
// umzuschreiben. Die künftige öffentliche Website (apps/site) importiert
// direkt aus `@pivot/blocks`.
export * from "@pivot/blocks";
