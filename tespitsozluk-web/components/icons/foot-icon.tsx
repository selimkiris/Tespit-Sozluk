import { cn } from "@/lib/utils"

interface FootIconProps {
  className?: string
  filled?: boolean
}

export function FootIcon({ className, filled = false }: FootIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      {/* Single cartoon foot with toes */}
      <path d="M12 21c-3.5 0-6-2.5-6-6V9c0-2.5 1.5-5 6-5s6 2.5 6 5v6c0 3.5-2.5 6-6 6z" />
      {/* Big toe */}
      <ellipse cx="8" cy="5" rx="1.5" ry="2" />
      {/* Second toe */}
      <ellipse cx="10.5" cy="3.5" rx="1.2" ry="1.8" />
      {/* Middle toe */}
      <ellipse cx="13" cy="3" rx="1.1" ry="1.6" />
      {/* Fourth toe */}
      <ellipse cx="15.3" cy="3.8" rx="1" ry="1.4" />
      {/* Pinky toe */}
      <ellipse cx="17" cy="5.2" rx="0.9" ry="1.2" />
    </svg>
  )
}
