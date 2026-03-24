import { TOPIC_TITLE_MAX_LENGTH } from "@/lib/topic.schema"

/** API / şema için: textarea’daki yumuşak satır sonlarını ve fazla boşlukları tek satıra indirger. */
export function normalizeTopicTitleForApi(raw: string): string {
  return raw.replace(/\r?\n/g, "").replace(/ +/g, " ").trim()
}

const TITLE_WORD_BREAK_LEN = 30
const TITLE_HYPHEN_BREAK_AT = 29

function hyphenateWordToken(token: string): string {
  if (token.length <= TITLE_WORD_BREAK_LEN) return token
  let rest = token
  let out = ""
  while (rest.length > TITLE_WORD_BREAK_LEN) {
    out += rest.slice(0, TITLE_HYPHEN_BREAK_AT) + "-\n"
    rest = rest.slice(TITLE_HYPHEN_BREAK_AT)
  }
  out += rest
  return out
}

function hyphenateLine(line: string): string {
  return line
    .split(/( +)/)
    .map((part) => (/^ +$/.test(part) ? part : hyphenateWordToken(part)))
    .join("")
}

/** Boşluksuz 30+ karakterlik kelimeleri 29. karakterden sonra tire + satır sonu ile böler. */
export function formatTopicTitleInput(value: string): string {
  return value.split("\n").map(hyphenateLine).join("\n")
}

/** Hemceli biçimlendirme + normalize edilmiş uzunluk üst sınırı. */
export function clampTopicTitleRaw(raw: string, maxLen = TOPIC_TITLE_MAX_LENGTH): string {
  let s = formatTopicTitleInput(raw)
  let n = normalizeTopicTitleForApi(s)
  while (n.length > maxLen && s.length > 0) {
    s = s.slice(0, -1)
    s = formatTopicTitleInput(s)
    n = normalizeTopicTitleForApi(s)
  }
  return s
}
