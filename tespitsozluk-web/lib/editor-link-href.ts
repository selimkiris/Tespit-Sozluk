/**
 * Editör içi tıklanabilir link href'leri — ana sayfa arama ve kullanıcı profili yolları.
 * (Sunucu tarafı topic çözümlemesi yok; tıklanınca arama / profil rotasına gider.)
 */

/** Var olan başlık — ana sayfa `topic` parametresi */
export function hrefForBkzTopicId(topicId: string): string {
  const id = topicId.trim()
  if (!id) return "/"
  return `/?topic=${encodeURIComponent(id)}`
}

/** (bkz: terim) yedek — arama */
export function hrefForBkzTerm(term: string): string {
  const t = term.trim()
  if (!t) return "/"
  return `/?search=${encodeURIComponent(t)}`
}

/**
 * @kullanici — kullanıcı adı path segment olarak (API `UsernameRegex` ile uyumlu karakter seti).
 */
export function hrefForAtUsername(username: string): string {
  const u = username.trim()
  if (!u) return "/"
  return `/user/${encodeURIComponent(u)}`
}
