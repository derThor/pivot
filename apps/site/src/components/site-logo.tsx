/** PROJEKTEIGENE DATEI – siehe .gitattributes im Wurzelverzeichnis.
 * Wird bei einem Merge aus dem pivot-Repository bewusst NICHT
 * überschrieben: das Frontend-Template gehört zu dieser Installation, nur
 * die Verwaltungsoberfläche ist überall gleich.
 *
 * Diese Installation hat (noch) kein Bildlogo. Statt eines fehlenden
 * Bildes steht hier der Website-Titel als Wortmarke – gepflegt unter
 * Einstellungen → Frontend. Sobald ein Logo vorliegt, kommt es nach
 * `public/brand/` und wird hier eingebunden; die aufrufenden Stellen
 * (SiteHeader, SiteFooter) bleiben unverändert. */
export function SiteLogo({
  variant,
  siteTitle,
}: {
  /** "light" = auf hellem Grund (Header), "dark" = auf dunklem (Footer). */
  variant: "light" | "dark";
  siteTitle: string | null;
  /** Wird von der Bild-Fassung gebraucht, hier ohne Wirkung. */
  priority?: boolean;
}) {
  const title = siteTitle?.trim();
  if (!title) return null;

  return (
    <span
      className={
        variant === "dark"
          ? "text-[19px] font-extrabold text-white"
          : "text-[19px] font-extrabold"
      }
    >
      {title}
    </span>
  );
}
