import type { Metadata } from "next"
import { Suspense } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CarCard } from "@/components/cars/car-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Car, Search } from "lucide-react"

export const metadata: Metadata = {
  title: "Rent a Car | Touricho",
  description:
    "Browse and book cars from trusted local sellers. Find the perfect vehicle for your trip.",
}

async function fetchCars(params: {
  city_slug?: string
  q?: string
  transmission?: string
}) {
  try {
    const url = new URL("/api/cars", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    if (params.city_slug) url.searchParams.set("city_slug", params.city_slug)
    if (params.q) url.searchParams.set("q", params.q)
    if (params.transmission) url.searchParams.set("transmission", params.transmission)
    url.searchParams.set("limit", "24")

    const res = await fetch(url.toString(), { next: { revalidate: 60 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedParams = await searchParams
  const q = typeof resolvedParams.q === "string" ? resolvedParams.q : undefined
  const citySlug = typeof resolvedParams.city === "string" ? resolvedParams.city : undefined
  const transmission =
    typeof resolvedParams.transmission === "string" ? resolvedParams.transmission : undefined

  const cars = await fetchCars({ city_slug: citySlug, q, transmission })

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-background border-b border-border/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-2xl bg-primary/10 p-4">
                <Car className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
              Rent a Car
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Find the perfect vehicle from trusted local sellers. Browse by city and book instantly.
            </p>
          </div>
        </section>

        {/* Filters + Results */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          {/* Simple search form */}
          <form method="get" className="flex gap-3 mb-8">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search cars..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              name="transmission"
              defaultValue={transmission ?? ""}
              className="px-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All transmissions</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Results */}
          {cars.length === 0 ? (
            <div className="text-center py-24">
              <Car className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No cars available yet</h2>
              <p className="text-muted-foreground">
                Check back soon — sellers are adding new listings every day.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                {cars.length} car{cars.length !== 1 ? "s" : ""} available
              </p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cars.map((car: any) => (
                  <CarCard key={car.id} car={car} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
