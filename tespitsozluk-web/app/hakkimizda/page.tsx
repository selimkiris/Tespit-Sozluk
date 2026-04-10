import { Suspense } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { AboutStatsSection } from "./about-stats-section"
import { HakkimizdaTabs } from "./hakkimizda-tabs"
import { StatsCardsSkeleton } from "./stats-cards-skeleton"

export default function HakkimizdaPage() {
  return (
    <div className="min-h-screen bg-background pt-14">
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6 lg:py-12">
        <div className="flex flex-col items-start">
          <div className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 md:gap-x-4">
            <Link
              href="/"
              className="inline-flex shrink-0 transition-opacity hover:opacity-80"
            >
              <Logo className="h-14 w-auto md:h-16" />
            </Link>
            <span
              className="select-none text-base font-light text-muted-foreground/55 md:text-lg"
              aria-hidden
            >
              |
            </span>
            <span className="text-base font-medium tracking-tight text-muted-foreground md:text-lg">
              Zihnin Kayda Geçtiği Yer
            </span>
          </div>
          <div className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Hakkımızda
            </h1>
          </div>
        </div>

        <Suspense fallback={<StatsCardsSkeleton />}>
          <AboutStatsSection />
        </Suspense>

        <HakkimizdaTabs />

        <p className="mt-12 text-center text-xs text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            Ana sayfaya dön
          </Link>
        </p>
      </div>
    </div>
  )
}
