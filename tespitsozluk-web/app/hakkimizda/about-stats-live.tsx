"use client"

import { useEffect, useState } from "react"
import { BookOpen, FileText, Users } from "lucide-react"
import { getApiUrl, apiFetch } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCardsSkeleton } from "./stats-cards-skeleton"

type StatsPayload = {
  users: number
  topics: number
  entries: number
}

function formatStat(n: number) {
  return n.toLocaleString("tr-TR")
}

export function AboutStatsLive() {
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(getApiUrl("/api/stats"), {
          cache: "no-store",
        })
        if (cancelled) return
        if (!res.ok) {
          setStatsError(true)
          return
        }
        const data = (await res.json()) as Partial<StatsPayload>
        setStats({
          users: Number(data.users) || 0,
          topics: Number(data.topics) || 0,
          entries: Number(data.entries) || 0,
        })
        setStatsError(false)
      } catch {
        if (!cancelled) setStatsError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <StatsCardsSkeleton compact />
  }

  const statCards = [
    {
      key: "users",
      label: "Toplam Üye",
      icon: Users,
      value: stats?.users ?? null,
      hint: "Kayıtlı kullanıcı sayısı",
    },
    {
      key: "topics",
      label: "Toplam Başlık",
      icon: BookOpen,
      value: stats?.topics ?? null,
      hint: "Açılmış başlık sayısı",
    },
    {
      key: "entries",
      label: "Toplam Entry",
      icon: FileText,
      value: stats?.entries ?? null,
      hint: "Yayınlanan entry sayısı",
    },
  ] as const

  return (
    <section aria-label="Canlı istatistikler" className="mb-10">
      <div className="mb-3 text-sm font-medium text-foreground">
        Canlı istatistikler
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((item) => (
          <Card
            key={item.key}
            className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  {item.label}
                </CardDescription>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <CardTitle className="text-2xl tabular-nums sm:text-3xl">
                {statsError ? (
                  <span className="text-base font-normal text-destructive">Veri alınamadı</span>
                ) : (
                  formatStat(item.value ?? 0)
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">{item.hint}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
