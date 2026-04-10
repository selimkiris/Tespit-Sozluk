"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import type { NotificationItem } from "@/lib/notification-types"

const LIKE_MESSAGES = [
  "♥️ Mahlas_name bu entry'ne kalbini bıraktı. Kaliteyi nerede görse tanıyor kerata",
  "♥️ Mahlas_name entry'ne kalbini bıraktı. Yazdıkların adamın sol tarafını sızlatmış",
  "♥️ Mahlas_name entry'ne bir kalp kondurdu. Ağzının tadını biliyor",
  "♥️ Mahlas_name entry'ne kalp attı. Algısı açık bir birey tespit edildi",
  "♥️ Mahlas_name entry'ni kalplemiş. Kültür seviyesi +1 arttı",
  "♥️ Mahlas_name entry'ne kalp attı. Annen görse gözleri dolardı",
  "♥️ Mahlas_name entry'ne kalp bıraktı. Artık internet biraz daha yaşanabilir",
  "♥️ Mahlas_name entry'ne kalp attı. Edebiyat kazandı",
  "♥️ Mahlas_name entry'ne vuruldu",
  "♥️ Mahlas_name kalbini entry'nin altına gömdü",
  "♥️ Mahlas_name entry'nle aşk yaşadı",
  "♥️ Mahlas_name entry'ne aşık oldu",
  "♥️ Mahlas_name entry'nle derin bir bağ kurdu",
  "♥️ Mahlas_name entry'ne sevdalandı",
  "♥️ Mahlas_name her gece yatmadan senin entry'ni okuyor",
  "♥️ Mahlas_name entry'ne kalp bıraktı. Duygularının tercümanı olmuşsun",
  "♥️ Mahlas_name entry'ni okuyunca mutluluktan gözyaşlarına boğuldu",
  "♥️ Mahlas_name entry'ne kalp attı. Ya nolacağdı",
  "♥️ Mahlas_name entry'ne kalp attı, sonra da ayakta alkışladı",
  "♥️ Mahlas_name entry'ni okurken kendinden geçti",
  "♥️ Mahlas_name entry'ne kendi kalbini bıraktı, sonra da öldü",
  "♥️ Mahlas_name entry'ni okuduktan sonra eliyle kalp yaptı ama çok da beceremedi",
  "♥️ Mahlas_name entry'ni takdir ediyor",
  "♥️ Mahlas_name entry'ni okurken sevinçten pırtlatıverdi",
  "♥️ Mahlas_name entry'ne kalp bıraktı. Değer puanın +1 arttı",
  "♥️ Mahlas_name entry'ne kalp bıraktı. Saygı puanın +1 arttı",
  "♥️ Mahlas_name entry'ne kalp bıraktı. Tespit Sözlük hisseleri yükselişte",
  "♥️ Mahlas_name entry'ne kalp bıraktı. Cidden seviliyorsun kız",
] as const

const DISLIKE_MESSAGES = [
  "🦶 Birisi entry'ne çorapsız ayak soktu ama kim olduğunu göremedim",
  "🦶 Birisi entry'ni ayaklamış ama kim olduğunu göremedim",
  "🦶 Gizemli bir ayak entry'ne girdi. Eleştiri mi kıskançlık mı bilinmez",
  "🦶 Birisi entry'ne ayak soktu. Kıskançlık kokusu alıyorum biraz da ayak",
  "🦶 Birisi entry'ne ayağını daldırdı. Kim olduğunu göremedim ama çorabı delikti",
  "🦶 Birisi entry'ne ayak soktu, kim olduğunu söylememem için bana da para verdi",
  "🦶 Birisi entry'ne ayak soktu (leş gibi) ama kim olduğunu söylemem",
  "🦶 Birisi entry'ne 45 numara, kıllı bir ayak soktu. Kim olduğunu söylersem ağzıma sokacakmış",
  "🦶 Birisi entry'ne ayak soktu. Kim olduğunu göremedim ama entry'ni bi havalandır istersen",
  "🦶 Birisi entry'nizi okuyup \"Böyle entry'ye ayağım girsin\" dedi. Pislik herif",
  "🦶 Birisi entry'nizin yanına yaklaşıp ayağını daldırıp kaçtı",
  "🦶 Mantarlı bir ayak entry'nizin kalitesini bozdu",
  "🦶 Birisi entry'nize ayağını koklatıp kaçtı",
  "🦶 Birisi entry'nizi ayağıyla dürttü",
  "🦶 Birisi entry'nize \"Böyle entry'ye ayağımı sokarım\" deyip daldırdı",
  "🦶 Birisi entry'nizle ayağını yıkadı",
  "🦶 Birisi entry'nize ayak soktu. Hijyen puanı -1",
  "🦶 Birisi entry'nize ayak soktu. Tespit Sözlük hisseleri düşüyor",
] as const

const SAVE_MESSAGES = [
  "🔨 Gizemli birisi entry'ni çiviledi ve bunu resmen \"başucu eseri\" ilan etti",
  "🔨 Birisi entry'nizi kendi duvarına çiviledi",
  "🔨 Birisi entry'ni çiviledi. Tarihe not düşülüyor",
  "🔨 Gizemli birisi entry'ni çiviledi. Delil olarak saklıyor olabilir",
  "🔨 Gizemli birisi entry'ni çiviledi. Müzelik adamsın be",
  "🔨 Gizemli birisi entry'ni çiviledi. Gerçek bir şaheser yarattın",
  "🔨 Gizemli birisi entry'ni çiviledi. Tespit Sözlük hisseleri tavan yaptı",
  "🔨 Gizemli birisi entry'ni çiviledi. Gerçekten sağlam yazarmışsın",
  "🔨 Gizemli birisi entry'ni çiviledi. \"Ben bunu her gün okurum\" dedi",
  "🔨 Gizemli birisi entry'ni çiviledi. Büyük bir yazar doğuyor",
  "🔨 Gizemli birisi entry'ni çiviledi. Eserinle gurur duy",
] as const

const FOLLOW_MESSAGES = [
  "🕵️‍♂️ Mahlas_name artık ensende! Seni takip etmeye başladı",
  "🕵️‍♂️ Mahlas_name peşine takıldı. Dikkatli ol",
  "🕵️‍♂️ Mahlas_name hayran kulübüne katıldı",
  "🕵️‍♂️ Mahlas_name seni radarına aldı, ayağını denk al",
  "🕵️‍♂️ Birileri seni takip ediyor… Mahlas_name mesela",
  "🕵️‍♂️ Mahlas_name seni takibe aldı. Ün yavaş yavaş geliyor",
  "🕵️‍♂️ Mahlas_name seni takip ediyor. Şöhretin başlangıcı olabilir",
  "🕵️‍♂️ Mahlas_name peşine düştü! Adımlarını dikkatli at, artık bir gölgen var.",
  "🕵️‍♂️ Hayırlı olsun, Mahlas_name artık senin müridin",
  "🕵️‍♂️ Mahlas_name senin takipçin oldu, \"parti kur oy verelim\" dedi",
  "🕵️‍♂️ Mahlas_name senin fan'ın olduğunu kabul etti",
  "🕵️‍♂️ Mahlas_name seni takip etti ama gt atmazsan küsecek",
  "🕵️‍♂️ Mahlas_name ekibine katıldı",
] as const

const MENTION_MESSAGES = [
  "📣 Mahlas_name seni bir entry'de andı. Git bi bak derim",
  "📣 Mahlas_name bir entry'de adını andı. Kulakların çınlıyorsa sebebi belli",
  "📣 Adın geçti: Mahlas_name seni entry'de yazmış. Olay çıkabilir",
  "📣 Mahlas_name bir entry'de seni anmış. Gir bak, kavga çıkabilir",
  "📣 Mahlas_name bir entry'ye seni etiketledi. Kaos kokusu var",
  "📣 Mahlas_name bir entry'de senden bahsetmiş. İyi mi kötü mü Allah bilir",
  "📣 Bir entry'de adın var. Mahlas_name seni gündeme taşımış",
  "📣 Mahlas_name bir entry'de ismini zikretti",
  "📣 Mahlas_name seni etiketledi! Ya büyük bir tespitte parmağın var ya da fena patladın",
  "📣 Mahlas_name bir entry'de arkandan konuştu",
  "📣 Mahlas_name bir entry'de sana dümdüz kaydı, git bi bak derim",
  "📣 Mahlas_name bir entry'de sana döşendi, git bi bak derim",
  "📣 Mahlas_name bir entry'de adını dağlara yazdı",
] as const

/** entry / enrty + isteğe bağlı Türkçe ek (kesme ve harfler) */
const ENTRY_TOKEN_RE = /((?:enrty|entry)(?:[''\u2019][a-zA-ZüğıöşçÜĞİÖŞÇ]+)?)/gi

/** Sunucu ve istemcide aynı şablon indeksini verir (Math.random kullanılmaz). */
export function pickTemplateIndex(notificationId: string, length: number): number {
  if (length <= 0) return 0
  const sum = notificationId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return sum % length
}

type LinkClick = (e: ReactMouseEvent<HTMLAnchorElement>) => void

function renderChunkWithEntryLinks(
  chunk: string,
  entryId: string | null,
  inlineEntryLinkClass: string,
  onLinkClick: LinkClick,
  keyPrefix: string,
): ReactNode[] {
  const parts = chunk.split(ENTRY_TOKEN_RE)
  if (parts.length === 1) return [chunk]
  const out: ReactNode[] = []
  let k = 0
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (i % 2 === 0) {
      out.push(p)
    } else if (entryId) {
      out.push(
        <Link key={`${keyPrefix}-e-${k++}`} href={`/entry/${entryId}`} className={inlineEntryLinkClass} onClick={onLinkClick}>
          {p}
        </Link>,
      )
    } else {
      out.push(
        <span key={`${keyPrefix}-e-${k++}`}>{p}</span>,
      )
    }
  }
  return out
}

function buildNodesFromTemplate(
  template: string,
  authorProfileId: string | null,
  authorLabel: string,
  entryId: string | null,
  userLinkClass: string,
  inlineEntryLinkClass: string,
  onLinkClick: LinkClick,
): ReactNode[] {
  const mahlasParts = template.split("Mahlas_name")
  const nodes: ReactNode[] = []
  mahlasParts.forEach((chunk, i) => {
    nodes.push(...renderChunkWithEntryLinks(chunk, entryId, inlineEntryLinkClass, onLinkClick, `c${i}`))
    if (i < mahlasParts.length - 1) {
      if (authorProfileId) {
        nodes.push(
          <Link key={`n-${i}`} href={`/user/${authorProfileId}`} className={userLinkClass} onClick={onLinkClick}>
            {authorLabel}
          </Link>,
        )
      } else {
        nodes.push(
          <span key={`n-${i}`} className="font-medium">
            {authorLabel}
          </span>,
        )
      }
    }
  })
  return nodes
}

export type NotificationCopyVariant = "like" | "dislike" | "save" | "follow" | "mention"

export function renderNotificationCopy({
  notification,
  variant,
  userLinkClass,
  inlineEntryLinkClass,
  onLinkClick,
}: {
  notification: NotificationItem
  variant: NotificationCopyVariant
  userLinkClass: string
  inlineEntryLinkClass: string
  onLinkClick: LinkClick
}): ReactNode {
  const authorLabel = notification.senderName.trim() || "Bir kullanıcı"
  const authorProfileId = (notification.actorId || notification.senderId).trim() || null
  const senderProfileId = notification.senderId.trim() || null
  const entryId = notification.entryId

  let templates: readonly string[]
  switch (variant) {
    case "like":
      templates = LIKE_MESSAGES
      break
    case "dislike":
      templates = DISLIKE_MESSAGES
      break
    case "save":
      templates = SAVE_MESSAGES
      break
    case "follow":
      templates = FOLLOW_MESSAGES
      break
    case "mention":
      templates = MENTION_MESSAGES
      break
    default:
      templates = []
  }

  const idx = pickTemplateIndex(notification.id, templates.length)
  const template = templates[idx] ?? ""

  if (variant === "follow") {
    const nodes = buildNodesFromTemplate(
      template,
      senderProfileId,
      authorLabel,
      null,
      userLinkClass,
      inlineEntryLinkClass,
      onLinkClick,
    )
    return <>{nodes}</>
  }

  if (variant === "dislike" || variant === "save") {
    if (!entryId) {
      return <span className="text-muted-foreground">{notification.message || "Bildirim içeriği yüklenemedi."}</span>
    }
    const nodes = renderChunkWithEntryLinks(template, entryId, inlineEntryLinkClass, onLinkClick, "solo")
    return <>{nodes}</>
  }

  if (variant === "like" || variant === "mention") {
    if (!entryId) {
      return <span className="text-muted-foreground">{notification.message || "Bildirim içeriği yüklenemedi."}</span>
    }
    const profileForNick = variant === "mention" ? authorProfileId : senderProfileId
    const nodes = buildNodesFromTemplate(
      template,
      profileForNick,
      authorLabel,
      entryId,
      userLinkClass,
      inlineEntryLinkClass,
      onLinkClick,
    )
    return <>{nodes}</>
  }

  return <span className="text-muted-foreground">{notification.message}</span>
}

export type NotificationCopyProps = {
  notification: NotificationItem
  variant: NotificationCopyVariant
  userLinkClass: string
  inlineEntryLinkClass: string
  onLinkClick: LinkClick
}

/**
 * Şablonlu bildirim metnini yalnızca istemci mount olduktan sonra gösterir; SSR ile ilk hidrasyon çakışmasını önler.
 * İçerik, link, Mahlas_name yer tutucusu ve entry mantığı `renderNotificationCopy` ile aynıdır.
 */
export function NotificationCopy(props: NotificationCopyProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) {
    return (
      <span className="inline-block min-h-[1.25rem] w-full" aria-hidden suppressHydrationWarning />
    )
  }
  return <span suppressHydrationWarning>{renderNotificationCopy(props)}</span>
}
