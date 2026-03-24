"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Ups! Kablolara biri takıldı galiba...
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sunucumuzun kahvesi bitmiş veya beklenmedik bir hata oluşmuş olabilir. Endişelenme, verilerin güvende!
          </p>
        </div>
        <Button
          type="button"
          onClick={() => reset()}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          Sayfayı Yenile (Şansını Tekrar Dene)
        </Button>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Eğer bu ekranla inatla bakışmaya devam ediyorsan, durumu bize hemen tespitsozluk@gmail.com adresinden yaz. Yazılımcımızı uykusundan uyandırıp hemen çözüyoruz! 🚀
        </p>
      </div>
    </div>
  )
}
