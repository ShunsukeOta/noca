import * as React from "react"
import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<"input"> & {
  density?: "default" | "compact"
}

const densityClasses = {
  default: "h-12 rounded-md px-4",
  compact: "h-11 rounded-md px-3"
} as const

function Input({ className, density = "default", type = "text", ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "flex w-full min-w-0 border border-input bg-background text-base text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/75 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        densityClasses[density],
        className
      )}
      {...props}
    />
  )
}

export { Input }
