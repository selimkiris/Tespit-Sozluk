import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hakkımızda | Tespit Sözlük",
  description: "Tespit Sözlük hakkında bilgi, anayasa ve iletişim.",
}

export default function HakkimizdaLayout({ children }: { children: React.ReactNode }) {
  return children
}
