import { z } from "zod"
import { nicknameFieldSchema } from "@/lib/nickname.schema"

/** Backend ile aynı metin — hata eşlemesi için */
export const REGISTER_NICK_TAKEN_MESSAGE =
  "Bu nick zaten seçilmiş, başka bir tane bul"

export const REGISTER_EMAIL_TAKEN_MESSAGE =
  "Bu e-posta adresi başka bir kullanıcı tarafından alınmış, senin haberin yok muydu?"

const passwordField = z
  .string()
  .min(1, "Şifre gerekli")
  .refine((s) => s.length >= 8 && /[A-Z]/.test(s) && /\d/.test(s), {
    message:
      "Parolanız en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir.",
  })

export const registerFormSchema = z
  .object({
    nickname: nicknameFieldSchema,
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    password: passwordField,
    confirmPassword: z.string().min(1, "Şifre tekrarı gerekli"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>
