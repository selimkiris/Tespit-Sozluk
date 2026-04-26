/**
 * Entry ile birlikte API'ye gönderilecek anket payload'ı. Null/undefined olduğunda
 * mevcut (anketsiz) entry akışı değişmeden çalışır.
 */
export type EntryPollSubmission = {
  question: string
  options: string[]
  allowMultiple: boolean
  allowUserOptions: boolean
}

export type ApiPollOptionDto = {
  id: string
  text: string
  isUserAdded?: boolean
  isVotedByCurrentUser?: boolean
  voteCount?: number | null
  percent?: number | null
}

export type ApiPollDto = {
  id: string
  question?: string | null
  allowMultiple: boolean
  allowUserOptions: boolean
  hasVoted: boolean
  totalVotes?: number | null
  ownerId?: string | null
  options: ApiPollOptionDto[]
}

/**
 * PollComposer'dan gelen formu, API'nin beklediği `CreatePollDto` şekline çevirir.
 * Boş seçenekler temizlenir; en az 2 dolu seçenek yoksa null döner (validator budaması).
 * Yayın akışı için zorunlu: question alanı doluyu olmalı; yoksa null döner.
 */
export function buildPollSubmission(
  value: { question: string; options: string[]; allowMultiple: boolean; allowUserOptions: boolean },
): EntryPollSubmission | null {
  const options = value.options.map((o) => o.trim()).filter((o) => o.length > 0)
  if (options.length < 2) return null
  const question = value.question?.trim() ?? ""
  if (!question) return null
  return {
    question,
    options,
    allowMultiple: !!value.allowMultiple,
    allowUserOptions: !!value.allowUserOptions,
  }
}

/**
 * Taslak akışı için gevşek payload: yarım doldurulmuş anketler de kaydedilebilsin diye
 * minimum doğrulama uygulanır. Hiç anlamlı veri yoksa (no question + no options) null.
 */
export function buildDraftPollPayload(
  value: { question: string; options: string[]; allowMultiple: boolean; allowUserOptions: boolean } | null,
): EntryPollSubmission | null {
  if (!value) return null
  const options = value.options.map((o) => o.trim()).filter((o) => o.length > 0)
  const question = value.question?.trim() ?? ""
  if (!question && options.length === 0 && !value.allowMultiple && !value.allowUserOptions) {
    return null
  }
  return {
    question,
    // Yarım taslak izinli; opsiyonların boş yer tutucularını silip sıkıştır.
    options: value.options.map((o) => o.trim()),
    allowMultiple: !!value.allowMultiple,
    allowUserOptions: !!value.allowUserOptions,
  }
}

/**
 * Backend'den dönen taslak `Poll` alanını PollComposer state'ine çevirir. Boş veya
 * null ise null döner; en az 2 seçenek olacak şekilde pad'lenir (kullanıcı kolayca
 * editleyebilsin diye).
 */
export function pollFromDraftPayload(
  draftPoll: { question?: string | null; options?: string[] | null; allowMultiple?: boolean; allowUserOptions?: boolean } | null | undefined,
): { question: string; options: string[]; allowMultiple: boolean; allowUserOptions: boolean } | null {
  if (!draftPoll) return null
  const options = Array.isArray(draftPoll.options) ? draftPoll.options.map((o) => String(o ?? "")) : []
  while (options.length < 2) options.push("")
  return {
    question: draftPoll.question ?? "",
    options,
    allowMultiple: !!draftPoll.allowMultiple,
    allowUserOptions: !!draftPoll.allowUserOptions,
  }
}

/**
 * Yayınlanmış entry'nin Poll'undan PollComposer state'i türetir (Edit ekranı için).
 * Yalnızca metin/seçenek listesi/setting'ler kopyalanır; oy verileri ve seçenek ID'leri
 * gizlenir (composer için gerekli değil; backend güncelleme akışı seçenek metinlerini
 * eşleştirip oy almış olanları korur).
 */
export function pollComposerValueFromApiPoll(
  apiPoll: ApiPollDto | null | undefined,
): { question: string; options: string[]; allowMultiple: boolean; allowUserOptions: boolean } | null {
  if (!apiPoll) return null
  const options = (apiPoll.options ?? []).map((o) => o.text)
  while (options.length < 2) options.push("")
  return {
    question: apiPoll.question ?? "",
    options,
    allowMultiple: !!apiPoll.allowMultiple,
    allowUserOptions: !!apiPoll.allowUserOptions,
  }
}
