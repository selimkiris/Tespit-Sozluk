import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mesajlar | Tespit Sözlük",
  description: "Sohbetleriniz: kullanıcılar arası özel mesajlar.",
}

export default function MesajlarLayout({ children }: { children: React.ReactNode }) {
  return children
}
