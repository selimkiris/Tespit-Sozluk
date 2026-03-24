import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Logo({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span className={cn("inline-flex items-center dark:invert")} {...props}>
      <img
        src="/marka.svg"
        alt="Tespit Sözlük"
        className={cn("h-8 w-auto", className)}
        draggable={false}
      />
    </span>
  )
}
