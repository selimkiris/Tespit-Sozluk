import { cn } from "@/lib/utils"

interface CiviIconProps {
  className?: string
}

export function CiviIcon({ className }: CiviIconProps) {
  return (
    <svg
      viewBox="0 0 255.000000 349.000000"
      preserveAspectRatio="xMidYMid meet"
      className={cn("w-4 h-4", className)}
      fill="currentColor"
      aria-hidden="true"
    >
      <g
        transform="translate(0.000000,349.000000) scale(0.100000,-0.100000)"
        fill="currentColor"
        stroke="none"
      >
        {/* Başlık şeridi (üst yatay bölüm) */}
        <path d="M2492 3185 c15 -115 27 -214 28 -219 0 -13 -99 -2 -560 59 -547 72
-615 79 -745 71 -60 -4 -306 -32 -545 -62 -517 -66 -629 -79 -634 -73 -4 4 40
377 49 416 l5 23 1187 -3 1187 -2 28 -210z" />
        {/* Çivi gövdesi (alt ince bölüm) */}
        <path d="M1523 2981 c48 -4 90 -11 94 -15 7
-6 -4 -124 -72 -821 -13 -132 -49 -510 -80 -840 -47 -508 -61 -625 -91 -765
-19 -91 -47 -228 -63 -304 -16 -81 -31 -132 -34 -120 -3 10 -18 75 -32 144
-14 69 -41 195 -60 280 -18 85 -36 180 -39 210 -3 30 -15 141 -26 245 -11 105
-47 458 -80 785 -32 327 -73 723 -89 880 -16 156 -28 286 -26 289 3 2 69 12
147 21 155 19 313 23 451 11z" />
      </g>
    </svg>
  )
}
