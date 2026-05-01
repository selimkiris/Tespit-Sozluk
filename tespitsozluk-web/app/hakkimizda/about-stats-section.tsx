"use client"

import dynamic from "next/dynamic"
import { StatsCardsSkeleton } from "./stats-cards-skeleton"

const AboutStatsLive = dynamic(
  () =>
    import("./about-stats-live").then((module) => ({ default: module.AboutStatsLive })),
  {
    ssr: false,
    loading: () => <StatsCardsSkeleton compact />,
  },
)

/** İstatistikler yalnızca istemcide yüklenir; bayat SSR sayıları ve auth tutarsızlığı flickeri önlenir. */
export function AboutStatsSection() {
  return <AboutStatsLive />
}
