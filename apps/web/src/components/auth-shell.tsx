import Link from "next/link";
import { resolveImageSrc } from "@/lib/media";

// Gemeinsames Split-Screen-Layout für Login/Registrierung (Maglo-Referenz):
// links das Formular, rechts ein großformatiges Bild – über die
// Einstellungen (`authImageUrl`, siehe settings-form.tsx) hinterlegbar.
// Ohne gesetztes Bild bleibt die rechte Spalte einfach eine neutrale
// Fläche statt eines kaputten Bild-Tags.
export function AuthShell({
  logoUrl,
  companyName,
  imageUrl,
  title,
  description,
  children,
}: {
  logoUrl?: string | null;
  companyName?: string | null;
  imageUrl?: string | null;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveImageSrc(logoUrl)}
                alt={companyName ?? "Logo"}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-lg font-semibold">
                {companyName ?? "strasev CMS"}
              </span>
            )}
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-muted lg:flex">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageSrc(imageUrl)}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="text-sm text-muted-foreground">
              Kein Bild hinterlegt
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
