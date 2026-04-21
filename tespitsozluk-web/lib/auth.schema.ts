import { z } from "zod"
import { nicknameFieldSchema } from "@/lib/nickname.schema"

/** Backend ile aynı metin — hata eşlemesi için */
export const REGISTER_NICK_TAKEN_MESSAGE =
  "Bu mahlas zaten seçilmiş, başka bir tane bul"

export const REGISTER_EMAIL_TAKEN_MESSAGE =
  "Bu e-posta adresi başka bir kullanıcı tarafından alınmış, senin haberin yok muydu?"

/** Backend ReservedUsernames.ReservedMessage ile aynı */
export const REGISTER_RESERVED_USERNAME_MESSAGE =
  "Bu mahlas sistem tarafından rezerve edilmiştir ve alınamaz."

const passwordField = z
  .string()
  .min(1, "Şifre gerekli")
  .refine((s) => s.length >= 8 && /[A-Z]/.test(s) && /\d/.test(s), {
    message:
      "Parolanız en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir.",
  })

const registerAgeField = z
  .number({
    required_error: "Lütfen yaşınızı seçin",
    invalid_type_error: "Lütfen yaşınızı seçin",
  })
  .int("Geçerli bir yaş seçin")
  .min(13, "Yaş 13 ile 99 arasında olmalıdır")
  .max(99, "Yaş 13 ile 99 arasında olmalıdır")
  .refine((n) => n >= 18, {
    message:
      "Tespit Sözlük'e kayıt olabilmek için 18 yaş ve üzerinde olmalısınız.",
  })

export const registerFormSchema = z
  .object({
    nickname: nicknameFieldSchema,
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    age: registerAgeField,
    password: passwordField,
    confirmPassword: z.string().min(1, "Şifre tekrarı gerekli"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>
