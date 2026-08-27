import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Nutzervorgabe, 2026-08-26: exakte Maße nach Bildvorlage – Radius 5px,
  // Schrift 11px (statt der bisherigen Näherungen `rounded-md`/`text-xs`).
  // Nutzervorgabe, 2026-08-27: "alle badges einen ganz kleinen wenig höher
  // machen und schrift muss komplett mittig, horizontal und vertikal" –
  // `h-[21px]` statt `h-5` (20px), `leading-none` statt `leading-[1.45]`:
  // die größere Zeilenhöhe addierte oben/unten ungleich viel Leerraum zum
  // Text hinzu (Schriftart-Metrik-Asymmetrie), wodurch die vertikale
  // Zentrierung trotz `items-center` optisch leicht daneben wirkte.
  "group/badge inline-flex h-[21px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[5px] border border-transparent px-2 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Nutzervorgabe, 2026-08-26: feste semantische Badge-Palette
        // (Bildvorlage "BADGES") – exakte Farben kommen aus den
        // `.badge--*`-Klassen in globals.css (inset box-shadow als
        // "Rahmen" statt echtem `border`, daher hier `border-0`).
        ink: "badge--ink border-0",
        lime: "badge--lime border-0",
        green: "badge--green border-0",
        amber: "badge--amber border-0",
        red: "badge--red border-0",
        blue: "badge--blue border-0",
        slate: "badge--slate border-0",
        light: "badge--light border-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
