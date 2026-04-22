import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"
import { tr } from "date-fns/locale"

/** API NotificationResponseDto — JSON alan adları (camelCase veya PascalCase). */

const NOTIFICATION_RELATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** Bildirim zamanını okunaklı gösterir: yakın tarihler için göreli (örn. "2 saat önce"), eskiler için "12.04.2026". */
export function formatNotificationTime(iso: string): string {
  const s = iso?.trim()
  if (!s) return ""
  const d = parseISO(s)
  if (!isValid(d)) return ""
  const age = Date.now() - d.getTime()
  if (age >= 0 && age < NOTIFICATION_RELATIVE_WINDOW_MS) {
    return formatDistanceToNow(d, { addSuffix: true, locale: tr })
  }
  return format(d, "dd.MM.yyyy", { locale: tr })
}

export const NotificationType = {
  Follow: "Follow",
  TopicFollow: "TopicFollow",
  Like: "Like",
  Dislike: "Dislike",
  Save: "Save",
  Mention: "Mention",
  OfficialWarning: "OfficialWarning",
  AdminMessage: "AdminMessage",
  SystemAlert: "SystemAlert",
} as const

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType]

export interface NotificationItem {
  id: string
  senderId: string
  senderName: string
  /** İşlemi yapan (API: actorId / senderId). */
  actorId: string
  entryId: string | null
  topicId: string | null
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

function str(v: unknown): string {
  if (v == null) return ""
  return String(v)
}

/** Bildirim listesi API öğesini güvenli şekilde NotificationItem'a çevirir. */
export function mapNotificationFromApi(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== "object") return null
  const n = raw as Record<string, unknown>
  const id = str(n.id ?? n.Id)
  if (!id) return null
  const entryRaw = n.entryId ?? n.EntryId
  const entryId =
    entryRaw != null && entryRaw !== "" ? str(entryRaw) : null
  const topicRaw = n.topicId ?? n.TopicId
  const topicId =
    topicRaw != null && topicRaw !== "" ? str(topicRaw) : null
  const senderId = str(n.senderId ?? n.SenderId)
  const actorId = str(n.actorId ?? n.ActorId ?? senderId)
  return {
    id,
    senderId,
    actorId,
    senderName: str(n.senderName ?? n.SenderName),
    entryId,
    topicId,
    type: str(n.type ?? n.Type),
    message: str(n.message ?? n.Message),
    isRead: Boolean(n.isRead ?? n.IsRead),
    createdAt: str(n.createdAt ?? n.CreatedAt),
  }
}

export function isHtmlNotificationType(type: string): boolean {
  return (
    type === NotificationType.OfficialWarning ||
    type === NotificationType.AdminMessage ||
    type === NotificationType.SystemAlert
  )
}
