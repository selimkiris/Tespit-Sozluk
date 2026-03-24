import { Suspense } from "react"
import Link from "next/link"
import { SifreSifirlaInner } from "./sifre-sifirla-inner"

export default function SifreSifirlaPage() {
  return (
    <div className="min-h-screen bg-background pt-14">
      <div className="mx-auto max-w-md px-4 py-10 lg:px-6 lg:py-12">
        <header className="mb-8">
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity cursor-pointer"
          >
            Tespit Sözlük
          </Link>
        </header>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="mb-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Şifre sıfırlama
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Yeni şifrenizi belirleyin. E-postadaki bağlantıdan geldiyseniz token otomatik
            kullanılır.
          </p>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Yükleniyor…
              </p>
            }
          >
            <SifreSifirlaInner />
          </Suspense>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline-offset-4 hover:underline">
            Giriş sayfasına dön
          </Link>
        </p>
      </div>
    </div>
  )
}
