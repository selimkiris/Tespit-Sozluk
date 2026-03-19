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

  if (!topicId) {
    return {
      title: "Tespit Sözlük",
      description: "Modern sözlük platformu - Tespit et, paylaş, keşfet",
      openGraph: {
        title: "Tespit Sözlük",
        description: "Modern sözlük platformu - Tespit et, paylaş, keşfet",
        siteName: "Tespit Sözlük",
        type: "website",
        locale: "tr_TR",
      },
      twitter: {
        card: "summary_large_image",
        title: "Tespit Sözlük",
        description: "Modern sözlük platformu - Tespit et, paylaş, keşfet",
      },
    }
  }

  const topicTitle = await fetchTopicTitle(topicId)
  const title = topicTitle ? `${topicTitle} | Tespit Sözlük` : "Tespit Sözlük"
  const description = topicTitle
    ? `${topicTitle} başlığındaki entry'leri keşfet - Tespit Sözlük`
    : "Modern sözlük platformu - Tespit et, paylaş, keşfet"
  const siteUrl = getSiteUrl()
  const topicUrl = `${siteUrl}/?topic=${topicId}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: topicUrl,
      siteName: "Tespit Sözlük",
      type: "website",
      locale: "tr_TR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
