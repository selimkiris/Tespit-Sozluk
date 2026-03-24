import Link from "next/link"
import { KeyRound } from "lucide-react"

export default function SifremiUnuttumPage() {
  return (
    <div className="min-h-screen bg-background pt-14">
      <div className="mx-auto max-w-xl px-4 py-10 lg:px-6 lg:py-12">
        <header className="mb-8">
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity cursor-pointer"
          >
            Tespit Sözlük
          </Link>
        </header>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <KeyRound className="h-5 w-5 text-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Parolayı Unuttum
            </h1>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              Lütfen Tespit Sözlük&apos;e kayıt olduğunuz e-posta adresiniz üzerinden{" "}
              <strong className="font-semibold text-foreground">tespitsozluk@gmail.com</strong>{" "}
              adresine şifrenizi unuttuğunuza dair bir mail gönderin. Bu işlemler birkaç gün
              sürebilir. Lütfen bu süreçte e-posta kutunuzu (ve spam klasörünü) sık sık kontrol
              edin.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            Ana sayfaya dön
          </Link>
        </p>
      </div>
    </div>
  )
}
