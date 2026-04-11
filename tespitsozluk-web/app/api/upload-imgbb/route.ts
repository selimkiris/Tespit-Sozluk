import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const MAX_BYTES = 8 * 1024 * 1024

function imgbbErrorMessage(json: unknown, rawBody: string, httpStatus: number): string {
  if (typeof json === "object" && json !== null) {
    const root = json as Record<string, unknown>
    const errObj = root.error as Record<string, unknown> | undefined
    if (typeof errObj?.message === "string" && errObj.message.trim()) {
      return errObj.message.trim()
    }
    if (typeof root.status_txt === "string" && root.status_txt.trim()) {
      return root.status_txt.trim()
    }
  }
  const t = rawBody.trim()
  if (t) return t.slice(0, 500)
  return `ImgBB yanıtı başarısız (HTTP ${httpStatus}).`
}

export async function POST(request: NextRequest) {
  console.log("[upload-imgbb] API isteği alındı")
  console.log("[upload-imgbb] API key durumu:", !!process.env.IMGBB_API_KEY)

  const apiKey = process.env.IMGBB_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: "Görsel yükleme şu an yapılandırılmamış." },
      { status: 503 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (bodyErr) {
    console.error("[upload-imgbb] formData okunamadı:", bodyErr)
    return NextResponse.json(
      {
        error:
          bodyErr instanceof Error
            ? bodyErr.message
            : "İstek gövdesi okunamadı (boyut veya biçim sınırı).",
      },
      { status: 400 },
    )
  }

  const file = formData.get("image")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Yalnızca görsel dosyaları yüklenebilir." }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Dosya en fazla ${MAX_BYTES / (1024 * 1024)} MB olabilir.` },
      { status: 400 },
    )
  }

  let base64String: string
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    base64String = buffer.toString("base64")
  } catch (readErr) {
    console.error("[upload-imgbb] dosya base64 dönüşümü hatası:", readErr)
    return NextResponse.json({ error: "Dosya işlenemedi." }, { status: 500 })
  }

  /** ImgBB: x-www-form-urlencoded ile gönderim Node fetch + büyük gövdede FormData'dan daha stabil */
  const imgbbBody = new URLSearchParams()
  imgbbBody.set("key", apiKey)
  imgbbBody.set("image", base64String)

  let res: Response
  const prevTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  try {
    res = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: imgbbBody.toString(),
    })
  } catch (fetchErr) {
    console.error("[upload-imgbb] ImgBB fetch hatası:", fetchErr)
    if (fetchErr instanceof Error) {
      console.error("[upload-imgbb] fetch err name:", fetchErr.name, "message:", fetchErr.message)
      if ("cause" in fetchErr && fetchErr.cause) console.error("[upload-imgbb] fetch cause:", fetchErr.cause)
    }
    return NextResponse.json(
      {
        error:
          fetchErr instanceof Error
            ? `ImgBB bağlantı hatası: ${fetchErr.message}`
            : "Yükleme servisine ulaşılamadı.",
      },
      { status: 502 },
    )
  } finally {
    if (prevTlsRejectUnauthorized === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTlsRejectUnauthorized
    }
  }

  let rawBody: string
  try {
    rawBody = await res.text()
  } catch (textErr) {
    console.error("[upload-imgbb] ImgBB yanıt gövdesi okunamadı:", textErr)
    return NextResponse.json({ error: "ImgBB yanıtı okunamadı." }, { status: 502 })
  }

  let json: unknown = null
  try {
    json = rawBody ? JSON.parse(rawBody) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const msg = imgbbErrorMessage(json, rawBody, res.status)
    console.error("[upload-imgbb] ImgBB HTTP hata:", res.status, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const root = json as Record<string, unknown> | null
  if (!root || root.success !== true) {
    const msg = imgbbErrorMessage(json, rawBody, res.status)
    console.error("[upload-imgbb] ImgBB success=false:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const data = root.data as Record<string, unknown> | undefined
  const url =
    (typeof data?.url === "string" && data.url) ||
    (typeof data?.display_url === "string" && data.display_url) ||
    null

  if (!url) {
    return NextResponse.json(
      { error: imgbbErrorMessage(json, rawBody, res.status) },
      { status: 500 },
    )
  }

  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return NextResponse.json({ error: "Geçersiz görsel adresi." }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: "Geçersiz görsel adresi." }, { status: 500 })
  }

  console.log("[upload-imgbb] yükleme tamam")
  return NextResponse.json({ url })
}
