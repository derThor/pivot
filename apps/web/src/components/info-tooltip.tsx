"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Weitere Informationen"
            className="inline-flex text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">{text}</TooltipContent>
    </Tooltip>
  );
}
