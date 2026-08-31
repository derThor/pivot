import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PublicContentService } from './public-content.service';

/** Content-Delivery-API für die öffentliche Website ("Frontend", siehe
 * knowledge-base/frontend/taxonomy-management.md, Update 2026-08-31 –
 * Begriffsklärung, und den zugehörigen Architekturplan). Alles hier ist
 * `@Public()` und liefert ausschließlich veröffentlichte Daten – niemals
 * eine Vorschau auf unveröffentlichte Inhalte (das bleibt exklusiv der
 * bestehenden `GET /content/preview/:token`-Route vorbehalten). */
@ApiTags('public-content')
@Controller('public')
export class PublicContentController {
  constructor(private readonly publicContentService: PublicContentService) {}

  @Public()
  @Get('site')
  getSite() {
    return this.publicContentService.getSite();
  }

  @Public()
  @Get('navigation/:slug')
  getNavigation(@Param('slug') slug: string) {
    return this.publicContentService.getNavigation(slug);
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
