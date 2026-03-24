import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const IBB_VIEWER_HOSTS = new Set(["ibb.co", "www.ibb.co"])

function isIbBbViewerUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    if (!IBB_VIEWER_HOSTS.has(u.hostname)) return false
    const path = u.pathname.replace(/\/$/, "") || "/"
    if (path === "/") return false
    const id = path.slice(1)
    return /^[a-zA-Z0-9]+$/.test(id)
  } catch {
    return false
  }
}

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function extractOgImage(html: string): string | null {
  const m1 = html.match(
    /<meta\s+[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
  )
  if (m1?.[1]) return decodeBasicHtmlEntities(m1[1].trim())

  const m2 = html.match(
    /<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["']/i,
  )
  if (m2?.[1]) return decodeBasicHtmlEntities(m2[1].trim())

  return null
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim()
  if (!url) {
    return NextResponse.json({ error: "url parametresi gerekli." }, { status: 400 })
  }
  if (!isIbBbViewerUrl(url)) {
    return NextResponse.json(
      { error: "Geçerli bir ImgBB görüntüleyici (ibb.co) bağlantısı değil." },
      { status: 400 },
    )
  }

  let res: Response
  try {
    res = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; TespitSozluk/1.0; +https://github.com/) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      next: { revalidate: 0 },
    })
  } catch {
    return NextResponse.json({ error: "Sayfa indirilemedi." }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: "ImgBB sayfası alınamadı." }, { status: 502 })
  }

  const html = await res.text()
  const imageUrl = extractOgImage(html)
  if (!imageUrl) {
    return NextResponse.json(
      { error: "Sayfada og:image bulunamadı." },
      { status: 422 },
    )
  }

  try {
    const u = new URL(imageUrl)
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return NextResponse.json({ error: "Geçersiz görsel adresi." }, { status: 422 })
    }
  } catch {
    return NextResponse.json({ error: "Geçersiz görsel adresi." }, { status: 422 })
  }

  return NextResponse.json({ url: imageUrl })
}
