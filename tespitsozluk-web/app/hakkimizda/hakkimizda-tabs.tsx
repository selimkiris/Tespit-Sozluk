"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Info, Instagram, Mail, Scale, Twitter } from "lucide-react"
import { aboutConfig } from "@/lib/about.config"
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
        <TabsTrigger
          value="anayasa"
          className="gap-2 py-2.5 text-center text-xs leading-tight sm:py-2 sm:text-sm"
        >
          <Scale className="h-4 w-4 shrink-0" />
          Tespit Sözlük Anayasası
        </TabsTrigger>
        <TabsTrigger value="iletisim" className="gap-2 py-2.5 sm:py-2">
          <Mail className="h-4 w-4 shrink-0" />
          İletişim
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

      <TabsContent value="anayasa" className="mt-0">
        <article className="max-w-none scroll-mt-24">
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
            Tespit Sözlük Anayasası
          </h1>
          <p className="mb-8 text-base leading-relaxed text-muted-foreground">
            {`Tespit Sözlük\u2019ün kuralları aslında senin kuralların. Biz burayı olgun insanların kendi iç disiplinleriyle var olacağı bir alan olarak hayal ettik. Sen kendi sınırlarını bilirsen burası dünyanın en keyifli platformu olur. Yine de bazı şeyleri netleştirmekte fayda var:`}
          </p>

          <h2 className="mt-10 mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            1. Ruh ve Format Meselesi
          </h2>
          <ul className="mt-4 list-none space-y-4 pl-0">
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Katı Kurallara Elveda: </span>
              <span className="text-foreground/90">
                Bildiğin o eski, bürokratik sözlük formatları burada yok. Burası yeni nesil bir
                sözlük, Zihnin Kayda Geçtiği Yer, yani zihninden ne geçiyorsa o.
              </span>
            </li>
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Başlık Şıklığı: </span>
              <span className="text-foreground/90">
                Başlıklarımızın daha şık görünmesi için yeni bir başlık açarken imla kurallarına
                uymanı ve anlatım için eğer elzem değilse tamamı büyük harflerden oluşan başlıklar
                açmamanı bekliyoruz.
              </span>
            </li>
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Özgünlük Esastır: </span>
              <span className="text-foreground/90">
                Biz senin gözlemlerini, senin tespitlerini, senin fikirlerini merak ediyoruz. Başka
                yerden kopyala-yapıştır yapılan içerikler ruhumuza aykırıdır. Tabii bazen bir yerden
                bilgi aktarmak durumunda kalabilirsin, böyle zamanlarda da kaynak göstermek elzemdir.
              </span>
            </li>
          </ul>

          <h2 className="mt-10 mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            2. Saygı ve Üslup
          </h2>
          <ul className="mt-4 list-none space-y-4 pl-0">
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Küfür Meselesi: </span>
              <span className="text-foreground/90">
                Argo ve küfür bizim için lisanın birer parçasıdır. Ama duracağın yeri bilmelisin:
                Dini, milli, kutsal değerlere ve doğrudan bir yazara saldırmak, aşağılamak,
                ağır/sinkaflı küfürler etmek yasaktır.
              </span>
            </li>
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Gizlilik Kutsaldır: </span>
              <span className="text-foreground/90">
                Yazarların gerçek kimliklerini ifşa etmek (doxxing) kesinlikle yasaktır.
              </span>
            </li>
          </ul>

          <h2 className="mt-10 mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            3. Düzen ve İçerik Kalitesi
          </h2>
          <ul className="mt-4 list-none space-y-4 pl-0">
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Arama Yapmadan Geçme: </span>
              <span className="text-foreground/90">
                Bilgi kirliliği zihin yorar. Yeni bir başlık açmadan önce mutlaka arama yapmalısın.
                Aynı şeyi birebir anlatan başka başlıklar açmamalısın.
              </span>
            </li>
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">{`İçi boş entry\u2019ler: `}</span>
              <span className="text-foreground/90">
                {`Sadece "+1", "rez", "aynen" gibi hiçbir beyin kullanımı içermeyen entry\u2019ler silinebilir.`}
              </span>
            </li>
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">+18 İçerikler: </span>
              <span className="text-foreground/90">
                {`Şiddet, korku, vahşet, kan, cinsellik içeren paylaşımlarda "+18 (Sebebi)" şeklinde ibare koymak zorunludur. Kimseyi hazırlıksız yakalamayalım.`}
              </span>
            </li>
          </ul>

          <h2 className="mt-10 mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            4. Etik ve Güvenlik
          </h2>
          <ul className="mt-4 list-none space-y-4 pl-0">
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Hukuki Sorumluluk: </span>
              <span className="text-foreground/90">
                Paylaşılan her türlü içeriğin Türkiye Cumhuriyeti yasalarına uygun olması gerekir.
                Hukuki sorumluluk tamamen yazarlara aittir.
              </span>
            </li>
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Manipülasyona Hayır: </span>
              <span className="text-foreground/90">
                {`Bir yazarın birden fazla hesapla gündem oluşturmaya çalışması, kendi entry\u2019lerini parlatması veya topluluğu yalan haberlerle (fake news) galeyana getirmeye çalışması yasaktır.`}
              </span>
            </li>
            <li className="leading-relaxed">
              <span className="font-bold text-foreground">Yaş Sınırı: </span>
              <span className="text-foreground/90">
                Tespit Sözlük, içeriği itibarıyla 18 yaşından küçük dostlarımız için uygun değildir.
              </span>
            </li>
          </ul>
        </article>
      </TabsContent>

      <TabsContent value="iletisim" className="mt-0">
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24">
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
