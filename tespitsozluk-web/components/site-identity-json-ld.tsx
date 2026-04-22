import { getSiteUrl } from "@/lib/api"

const SITE_NAME = "Tespit Sözlük"

/**
 * Google ve diğer arama motorları için Organization + WebSite JSON-LD (Schema.org).
 * Müdahale yok, yalnızca head/structured data.
 */
export function SiteIdentityJsonLd() {
  const siteUrl = getSiteUrl()
  const logoUrl = new URL("icon.png", `${siteUrl}/`).toString()

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
        inLanguage: "tr-TR",
        publisher: { "@id": `${siteUrl}/#organization` },
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
