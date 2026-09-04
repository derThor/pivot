import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PublicContentService } from './public-content.service';
import { GlobalModulesService } from '../global-modules/global-modules.service';
import { SiteCacheService } from '../site-cache/site-cache.service';
import { TemplateRegionsService } from '../template-regions/template-regions.service';

/** Content-Delivery-API für die öffentliche Website ("Frontend", siehe
 * knowledge-base/frontend/taxonomy-management.md, Update 2026-08-31 –
 * Begriffsklärung, und den zugehörigen Architekturplan). Alles hier ist
 * `@Public()` und liefert ausschließlich veröffentlichte Daten – niemals
 * eine Vorschau auf unveröffentlichte Inhalte (das bleibt exklusiv der
 * bestehenden `GET /content/preview/:token`-Route vorbehalten). */
@ApiTags('public-content')
@Controller('public')
export class PublicContentController {
  constructor(
    private readonly publicContentService: PublicContentService,
    private readonly globalModulesService: GlobalModulesService,
    private readonly siteCache: SiteCacheService,
    private readonly templateRegions: TemplateRegionsService,
  ) {}

  @Public()
  @Get('site')
  getSite() {
    return this.publicContentService.getSite();
  }

  /** Globale Module (Galerien/FAQs) zum Auflösen der Bausteine in
   * `Content.data.blocks`. Gehört hierher, weil die Ausgabe der Seiten im
   * Frontend nicht von einer Anmeldung abhängen darf (Nutzervorgabe,
   * 2026-09-02: "der inhalt muss bei seiten immer im frontend ausgegeben
   * werden") – der gleichnamige Endpunkt unter `/global-modules` ist
   * seitdem der ANGEMELDETE Admin-Zugriff und rechtegefiltert.
   *
   * Bewusst ohne Filter und ohne Pagination: es sind genau die Daten, die
   * auf den veröffentlichten Seiten ohnehin für jeden sichtbar sind. Was
   * hier nicht hingehört (Entwürfe, Papierkorb), fällt schon durch
   * `deletedAt: null` in `findAll()` heraus. Verbraucher sind `apps/site`
   * und die anonyme Vorschau-Seite `/preview/[token]` in `apps/web`. */
  @Public()
  @Get('global-modules')
  getGlobalModules() {
    return this.globalModulesService.findAll();
  }

  /** Inhalte der Template-Bereiche (Kopfbereich, Fußbereich, …) für die
   * Website. Öffentlich aus demselben Grund wie die globalen Module: sie
   * stehen auf jeder ausgelieferten Seite und dürfen nicht von einer
   * Anmeldung abhängen. */
  /** Alle Menüs für den Menü-Baustein in Template-Bereichen. */
  @Public()
  @Get('navigations')
  getNavigations() {
    return this.publicContentService.getAllNavigations();
  }

  @Public()
  @Get('template-regions')
  getTemplateRegions() {
    return this.templateRegions.findAll();
  }

  // Startseite: der Inhalt des Menüpunkts, der im Backend als Startseite
  // markiert ist (NavigationItem.isHomepage) – eigene Route statt eines
  // Redirects auf den Slug, damit die Startseite tatsächlich unter `/`
  // liegt und nicht unter `/{slug}`.
  @Public()
  @Get('home')
  getHome() {
    return this.publicContentService.getHome();
  }

  /** Prüft ein Token, das die API selbst für das Leeren des
   * Website-Caches ausgestellt hat (siehe SiteCacheService). Die Website
   * kann die Signatur nicht selbst prüfen – sie ist symmetrisch, den
   * Schlüssel hat nur die API –, deshalb dieser Umweg. Öffentlich, aber
   * nutzlos ohne gültiges Token: die Antwort ist ein reines Ja/Nein und
   * verrät nichts.
   *
   * Ausstellen kann so ein Token nur, wer den JWT-Schlüssel hat, also
   * die API selbst. Damit muss niemand ein gemeinsames Geheimnis in zwei
   * Anwendungen gleich halten. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('revalidation-check')
  checkRevalidationToken(@Body() body: { token?: string }) {
    return { valid: this.siteCache.verifyToken(body?.token ?? '') };
  }

  @Public()
  @Get('navigation/:slug')
  getNavigation(@Param('slug') slug: string) {
    return this.publicContentService.getNavigation(slug);
  }

  // Vor `categories/:slug` unerheblich (anderer Pfad), aber bewusst bei den
  // Inhalts-Routen einsortiert: liefert einen Inhalt in derselben Form wie
  // `pages/:slug`, nur über einen Vorschau-Token statt über den Slug.
  @Public()
  @Get('preview/:token')
  getPreview(@Param('token') token: string) {
    return this.publicContentService.getPreview(token);
  }

  /** RSS-Feed einer Kategorie – anders als `/categories/:id/feed.xml`
   * über den SLUG, denn die öffentliche Website kennt nur Slugs. Erzeugt
   * wird derselbe Feed, es gibt also keine zweite Sammel-Logik.
   *
   * Muss VOR `categories/:slug` stehen, sonst würde Nest "feed.xml" als
   * zweiten Pfadteil dieser Route sehen. */
  @Public()
  @Get('categories/:slug/feed.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async categoryFeed(@Param('slug') slug: string) {
    const xml = await this.publicContentService.getCategoryFeed(slug);
    if (!xml) {
      throw new NotFoundException('Kein RSS-Feed für diese Kategorie.');
    }
    return xml;
  }

  @Public()
  @Get('categories/:slug')
  getCategory(@Param('slug') slug: string, @Query('page') page?: string) {
    return this.publicContentService.getCategory(slug, Number(page) || 1);
  }

  @Public()
  @Get('categories/:slug/:contentSlug')
  getCategoryPost(
    @Param('slug') slug: string,
    @Param('contentSlug') contentSlug: string,
  ) {
    return this.publicContentService.getCategoryPost(slug, contentSlug);
  }

  @Public()
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async getSitemap() {
    const entries = await this.publicContentService.getSitemapEntries();
    const settings = await this.publicContentService.getSite();
    const base = settings.publicBaseUrl?.replace(/\/$/, '') ?? '';
    const urls = entries
      .map(
        (entry) =>
          `  <url>\n    <loc>${base}${entry.path}</loc>\n    <lastmod>${entry.updatedAt.toISOString()}</lastmod>\n  </url>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  }

  // Freie Seiten (Content ohne Kategorie), eigenes Präfix `pages/:slug` –
  // kein Routing-Konflikt mit den anderen Endpunkten hier, da jede Route
  // ein eigenes literales Erstsegment hat.
  @Public()
  @Get('pages/:slug')
  getPage(@Param('slug') slug: string) {
    return this.publicContentService.getPage(slug);
  }
}
