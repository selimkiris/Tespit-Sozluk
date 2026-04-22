import { Suspense } from "react"
import type { Metadata } from "next"
import { HomePageContent } from "@/components/home-page-content"
import { getApiUrl, getSiteUrl } from "@/lib/api"

type PageProps = {
  searchParams: Promise<{ topic?: string }>
}

async function fetchTopicTitle(topicId: string): Promise<string | null> {
  try {
    const res = await fetch(getApiUrl(`api/Topics/${topicId}`), {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.title ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const topicId = params?.topic

  const siteUrl = getSiteUrl()
  const defaultDesc =
    "Modern sözlük platformu — başlıkları keşfet, entry yaz, topluluğa katıl."
  const ogImage = { url: "/og-image.png" as const, width: 1200, height: 630, alt: "Tespit Sözlük" as const }

  const homeTitle = "Tespit Sözlük | Zihnin Kayda Geçtiği Yer"

  if (!topicId) {
    return {
      title: homeTitle,
      description: defaultDesc,
      alternates: { canonical: `${siteUrl}/` },
      openGraph: {
        title: homeTitle,
        description: defaultDesc,
        siteName: "Tespit Sözlük",
        type: "website",
        locale: "tr_TR",
        url: `${siteUrl}/`,
        images: [ogImage, { url: "/icon.png" as const, alt: "Tespit Sözlük logosu" as const }],
      },
      twitter: {
        card: "summary_large_image",
        title: homeTitle,
        description: defaultDesc,
        images: ["/og-image.png"],
      },
    }
  }

  const topicTitle = await fetchTopicTitle(topicId)
  const title = topicTitle ? `${topicTitle} - Tespit Sözlük` : "Tespit Sözlük"
  const description = topicTitle
    ? `${topicTitle} başlığındaki entry'leri Tespit Sözlük'te oku ve yaz.`
    : defaultDesc
  const topicUrl = `${siteUrl}/?topic=${encodeURIComponent(topicId)}`

  return {
    title,
    description,
    alternates: { canonical: topicUrl },
    openGraph: {
      title,
      description,
      url: topicUrl,
      siteName: "Tespit Sözlük",
      type: "website",
      locale: "tr_TR",
      images: [{ ...ogImage, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  }
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
