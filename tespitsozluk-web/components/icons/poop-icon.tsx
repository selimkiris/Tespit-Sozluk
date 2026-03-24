interface PoopIconProps {
  filled?: boolean
  className?: string
}

/**
 * Çıplak Ayak ikonu — plantar (alt) görünümünden çizilmiş.
 * Bir ayak tabanı + 5 ayrı parmak noktası içerir.
 * "Basma / ezme" hissiyatını net verir.
 */
export function PoopIcon({ filled = false, className }: PoopIconProps) {
  const f = filled ? "currentColor" : "none"

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Ayak tabanı — topuk altta, parmak bölgesi üstte */}
      <path
        d="M12 21.5 C9 21.5 7 19.5 7 16.5 C7 13.5 8 11.5 10 10 L14 10 C16 11.5 17 13.5 17 16.5 C17 19.5 15 21.5 12 21.5 Z"
        fill={f}
        strokeLinejoin="round"
      />

      {/* Büyük parmak (en solda, en iri) */}
      <circle cx="8.2" cy="8.2" r="1.8" fill={f} />
      {/* İşaret parmağı */}
      <circle cx="11" cy="6.8" r="1.5" fill={f} />
      {/* Orta parmak */}
      <circle cx="13.7" cy="6.8" r="1.4" fill={f} />
      {/* Yüzük parmağı */}
      <circle cx="16" cy="7.8" r="1.2" fill={f} />
      {/* Serçe parmak (en sağda, en küçük) */}
      <circle cx="17.6" cy="9.5" r="1" fill={f} />
    </svg>
  )
}
