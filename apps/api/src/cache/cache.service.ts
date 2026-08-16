import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Zentraler, wiederverwendbarer In-Memory-Cache für alle Bereiche, die von
// häufig wiederholten, aber nicht sekundengenau aktuellen Abfragen
// profitieren (z.B. Zähler für Systembenachrichtigungen, siehe
// UsersService.getNotificationCounts()) – gedacht als EIN Einstiegspunkt für
// die ganze App statt Ad-hoc-Caching pro Service. Bewusst pro Prozess
// (nicht über mehrere Server-Instanzen geteilt): für den aktuellen
// Single-Instance-Betrieb ausreichend; bei horizontaler Skalierung müsste
// dieser Service durch eine Redis-gestützte Variante mit derselben
// Schnittstelle ersetzt werden (siehe docs/ROADMAP.md Phase 3,
// "Redis-Anbindung für Caching/Sessions aktivieren" – dort noch offen).
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Liest aus dem Cache, oder ruft `factory()` auf und speichert das
   *  Ergebnis für `ttlMs`. Üblicher Einstiegspunkt statt manuellem
   *  get/set-Handling. */
  async getOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** "Cache leeren" unter Einstellungen (Nutzervorgabe, 2026-08-16). */
  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
