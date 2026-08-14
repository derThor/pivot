import { cn } from "@/lib/utils";

// Wrapt den eigentlichen Seiteninhalt (Liste/Tabelle/Formular) unterhalb der
// Titelzeile: volle Breite, wie die Titelzeile (PageHeader + Aktions-
// Buttons) darüber.
//
// `plain`: ohne weißen Hintergrund/Schatten/Rundung – für Seiten, deren
// Inhalt bereits eigene Karten mitbringt (Suchergebnisse) oder bei denen
// ein umschließender weißer Kasten nicht gewünscht ist (Medienbibliothek,
// Nutzervorgabe).
export function PageContent({
  className,
  plain = false,
  children,
}: {
  className?: string;
  plain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        !plain && "rounded-[10px] bg-card p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
