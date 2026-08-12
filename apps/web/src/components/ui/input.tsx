import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-lg border border-[#D4D4D4] bg-transparent px-3.5 py-1 text-base transition-colors outline-none file:mr-2.5 file:inline-flex file:h-6 file:max-w-40 file:shrink-0 file:cursor-pointer file:items-center file:truncate file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:text-sm file:font-medium file:text-foreground file:hover:bg-muted/70 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
