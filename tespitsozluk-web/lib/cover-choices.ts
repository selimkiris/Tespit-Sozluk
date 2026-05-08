/**
 * Premium kapak galerisi: sabit-ID Picsum (1200×400) + gömülü CSS degrade (`data:image/svg+xml`).
 * API `CoverChoiceKey` uyumu için `DEFAULT_COVER_KEY` id sabit kalır.
 */

const PICSUM_IDS = [
  10, 11, 12, 13, 14, 15, 16, 17, 28, 29, 37, 40, 41, 42, 43, 44, 46, 47, 48, 49, 54, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68,
  69, 70, 71, 72, 73, 74,
] as const

function picsumCover(id: number): string {
  return `https://picsum.photos/id/${id}/1200/400`
}

function svgData(inner: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800">${inner}</svg>`,
  )}`
}

function cssGradientCover(cssBackground: string): string {
  const bg = cssBackground.replace(/"/g, "'").replace(/</g, "").replace(/>/g, "")
  return svgData(
    `<foreignObject width="1600" height="800"><div xmlns="http://www.w3.org/1999/xhtml" style="width:1600px;height:800px;margin:0;padding:0;background:${bg};"></div></foreignObject>`,
  )
}

export type CoverChoice = {
  id: string
  label: string
  imageUrl: string
}

/** API ile uyumluluk — ana varsayılan kapak anahtarı */
export const DEFAULT_COVER_KEY = "cover-default-mountain-dawn"

const fotoChoices: CoverChoice[] = PICSUM_IDS.map((id, index) => ({
  id: index === 0 ? DEFAULT_COVER_KEY : `cover-pcs-${id}`,
  label: index === 0 ? "Premium · varsayılan" : `Premium görüntü (${id})`,
  imageUrl: picsumCover(id),
}))

const cssChoices: CoverChoice[] = [
  /** Düz / neredeyse düz tonlar */
  {
    id: "cover-css-matte-ant",
    label: "Mat antrasit",
    imageUrl: cssGradientCover("linear-gradient(180deg, #1a1a1a 0%, #2e2e2e 55%, #0d0d0d 100%)"),
  },
  {
    id: "cover-css-navy-deep",
    label: "Koyu lacivert",
    imageUrl: cssGradientCover("linear-gradient(135deg, #020617 0%, #172554 52%, #0f172a 100%)"),
  },
  {
    id: "cover-css-emerald-field",
    label: "Zümrüt",
    imageUrl: cssGradientCover("linear-gradient(90deg, #022c22 0%, #14532d 48%, #166534 100%)"),
  },
  {
    id: "cover-css-peach-soft",
    label: "Pastel şeftali",
    imageUrl: cssGradientCover("linear-gradient(200deg, #fff7ed 0%, #ffedd5 45%, #fda4af 100%)"),
  },
  /** Uzay / bilim */
  {
    id: "cover-css-galaxy-veil",
    label: "Galaksi perdeleri",
    imageUrl: cssGradientCover(
      "radial-gradient(ellipse 120% 80% at 45% 20%, rgba(139,92,246,0.65) 0%, transparent 50%), radial-gradient(circle at 78% 75%, rgba(59,130,246,0.35) 0%, #030712 70%)",
    ),
  },
  {
    id: "cover-css-void-nebula-r",
    label: "Nebula düşüncesi",
    imageUrl: cssGradientCover(
      "radial-gradient(circle at 30% 40%, rgba(167,139,250,0.5) 0%, #040615 58%, #000000 100%)",
    ),
  },
  {
    id: "cover-css-deep-orbit-linear",
    label: "Yörünge çizgisi",
    imageUrl: cssGradientCover("linear-gradient(160deg, #020617 0%, #3730a3 38%, #0c1929 100%)"),
  },
  /** Siberpunk / oyun / neon */
  {
    id: "cover-css-neon-slash",
    label: "Neon çizgi",
    imageUrl: cssGradientCover(
      "linear-gradient(128deg, #0f172a 0%, #0f172a 42%, #ef4444 50%, #0f172a 52%, #0f172a 100%)",
    ),
  },
  {
    id: "cover-css-cyber-corner",
    label: "Siber köşe",
    imageUrl: cssGradientCover("linear-gradient(75deg, #020617 0%, #991b1b 35%, #1d4ed8 68%, #020617 100%)"),
  },
  {
    id: "cover-css-arcade-pulse-r",
    label: "Oyun nabzı",
    imageUrl: cssGradientCover(
      "radial-gradient(circle at 50% 0%, rgba(56,189,248,0.55) 0%, #1e293b 40%, #0f172a 95%)",
    ),
  },
  {
    id: "cover-css-matrix-fog-linear",
    label: "Dijital sis",
    imageUrl: cssGradientCover("linear-gradient(95deg, #052e16 0%, #0f172a 50%, #14532d 100%)"),
  },
  /** Sanat / pastel soyut */
  {
    id: "cover-css-aquarelle-drift-linear",
    label: "Aquarel sürüş",
    imageUrl: cssGradientCover("linear-gradient(120deg, #fdf4ff 0%, #e9d5ff 40%, #bfdbfe 85%, #fee2e2 100%)"),
  },
  {
    id: "cover-css-canvas-cloud-r",
    label: "Tuval bulutu",
    imageUrl: cssGradientCover(
      "radial-gradient(circle at 25% 30%, rgba(255,255,255,0.95) 0%, #fcd34d 28%, #f472b6 72%, #a78bfa 100%)",
    ),
  },
  {
    id: "cover-css-pastel-river-linear",
    label: "Pastel nehir",
    imageUrl: cssGradientCover("linear-gradient(0deg, #fef9c3 0%, #d9f99d 30%, #a5f3fc 65%, #e9d5ff 100%)"),
  },
  {
    id: "cover-css-ink-wash-linear",
    label: "Mürekkep yıkama",
    imageUrl: cssGradientCover("linear-gradient(200deg, #f8fafc 0%, #94a3b8 42%, #1e293b 100%)"),
  },
  /** Ek modern çeşitlilik — linear/radial */
  {
    id: "cover-css-bronze-horizon",
    label: "Bronz ufuk",
    imageUrl: cssGradientCover("linear-gradient(0deg, #1c1917 0%, #78350f 45%, rgba(251,191,36,0.55) 100%)"),
  },
  {
    id: "cover-css-silver-floor-r",
    label: "Gümüş zemini",
    imageUrl: cssGradientCover(
      "radial-gradient(ellipse at 52% 100%, rgba(250,250,250,0.42) 0%, #475569 45%, #0f172a 100%)",
    ),
  },
  {
    id: "cover-css-rose-violet-twilight-linear",
    label: "Gül & çivit alacası",
    imageUrl: cssGradientCover("linear-gradient(90deg, #4c0519 0%, #831843 42%, #4c1d95 85%)"),
  },
  {
    id: "cover-css-arctic-glaze-linear",
    label: "Buzlu cilası",
    imageUrl: cssGradientCover("linear-gradient(180deg, #f8fafc 0%, #cbd5e1 60%, #334155 100%)"),
  },
  {
    id: "cover-css-obsidian-teal-corner-r",
    label: "Obsidyen & teal köşesi",
    imageUrl: cssGradientCover(
      "radial-gradient(circle at 90% 10%, rgba(45,212,191,0.35) 0%, #082f49 52%, #020617 100%)",
    ),
  },
]

const choices: CoverChoice[] = [...fotoChoices, ...cssChoices]

export const COVER_CHOICES = choices as readonly CoverChoice[]

const map = new Map(choices.map((c) => [c.id, c]))

export function getCoverChoiceById(id: string | null | undefined): CoverChoice | undefined {
  if (!id) return undefined
  return map.get(id)
}

export function getCoverImageUrl(key: string | null | undefined): string {
  const c = getCoverChoiceById(key) ?? map.get(DEFAULT_COVER_KEY)
  return c?.imageUrl ?? map.get(DEFAULT_COVER_KEY)!.imageUrl
}

export function isValidCoverChoiceId(id: string): boolean {
  return map.has(id)
}

export const COVER_CHOICE_COUNT = COVER_CHOICES.length
