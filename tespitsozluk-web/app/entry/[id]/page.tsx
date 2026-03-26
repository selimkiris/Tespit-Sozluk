import { Metadata } from "next"
import { notFound } from "next/navigation"
import { EntryPageContent } from "@/components/entry-page-content"
import { getApiUrl, getSiteUrl } from "@/lib/api"

type Props = {
  params: Promise<{ id: string }>
}

async function fetchEntry(id: string) {
  const res = await fetch(getApiUrl(`api/Entries/${id}`), {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) return null
  return res.json()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const entry = await fetchEntry(id)
  if (!entry) {
    return { title: "Entry Bulunamadı | Tespit Sözlük" }
  }

  const siteUrl = getSiteUrl()
  const entryUrl = `${siteUrl}/entry/${id}`
  const title = `${entry.topicTitle} - ${entry.authorName} | Tespit Sözlük`
  const description =
    entry.content?.length > 100
      ? `${entry.content.slice(0, 100).replace(/\s+/g, " ").trim()}...`
      : (entry.content || "").replace(/\s+/g, " ").trim() || "Tespit Sözlük entry'si"

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: entryUrl,
      siteName: "Tespit Sözlük",
      type: "article",
      locale: "tr_TR",
      images: [
        {
          url: "/og-image.png",
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    alternates: {
      canonical: entryUrl,
    },
  }
}

export default async function EntryPage({ params }: Props) {
  const { id } = await params
  const entry = await fetchEntry(id)

  if (!entry) {
    notFound()
  }

  return <EntryPageContent key={id} entry={entry} />
}
