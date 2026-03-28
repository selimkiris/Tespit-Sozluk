"use client"

import Link from "next/link"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import type { NotificationItem } from "@/lib/notification-types"

const LIKE_MESSAGES = [
  "Nick_name bu entry'ne kalbini bıraktı. Kaliteyi nerede görse tanıyor kerata ♥️",
  "Nick_name entry'ne kalbini bıraktı. Yazdıkların adamın sol tarafını sızlatmış ♥️",
  "Nick_name entry'ne bir kalp kondurdu. Ağzının tadını biliyor ♥️",
  "Nick_name entry'ne kalp attı. Algısı açık birey tespit edildi ♥️",
  "Nick_name entry'ni kalplemiş. Kültür seviyesi +1 arttı ♥️",
  "Nick_name entry'ne kalp attı. Annen görse gözleri dolardı ♥️",
  "Nick_name entry'ne kalp bıraktı. İnternet biraz daha yaşanabilir artık ♥️",
  "Nick_name entry'ne kalp attı. Edebiyat kazandı ♥️",
  "Nick_name entry'ne vuruldu ♥️",
  "Nick_name kalbini entry'nin altına gömdü ♥️",
  "Nick_name entry'nle aşk yaşadı ♥️",
  "Nick_name entry'ne aşık oldu ♥️",
  "Nick_name entry'nle derin bir bağ kurdu ♥️",
  "Nick_name entry'ne sevdalandı ♥️",
  "Nick_name her gece yatmadan senin entry'ni okuyor ♥️",
  "Nick_name entry'ne kalp bıraktı. Duygularının tercümanı olmuşsun ♥️",
  "Nick_name entry'ni okuyunca mutluluktan göz yaşlarına boğuldu ♥️",
  "Nick_name entry'ne kalp attı. Ya nolacağdı ♥️",
  "Nick_name entry'ne kalp attı sonra da ayakta alkışladı ♥️",
  "Nick_name entry'ni okurken kendinden geçti ♥️",
  "Nick_name entry'ne kendi kalbini bıraktı, sonra da öldü ♥️",
  "Nick_name entry'ni okuduktan sonra eliyle kalp yaptı ama çokta beceremedi ♥️",
  "Nick_name entry'ni takdir ediyor ♥️",
  "Nick_name entry'ni okurken sevinçten ossuru verdi ♥️",
  "Nick_name entry'ne kalp bıraktı. Değer puanın +1 arttı ♥️",
  "Nick_name entry'ne kalp bıraktı. Saygı puanın +1 arttı ♥️",
  "Nick_name entry'ne kalp bıraktı. Tespit Sözlük hisseleri yükselişte ♥️",
  "Nick_name entry'ne kalp bıraktı. Cidden seviliyorsun kız ♥️",
] as const

const DISLIKE_MESSAGES = [
  "Birisi entry'ne çorapsız ayak soktu ama kim olduğunu göremedim 🦶",
  "Birisi entry'ni ayaklamış ama kim olduğunu göremedim 🦶",
  "Gizemli bir ayak entry'ne girdi. Eleştiri mi kıskançlık mı bilinmez 🦶",
  "Birisi entry'ne ayak soktu. Kıskançlık kokusu alıyorum biraz da ayak 🦶",
  "Birisi entry'ne ayağını daldırdı. Kim olduğunu göremedim ama çorabı delikti 🦶",
  "Birisi entry'ne ayak soktu, kim olduğunu söylememem için bana da para verdi 🦶",
  "Birisi entry'ne ayak soktu (leş gibi) ama kim olduğunu söylemem 🦶",
  "Birisi entry'ne 45 numara, kıllı bir ayak soktu. Kim olduğunu söylersem ağzıma sokacakmış 🦶",
  "Birisi entry'ne ayak soktu. Kim olduğunu göremedim ama entry'ni bi havalandır istersen 🦶",
  "Birisi entry'nizi okuyup böyle entry'e ayağım girsin dedi. Pislik herif 🦶",
  "Birisi entry'nizin yanına yaklaşıp ayağını sokup kaçtı 🦶",
  "Mantarlı bir ayak entry'nizin kalitesini bozdu 🦶",
  "Birisi entry'nize ayağına koklatıp kaçtı 🦶",
  "Birisi entry'nizi ayağıyla dürttü 🦶",
  "Birisi entry'nize \"böyle entry'e ayağmı sokarım\" diyip daldırdı 🦶",
  "Birisi entry'nizle ayağını yıkadı 🦶",
  "Birisi entry'nize ayak soktu. Hijyen puanı -1 🦶",
  "Birisi entry'nize ayak soktu. Tespit Sözlük hisseleri düşüyor 🦶",
] as const

const SAVE_MESSAGES = [
  "Gizemli birisi enrty'ni çiviledi ve bunu resmen \"başucu eseri\" ilan etti 🔨",
  "Birisi entry'nizi kendi duvarına çiviledi 🔨",
  "Birisi entry'ni çiviledi. Tarihe not düşülüyor 🔨",
  "Gizemli birisi entry'ni çiviledi. Delil olarak saklıyor olabilir 🔨",
  "Gizemli birisi entry'ni çiviledi. Müzelik adamsın be 🔨",
  "Gizemli birisi entry'ni çiviledi. Gerçek bir şaheser yarattın 🔨",
  "Gizemli birisi entry'ni çiviledi. Tespit Sözlük hisseleri tavan yaptı 🔨",
  "Gizemli birisi entry'ni çiviledi. Gerçekten sağlam yazarmışsın 🔨",
  "Gizemli birisi entry'ni çiviledi. Ben bunu her gün okurum dedi 🔨",
  "Gizemli birisi entry'ni çiviledi. Büyük bir yazar doğuyor 🔨",
  "Gizemli birisi entry'ni çiviledi. Eserinle gurur duy 🔨",
] as const

const FOLLOW_MESSAGES = [
  "Nick_name artık ensende! Seni takip etmeye başladı 🕵️‍♂️",
  "Nick_name peşine takıldı. Dikkatli ol 🕵️‍♂️",
  "Nick_name hayran kulübüne katıldı 🕵️‍♂️",
  "Nick_name seni radarına aldı, ayağını denk al 🕵️‍♂️",
  "Birileri seni takip ediyor… Nick_name mesela 🕵️‍♂️",
  "Nick_name seni takibe aldı. Ün yavaş yavaş geliyor 🕵️‍♂️",
  "Nick_name seni takip ediyor. Şöhretin başlangıcı olabilir 🕵️‍♂️",
  "Nick_name peşine düştü! Adımlarını dikkatli at, artık bir gölgen var. 🕵️‍♂️",
  "Hayırlı olsun, Nick_name artık senin müridin 🕵️‍♂️",
  "Nick_name senin takipçin oldu, parti kur oy verelim dedi 🕵️‍♂️",
  "Nick_name senin fun'ın olduğunu kabul etti 🕵️‍♂️",
  "Nick_name seni takip etti ama gt atmazsan küsecek 🕵️‍♂️",
  "Nick_name ekibine katıldı 🕵️‍♂️",
] as const

const MENTION_MESSAGES = [
  "Nick_name seni bir entry'de andı. Git bi bak derim 📣",
  "Nick_name bir entry'de adını andı. Kulakların çınlıyorsa sebebi belli 📣",
  "Adın geçti: Nick_name seni entry'de yazmış. Olay çıkabilir 📣",
  "Nick_name bir entry'de seni anmış. Gir bak, kavga çıkabilir 📣",
  "Nick_name bir entry'e seni etiketledi. Kaos kokusu var 📣",
  "Nick_name bir entry'de senden bahsetmiş. İyi mi kötü mü Allah bilir 📣",
  "Bir entry'de adın var. Nick_name seni gündeme taşımış 📣",
  "Nick_name bir entry'de ismini zikretti 📣",
  "Nick_name seni etiketledi! Ya büyük bir tespitte parmağın var ya da fena patladın 📣",
  "Nick_name bir entry'de arkandan konuştu 📣",
  "Nick_name bir entry'de sana dümdüz kaydı, git bi bak derim 📣",
  "Nick_name bir entry'de sana döşendi, git bi bak derim 📣",
  "Nick_name bir entry'de adını dağlara yazdı 📣",
] as const

/** entry / enrty + isteğe bağlı Türkçe ek (kesme ve harfler) */
const ENTRY_TOKEN_RE = /((?:enrty|entry)(?:[''\u2019][a-zA-ZüğıöşçÜĞİÖŞÇ]+)?)/gi

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
  const nickParts = template.split("Nick_name")
  const nodes: ReactNode[] = []
  nickParts.forEach((chunk, i) => {
    nodes.push(...renderChunkWithEntryLinks(chunk, entryId, inlineEntryLinkClass, onLinkClick, `c${i}`))
    if (i < nickParts.length - 1) {
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
