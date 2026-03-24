import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hakkımızda | Tespit Sözlük",
  description: "Tespit Sözlük hakkında bilgi, kurallar, iletişim ve güncelleme notları.",
}

export default function HakkimizdaLayout({ children }: { children: React.ReactNode }) {
  return children
}
