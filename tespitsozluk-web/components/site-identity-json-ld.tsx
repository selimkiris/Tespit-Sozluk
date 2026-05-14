const SITE_NAME = "Tespit Sözlük"
/** Yapısal veri ve Google site name için kanonik köken (metadataBase ile uyumlu prod domain). */
const CANONICAL_SITE_ORIGIN = "https://tespitsozluk.com"
/** WebSite şeması `url` alanı — Google arama sonuçlarında site adı için beklenen ana sayfa URL'si. */
const WEB_SITE_SCHEMA_URL = "https://tespitsozluk.com/"

/**
 * Google ve diğer arama motorları için Organization + WebSite JSON-LD (Schema.org).
 * Müdahale yok, yalnızca head/structured data.
 */
export function SiteIdentityJsonLd() {
  const logoUrl = new URL("icon.png", WEB_SITE_SCHEMA_URL).toString()

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${CANONICAL_SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: CANONICAL_SITE_ORIGIN,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${CANONICAL_SITE_ORIGIN}/#website`,
        name: SITE_NAME,
        url: WEB_SITE_SCHEMA_URL,
        inLanguage: "tr-TR",
        publisher: { "@id": `${CANONICAL_SITE_ORIGIN}/#organization` },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
