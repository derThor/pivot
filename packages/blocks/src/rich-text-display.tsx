import { cn } from "./cn";

// Reine, schreibgeschützte Anzeige von Rich-Text-HTML – im Gegensatz zu
// `<RichTextEditor editable={false} />` OHNE Editor-Chrome (kein Rahmen,
// kein Hintergrund, keine Tiptap-Instanz), damit es wie echter
// Seiteninhalt aussieht statt wie ein deaktiviertes Formularfeld.
const richTextDisplayClassName = cn(
  "[&_h1]:text-2xl [&_h1]:font-bold",
  "[&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:text-lg [&_h3]:font-semibold",
  "[&_h4]:text-base [&_h4]:font-semibold",
  "[&_h5]:text-sm [&_h5]:font-semibold",
  "[&_h6]:text-xs [&_h6]:font-semibold",
  "[&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:list-decimal [&_ol]:pl-5",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-input [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs",
  "[&_p]:my-1",
);

export function RichTextDisplay({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(richTextDisplayClassName, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
