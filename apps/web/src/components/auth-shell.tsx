import Link from "next/link";

// Gemeinsames Split-Screen-Layout für Login/Registrierung (Maglo-Referenz):
// links das Formular, rechts ein großformatiges Bild. Logo und Bild sind
// fest hinterlegt (`public/brand/`) und bewusst nicht über die
// Einstellungen veränderbar.
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-expanded.png"
              alt="pivot CMS"
              className="pivot-logo h-8 w-auto object-contain"
            />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
      <div className="relative hidden w-1/2 overflow-hidden bg-muted lg:block">
        {/* Bild absolut positioniert statt normal im Fluss, sonst bestimmt
            sein Seitenverhältnis (statt der Flex-Zeile) die Spaltenhöhe –
            bei kurzen Fensterhöhen führte das dazu, dass die ganze Seite
            unnötig scrollte und der Overlay-Text unten abgeschnitten wurde. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/auth-image.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        {/* Marketing-Badge oben links (Nutzervorgabe, 2026-08-16, 1:1 nach
            Bildvorlage) – auf allen drei Auth-Seiten (Login/Registrieren/
            Passwort vergessen), da sie sich diese gemeinsame `AuthShell`
            teilen. */}
        <div className="absolute top-8 left-10 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm xl:left-14">
          <span className="size-2 shrink-0 rounded-full bg-primary" />
          Websoftware für alle Bereiche
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-10 pt-24 pb-10 xl:px-14 xl:pb-14">
          <h2 className="max-w-sm text-3xl font-bold leading-tight text-white xl:text-4xl">
            Eine Plattform<span className="text-primary">.</span> für jeden
            Bereich<span className="text-primary">.</span>
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Der zentrale Punkt, um den sich alles dreht — eine Websoftware, die
            sich jedem Team, jeder Branche und jedem Workflow anpasst.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              "Jede Branche",
              "Jedes Team",
              "Web-basiert",
              "Beliebig erweiterbar",
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
