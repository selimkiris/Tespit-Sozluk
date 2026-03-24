import { z } from "zod"

/** Başlık oluşturma / düzenleme için tek kaynak (UI maxLength ve API ile uyumlu). */
export const TOPIC_TITLE_MAX_LENGTH = 60

export const topicTitleSchema = z
  .string()
  .trim()
  .min(1, "Başlık boş olamaz.")
  .max(TOPIC_TITLE_MAX_LENGTH, "Başlık en fazla 60 karakter olabilir.")
