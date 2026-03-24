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
          <Link
            href="/"
            className="mb-10 inline-block transition-opacity hover:opacity-80"
          >
            <Logo className="h-14 w-auto md:h-16" />
          </Link>
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
