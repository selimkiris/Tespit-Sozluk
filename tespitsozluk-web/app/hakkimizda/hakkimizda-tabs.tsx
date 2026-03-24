"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Info, Instagram, Mail, Scale, Sparkles, Twitter } from "lucide-react"
import { aboutConfig } from "@/lib/about.config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function HakkimizdaTabs() {
  return (
    <Tabs defaultValue="hakkimizda" className="w-full gap-6">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-muted/60 p-1 sm:grid-cols-3 sm:gap-1">
        <TabsTrigger value="hakkimizda" className="gap-2 py-2.5 sm:py-2">
          <Info className="h-4 w-4 shrink-0" />
          Hakkımızda
        </TabsTrigger>
        <TabsTrigger value="kurallar" className="gap-2 py-2.5 sm:py-2">
          <Scale className="h-4 w-4 shrink-0" />
          Kurallar & İletişim
        </TabsTrigger>
        <TabsTrigger value="guncellemeler" className="gap-2 py-2.5 sm:py-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          Güncelleme Notları
        </TabsTrigger>
      </TabsList>

      <TabsContent value="hakkimizda" className="mt-0">
        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-p:leading-relaxed">
          <h2>{aboutConfig.nedir.baslik}</h2>
          <p style={{ whiteSpace: "pre-line" }}>{aboutConfig.nedir.paragraf}</p>
          <Separator className="my-8" />
          <h2>{aboutConfig.nedenKuruldu.baslik}</h2>
          <p style={{ whiteSpace: "pre-line" }}>{aboutConfig.nedenKuruldu.paragraf}</p>
          <div className="not-prose">
            <h3 className="mt-10 mb-4 text-xl font-bold text-foreground">
              Tespit Sözlük Ne Yapmak, Nereye Varmak İstemektedir!
            </h3>
            <p className="leading-relaxed">
              Tespit Sözlük, o büyük ve çok kalabalık sözlüklere rakip veya ileride rakip olmayı
              hedefleyerek çıkmış bir platform değil; aksine bu sözlüklerin ilk zamanlarını hasretle
              anan, o küçük ama kaliteli kitleyi özleyen ve şu an hâlâ böyle bir kitlenin var
              olduğuna inanan bir platform.
            </p>
            <p className="mt-4 leading-relaxed">
              Bu sebepledir ki amacımız hiçbir zaman çok büyük kitlelere ulaşmak ve parayı kırmak
              değil; bizim amacımız bizim gibi düşünen, üretmeyi, faydalı olmayı, paylaşmayı seven,
              mizahı anlayan, hayata farklı bir yerden bakmaya cesaret edebilen insanlarla birlikte bu
              platformda birleşmek ve bu çizgide büyümek.
            </p>
          </div>
        </article>
      </TabsContent>

      <TabsContent value="kurallar" className="mt-0">
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24">
          <h2>Sözlük kuralları</h2>
          <ul className="not-prose list-none space-y-3 pl-0">
            {aboutConfig.kurallar.map((rule, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span style={{ whiteSpace: "pre-line" }}>{rule}</span>
              </li>
            ))}
          </ul>

          <Separator className="my-10" />

          <h2>İletişim</h2>
          <p className="text-muted-foreground">
            Genel sorularınız, önerileriniz, şikayetleriniz, teknik sorunlarınız ve iş birliği için
            e-posta gönderebilirsiniz.
          </p>
          <div className="not-prose mt-6">
            <div className="inline-flex max-w-sm flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Genel İletişim
              </div>
              <a
                href={`mailto:${aboutConfig.iletisim.email}`}
                className="text-sm text-foreground underline-offset-4 hover:underline"
              >
                {aboutConfig.iletisim.email}
              </a>
            </div>
          </div>

          {(() => {
            const aboutConfigSafe = aboutConfig as typeof aboutConfig & {
              sosyalMedya?: { instagram?: string; twitter?: string }
            }
            return (
              aboutConfigSafe?.sosyalMedya && (
                <div className="not-prose mt-8 flex flex-wrap gap-3">
                  {aboutConfigSafe.sosyalMedya?.instagram ? (
                    <ButtonSocial
                      href={aboutConfigSafe.sosyalMedya.instagram}
                      label="Instagram"
                    >
                      <Instagram className="h-4 w-4" />
                      Instagram
                    </ButtonSocial>
                  ) : null}
                  {aboutConfigSafe.sosyalMedya?.twitter ? (
                    <ButtonSocial
                      href={aboutConfigSafe.sosyalMedya.twitter}
                      label="X (Twitter)"
                    >
                      <Twitter className="h-4 w-4" />
                      X
                    </ButtonSocial>
                  ) : null}
                </div>
              )
            )
          })()}
        </div>
      </TabsContent>

      <TabsContent value="guncellemeler" className="mt-0">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h2>Güncelleme notları</h2>
        </div>
        <ol className="mt-6 space-y-4">
          {aboutConfig.guncellemeNotlari.map((release) => (
            <li key={release.versiyon}>
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <CardTitle className="text-lg">Sürüm {release.versiyon}</CardTitle>
                    <time
                      dateTime={release.tarih}
                      className="text-xs tabular-nums text-muted-foreground"
                    >
                      {release.tarih}
                    </time>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                    {release.notlar.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </TabsContent>
    </Tabs>
  )
}

function ButtonSocial({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      {children}
    </Link>
  )
}
