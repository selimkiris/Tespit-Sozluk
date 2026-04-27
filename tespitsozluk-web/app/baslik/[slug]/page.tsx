import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { HomePageContent, type InitialTopic } from "@/components/home-page-content"
import { getApiUrl, getSiteUrl } from "@/lib/api"

/**
 * SEO dostu başlık sayfası: `/baslik/[slug]`
 *
 * - Server Component — `generateMetadata` ile dinamik SEO etiketlerini basar.
 * - Backend'in yeni `GET /api/Topics/slug/{slug}` endpoint'inden başlık verisini çeker.
 * - `TopicDetail` bileşeni tüm UI'yi yönettiği için burada yeni tasarım çizilmez:
 *   mevcut `HomePageContent` Client Component'ine `initialTopic` olarak aktarılır.
 */

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

type TopicApiResponse = {
  id: string
  title: string
  slug: string
  authorId?: string | null
  authorName?: string | null
  authorUsername?: string | null
  authorAvatar?: string | null
  authorRole?: string | null
  createdAt?: string
  entryCount?: number
  isFollowedByCurrentUser?: boolean
  isAnonymous?: boolean
  isTopicOwner?: boolean
  canManageTopic?: boolean
  isNovice?: boolean
}

type EntriesApiResponse = {
  items?: Array<{ content?: string }>
}

async function fetchTopicBySlug(slug: string): Promise<TopicApiResponse | null> {
  try {
    const res = await fetch(getApiUrl(`api/Topics/slug/${encodeURIComponent(slug)}`), {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) return null
    return (await res.json()) as TopicApiResponse
  } catch {
    return null
  }
}

/**
 * Başlığın en eski (ilk) entry'sini description için çeker.
 * Yalnızca okunur, oturum bilgisi göndermez — SSR public metadata çıkışı.
 */
async function fetchFirstEntryContent(topicId: string): Promise<string | null> {
  try {
    const res = await fetch(
      getApiUrl(`api/Topics/${topicId}/entries?page=1&pageSize=1&sortBy=oldest`),
      {
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as EntriesApiResponse
    return data?.items?.[0]?.content ?? null
  } catch {
    return null
  }
}

/**
 * HTML içeriğini (Rich Text) düz metne çevirir:
 * - Bütün etiketleri söker, `<br>` ve blok kapanışlarını boşluğa çevirir
 * - Sık kullanılan HTML entity'leri (&nbsp;, &amp;, &#40; vb.) çözer
 * - Ardışık boşlukları tekleştirir
 * - `maxLength` (160) üzerinde ise kelime sınırına geri çekilip `…` ile biter
 */
function htmlToPlainText(html: string, maxLength = 160): string {
  if (!html) return ""

  let text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, "")

  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#40;/gi, "(")
    .replace(/&#41;/gi, ")")
    .replace(/&#(\d+);/g, (_, d: string) => {
      const code = parseInt(d, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ""
    })
    .replace(/&[a-z]+;/gi, "")

  text = text.replace(/\s+/g, " ").trim()

  if (text.length <= maxLength) return text

  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(" ")
  const base = lastSpace > 40 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s.,;:!?-]+$/u, "")}…`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const siteUrl = getSiteUrl()
  const canonical = `${siteUrl}/baslik/${slug}`

  const topic = await fetchTopicBySlug(slug)
  if (!topic) {
    return {
      title: "Başlık Bulunamadı | Tespit Sözlük",
      description:
        "Aradığın başlık bulunamadı. Tespit Sözlük'te binlerce başlık arasından keşfe çıkabilirsin.",
      alternates: { canonical },
      robots: { index: false, follow: true },
    }
  }

  const firstEntry = await fetchFirstEntryContent(topic.id)
  const description =
    htmlToPlainText(firstEntry ?? "", 160) ||
    `${topic.title} başlığındaki entry'leri Tespit Sözlük'te oku ve yaz.`

  const pageTitle = `${topic.title} | Tespit Sözlük`

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      siteName: "Tespit Sözlük",
      type: "article",
      locale: "tr_TR",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: topic.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: ["/og-image.png"],
    },
  }
}

export default async function TopicSlugPage({ params }: PageProps) {
  const { slug } = await params
  const topic = await fetchTopicBySlug(slug)
  if (!topic) {
    notFound()
  }

  // Mevcut Client Component'e aktarılacak prop — tasarım/etkileşim mantığı aynen korunur.
  const initialTopic: InitialTopic = {
    id: String(topic.id),
    title: topic.title ?? "",
    entryCount: typeof topic.entryCount === "number" ? topic.entryCount : 0,
    authorId:
      topic.authorId != null && topic.authorId !== "" ? String(topic.authorId) : undefined,
    authorName: topic.authorName ?? undefined,
    authorUsername: topic.authorUsername ?? undefined,
    authorAvatar: topic.authorAvatar ?? null,
    createdAt: topic.createdAt,
    isAnonymous: topic.isAnonymous === true,
    isTopicOwner: topic.isTopicOwner === true,
    canManageTopic:
      typeof topic.canManageTopic === "boolean" ? topic.canManageTopic : undefined,
    isFollowedByCurrentUser: topic.isFollowedByCurrentUser === true,
    slug: topic.slug ?? slug,
    authorRole: topic.authorRole ?? undefined,
    isNovice: topic.isNovice === true,
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      }
    >
      <HomePageContent initialTopic={initialTopic} />
    </Suspense>
  )
}
