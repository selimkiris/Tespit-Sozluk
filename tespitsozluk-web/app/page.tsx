import { Suspense } from "react"
import type { Metadata } from "next"
import { permanentRedirect, RedirectType } from "next/navigation"
import { HomePageContent } from "@/components/home-page-content"
import { getApiUrl, getSiteUrl } from "@/lib/api"

type PageProps = {
  searchParams: Promise<{ topic?: string }>
}

/** SEO taşıma için ID→Slug çözümleyicisi. Slug bulunursa kalıcı (301/308) olarak yeni rotaya taşınır. */
async function fetchTopicTitleAndSlug(topicId: string): Promise<{ title: string | null; slug: string | null }> {
  try {
    const res = await fetch(getApiUrl(`api/Topics/${topicId}`), {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) return { title: null, slug: null }
    const data = await res.json()
    const title = typeof data?.title === "string" ? data.title : null
    const slug = typeof data?.slug === "string" && data.slug.length > 0 ? data.slug : null
    return { title, slug }
  } catch {
    return { title: null, slug: null }
  }
}

async function fetchTopicTitle(topicId: string): Promise<string | null> {
  const { title } = await fetchTopicTitleAndSlug(topicId)
  return title
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

/**
 * Eski (ID tabanlı) başlık linklerini yeni SEO rotasına 301/308 ile taşır.
 * Google veya başka bir kaynak `/?topic=<id>` biçimiyle geldiğinde sunucuda
 * slug çözümlenir ve `/baslik/<slug>` rotasına kalıcı olarak yönlendirilir.
 * URL'de `?topic=` yoksa anasayfa normal akışta render edilmeye devam eder.
 */
export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const topicId = params?.topic?.trim()
  if (topicId) {
    const { slug } = await fetchTopicTitleAndSlug(topicId)
    if (slug) {
      permanentRedirect(`/baslik/${slug}`, RedirectType.replace)
    }
    // Slug bulunamadıysa (silinmiş başlık vs.) eski davranış korunur; kullanıcı
    // `?topic=<id>` ile normal anasayfa akışında — Client Component id'ye göre başlığı yükler.
  }

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
