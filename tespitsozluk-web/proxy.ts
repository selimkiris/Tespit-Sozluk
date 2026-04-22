import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Giriş gerektirmeyen yollar (ziyaretçi / herkese açık).
 * Uygulama oturumunu istemcide (localStorage) tuttuğu için bu proxy
 * yönlendirme yapmaz; sunucu tarafı oturum eklendiğinde bu liste korunan
 * rotaları tanımlamak için referans olur. `/hakkimizda` açıkça burada.
 */
export const publicExactPaths: readonly string[] = [
  "/",
  "/hakkimizda",
  "/login",
  "/sifremi-unuttum",
  "/sifre-sifirla",
  "/robots.txt",
  "/sitemap.xml",
]

export function publicPathMatchers(pathname: string): boolean {
  if (publicExactPaths.includes(pathname)) return true
  if (pathname.startsWith("/entry/")) return true
  if (pathname.startsWith("/user/")) return true
  if (pathname.startsWith("/api/")) return true
  if (pathname.startsWith("/_next/")) return true
  return false
}

export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|marka\\.svg|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|txt|xml|json|webmanifest)$).*)"],
}
