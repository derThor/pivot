import { BadRequestException } from '@nestjs/common';

/** Pfade, unter denen Backend und API der eigenen Installation liegen
 * (`https://kunde.de/admin`, `https://kunde.de/api` – siehe
 * knowledge-base/platform/deployment.md). Ein Inhalt oder eine Kategorie
 * mit einem dieser Slugs wäre über die öffentliche Website nicht
 * erreichbar, weil der Reverse Proxy diese Pfade vorher abfängt. Deshalb
 * gar nicht erst zulassen, statt später eine unerklärliche "Seite nicht
 * gefunden" zu produzieren. */
export const RESERVED_SLUGS = ['admin', 'api'] as const;

export function assertSlugNotReserved(slug?: string | null): void {
  if (!slug) return;
  if ((RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase())) {
    throw new BadRequestException(
      `"${slug}" ist reserviert: unter diesem Pfad liegen Backend und API dieser Installation. Bitte einen anderen Slug wählen.`,
    );
  }
}
