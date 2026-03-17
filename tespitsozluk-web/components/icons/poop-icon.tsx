interface PoopIconProps {
  filled?: boolean
  className?: string
}

export function PoopIcon({ filled = false, className }: PoopIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Main poop swirl body */}
      <path d="M12 3c-1.5 0-2.5 1-2.5 2.5 0 .5.1 1 .3 1.4C8.3 7.3 7 8.8 7 10.5c0 .6.1 1.1.3 1.6C5.8 12.6 5 14 5 15.5 5 18 7 20 10 20.5c.6.1 1.3.2 2 .2s1.4-.1 2-.2c3-.5 5-2.5 5-5 0-1.5-.8-2.9-2.3-3.4.2-.5.3-1 .3-1.6 0-1.7-1.3-3.2-2.8-3.6.2-.4.3-.9.3-1.4C14.5 4 13.5 3 12 3z" />
      {/* Left eye */}
      <circle cx="9.5" cy="14" r="1" fill="currentColor" />
      {/* Right eye */}
      <circle cx="14.5" cy="14" r="1" fill="currentColor" />
      {/* Cute smile */}
      <path d="M10 17c.5.5 1.2.8 2 .8s1.5-.3 2-.8" fill="none" />
    </svg>
  )
}
