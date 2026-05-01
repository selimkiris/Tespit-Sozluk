import { Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type StatsCardsSkeletonProps = {
  /** true: istatistik kartları bileşeniyle aynı başlık satırı (Info ikonu yok). */
  compact?: boolean
}

export function StatsCardsSkeleton({ compact = false }: StatsCardsSkeletonProps) {
  const header = compact ? (
    <div className="mb-3 text-sm font-medium text-foreground">Canlı istatistikler</div>
  ) : (
    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
      <Info className="h-4 w-4 text-muted-foreground" />
      Canlı istatistikler
    </div>
  )

  return (
    <section aria-label="Canlı istatistikler" className="mb-10">
      {header}
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card
            key={i}
            className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  <span className="inline-block h-3 w-24 animate-pulse rounded bg-muted" />
                </CardDescription>
                <span className="h-4 w-4 animate-pulse rounded bg-muted" aria-hidden />
              </div>
              <CardTitle className="text-2xl tabular-nums sm:text-3xl">
                <span className="inline-block h-8 w-16 max-w-full animate-pulse rounded bg-muted" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              <span className="inline-block h-3 w-full max-w-[12rem] animate-pulse rounded bg-muted/80" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
