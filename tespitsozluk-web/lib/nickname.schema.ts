import { z } from "zod"

/** Kayıt ve ayarlar (nickname) için ortak kurallar */
export const nicknameFieldSchema = z
  .string()
  .trim()
  .min(3, "Nickname en az 3 karakter olmalıdır.")
  .max(20, "Nickname en fazla 20 karakter olabilir.")
  .regex(/^\S+$/, "Nickname içinde boşluk bırakılamaz.")

export function validateNicknameTrimmed(trimmed: string): string | null {
  const r = nicknameFieldSchema.safeParse(trimmed)
  if (!r.success) return r.error.issues[0]?.message ?? "Geçersiz nickname."
  return null
}
