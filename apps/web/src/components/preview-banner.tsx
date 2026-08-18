"use client";

import { Eye } from "lucide-react";

import { SystemMessage } from "@/components/ui/system-message";

/** Kleiner Client-Wrapper, damit das `Eye`-Icon nicht als rohe
 * Funktionsreferenz von einer Server-Komponente (`preview/page.tsx`,
 * `preview/[token]/page.tsx`) über die Client-Grenze gereicht wird –
 * das löst in React Server Components den Laufzeitfehler "Functions
 * cannot be passed directly to Client Components" aus. Hier wird das
 * Icon direkt innerhalb der Client-Komponente aufgelöst. */
export function PreviewBanner({ title }: { title: string }) {
  return <SystemMessage variant="warning" icon={Eye} title={title} />;
}
