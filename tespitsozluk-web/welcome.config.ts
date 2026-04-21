/**
 * Merkezi hoş geldin / duyuru modal ayarları.
 * `version` değiştiğinde localStorage anahtarı da değişir; böylece yeni içeriği tüm kullanıcılar görür.
 */

import { manifesto } from '@/lib/about.config'

export const welcomeConfig = {
  isActive: true,
  /** Manifesto güncellemesi (önceki: v5) — yeni metin için yükseltildi. */
  version: 'v6',
  maxViews: 5,

  /** localStorage anahtarı: `tespit_welcome_${version}` */
  storageKeyPrefix: 'tespit_welcome',

  title: 'Tespit Sözlük’e hoş geldin',

  content: manifesto,
} as const

export type WelcomeConfig = typeof welcomeConfig

export function getWelcomeStorageKey(version: string): string {
  return `${welcomeConfig.storageKeyPrefix}_${version}`
}
