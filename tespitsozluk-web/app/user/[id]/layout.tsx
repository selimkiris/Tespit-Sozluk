import type { Metadata } from "next"
import { getApiUrl, getSiteUrl } from "@/lib/api"

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

async function fetchUserForMeta(userId: string) {
  const res = await fetch(getApiUrl(`api/Users/${userId}`), {
    next: { revalidate: 300 },
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    nickname?: string
    bio?: string | null
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await fetchUserForMeta(id)
  const siteUrl = getSiteUrl()
  const profileUrl = `${siteUrl}/user/${id}`

  if (!data?.nickname) {
    return {
      title: "Profil | Tespit Sözlük",
      description: "Tespit Sözlük kullanıcı profili.",
      alternates: { canonical: profileUrl },
      openGraph: {
        url: profileUrl,
        siteName: "Tespit Sözlük",
        type: "profile",
        locale: "tr_TR",
        title: "Profil | Tespit Sözlük",
        description: "Tespit Sözlük kullanıcı profili.",
        images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Tespit Sözlük" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Profil | Tespit Sözlük",
        description: "Tespit Sözlük kullanıcı profili.",
        images: ["/og-image.png"],
      },
    }
  }

  const name = String(data.nickname)
  const title = `${name} | Tespit Sözlük`
  const bio = typeof data.bio === "string" ? data.bio.trim() : ""
  const description = bio
    ? `${name} — ${bio.length > 155 ? `${bio.slice(0, 155)}…` : bio}`
    : `${name} — profil ve entry'ler Tespit Sözlük'te.`

  return {
    title,
    description,
    alternates: { canonical: profileUrl },
    openGraph: {
      title,
      description,
      url: profileUrl,
      siteName: "Tespit Sözlük",
      type: "profile",
      locale: "tr_TR",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  }
}

export default function UserProfileLayout({ children }: Props) {
  return children
}
