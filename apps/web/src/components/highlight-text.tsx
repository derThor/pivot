import { cn } from "@/lib/utils";

/**
 * Markiert das erste Vorkommen von `query` innerhalb von `text` mit
 * einem `<mark>` – `active` steuert nur die Hintergrundfarbe (nicht ob
 * das `<mark>` gerendert wird), damit sie beim Verblassen sanft per
 * CSS-Transition ausblendet statt abrupt zu verschwinden.
 */
export function HighlightText({
  text,
  query,
  active,
}: {
  text: string;
  query: string | null;
  active: boolean;
}) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (!query || index === -1) {
    return <>{text}</>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark
        className={cn(
          "rounded px-0.5 text-inherit transition-colors duration-700",
          active ? "bg-orange-300 dark:bg-orange-500/60" : "bg-transparent",
        )}
      >
        {match}
      </mark>
      {after}
    </>
  );
}
