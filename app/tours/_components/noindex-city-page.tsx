import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { buildCityToursPath } from "@/lib/tour-url"

export function buildNoindexCityMetadata(city: string, slug: string): Metadata {
  const cityLabel = city.trim()
  return {
    title: `${cityLabel} Tours Coming Soon | TipWalk`,
    description: `TipWalk is preparing free walking tours in ${cityLabel}. Explore current tours in Paris while we launch this destination.`,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    alternates: {
      canonical: `/tours/${slug}`,
    },
  }
}

export function NoindexCityPage({ city }: { city: string }) {
  return (
    <div className="landing-template flex min-h-screen flex-col bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
      <Navbar variant="landingTemplate" />
      <main className="flex-1 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-8 shadow-[var(--landing-shadow-md)] sm:p-10">
          <p className="landing-template-label">Coming Soon</p>
          <h1 className="landing-template-heading mt-3 text-3xl sm:text-4xl">Free walking tours in {city} are launching soon.</h1>
          <p className="landing-template-copy mt-4 text-base leading-8 sm:text-lg">
            TipWalk is currently focused on Paris. Browse available Paris tours now and reserve for free in under 60 seconds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="landing-btn-coral">
              <Link href={buildCityToursPath("paris")}>
                Explore Paris Tours <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-[color:var(--landing-border-2)] bg-transparent hover:bg-[color:var(--landing-accent-soft)]">
              <Link href="/tours">Browse All Tours</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer variant="landingTemplate" />
    </div>
  )
}
