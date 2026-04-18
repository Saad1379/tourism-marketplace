import type { Metadata } from "next"
import Link from "next/link"
import { Search, SlidersHorizontal, X, Globe, ArrowRight, Award, TrendingUp } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { TourCard } from "@/components/tour-card"
import { TourFilters } from "@/components/tours/tour-filters"
import { SortSelect, type SortValue } from "@/components/tours/sort-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { getFeaturedCities, getPublicTours } from "@/lib/supabase/queries"
import { getStorageUrl } from "@/lib/utils"
import { buildCityToursPath, buildTourPathFromRecord } from "@/lib/tour-url"
import { BRAND_NAME, BRAND_SITE_URL, toCanonicalUrl } from "@/lib/seo/brand"

type SearchParams = { city?: string; q?: string; language?: string; duration?: string; sort?: SortValue; featured?: string }

function mapTourCardProps(tour: any) {
  const reviewCount = tour.review_count ?? (tour.reviews?.length || 0)
  const averageRating = tour.average_rating ?? (reviewCount > 0 ? tour.reviews?.[0]?.rating || 0 : 0)
  const rawImage = tour.photos?.[0] || tour.images?.[0]
  const imageUrl = typeof rawImage === "string" ? rawImage : rawImage?.url

  return {
    id: tour.id,
    title: tour.title,
    city: tour.city,
    citySlug: tour.city_slug,
    tourSlug: tour.tour_slug,
    duration: tour.duration_minutes ? `${(tour.duration_minutes / 60).toFixed(1)}h` : "1.5h",
    rating: averageRating,
    reviewCount,
    image: getStorageUrl(imageUrl),
    languages: tour.languages || [],
    maxGroupSize: tour.max_capacity || 15,
    guideName: tour.guide?.full_name || "Local Guide",
    guideAvatar: tour.guide?.avatar_url ? getStorageUrl(tour.guide.avatar_url, "avatars") : null,
    guideBio: tour.guide?.bio || null,
    isGuidePro: Boolean(tour.guide?.is_pro || tour.guide?.plan_type === "pro" || tour.plan_type === "pro" || tour.guide_is_pro),
    meetingPoint: tour.meeting_point || null,
    cancellationPolicyShort: tour.cancellation_policy_short || null,
    isNewTour: Boolean(tour.is_new_tour || reviewCount === 0),
    isPremium: tour.is_premium,
    nextAvailableStartTime: tour.next_available_start_time,
    nextAvailableSpots: tour.next_available_spots,
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const city = params.city ? decodeURIComponent(params.city) : ""
  const hasNonCanonicalFilters =
    Boolean(params.q) ||
    Boolean(params.language) ||
    Boolean(params.duration) ||
    Boolean(params.featured) ||
    (params.sort && params.sort !== "recommended")
  const cityTitle = city
    ? city.charAt(0).toUpperCase() + city.slice(1)
    : ""
  const siteUrl = BRAND_SITE_URL

  const title = cityTitle
    ? `Free Walking Tours in ${cityTitle}`
    : "Free Walking Tours by City"
  const description = cityTitle
    ? `Discover free walking tours in ${cityTitle} led by local guides. Book authentic experiences, check schedules, and explore ${cityTitle} like a local.`
    : "Browse free walking tours led by passionate local guides. Find city tours, filter by language or duration, and book your next authentic travel experience."

  const canonicalPath = cityTitle && !hasNonCanonicalFilters
    ? buildCityToursPath(cityTitle)
    : "/tours"
  const canonicalUrl = toCanonicalUrl(canonicalPath)

  const keywords = cityTitle
    ? [
        `free walking tour ${cityTitle}`,
        `walking tours in ${cityTitle}`,
        `${cityTitle} walking tour`,
        `things to do in ${cityTitle}`,
        `${cityTitle} guided tour`,
        `${cityTitle} local guide`,
        `best tours in ${cityTitle}`,
        "free walking tours",
        "tip based tour",
      ]
    : [
        "free walking tours",
        "walking tours by city",
        "local guide tours",
        "book a walking tour",
        "city sightseeing tour",
        "guided walking tours",
        "free tours worldwide",
        "tip based tours",
        "budget travel tours",
      ]

  return {
    title,
    description,
    keywords,
    alternates: { canonical: canonicalPath },
    robots: hasNonCanonicalFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: BRAND_NAME,
      images: [{ url: "/og-tours.jpg", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-tours.jpg"],
    },
  }
}

export default async function ToursPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const initialCity = params.city || ""
  const initialSearch = params.q || ""
  const initialLanguage = params.language || ""
  const initialDuration = params.duration || ""
  const initialFeatured = params.featured === "1"
  const initialSort: SortValue = params.sort === "rating_desc" || params.sort === "reviews_desc" || params.sort === "duration_asc"
    ? params.sort
    : "recommended"

  const hasActiveFilters =
    Boolean(initialCity) ||
    Boolean(initialSearch) ||
    Boolean(initialLanguage) ||
    Boolean(initialDuration) ||
    initialFeatured ||
    initialSort !== "recommended"

  const [allToursRaw, suggestedCities, featuredCandidatesRaw] = await Promise.all([
    getPublicTours({
      city: initialCity,
      q: initialSearch,
      language: initialLanguage,
      duration: initialDuration,
      sort: initialSort,
      limit: 100,
    }),
    getFeaturedCities(4),
    getPublicTours({ limit: 60, sort: "recommended" }),
  ])

  const allTours = initialFeatured ? allToursRaw.filter((tour: any) => tour.is_premium) : allToursRaw
  const featuredCandidates = featuredCandidatesRaw.filter((tour: any) => tour.is_premium)

  const featuredFromFilters = allTours.filter((tour: any) => tour.is_premium).slice(0, 6)
  const featuredGlobal = featuredCandidates.slice(0, 6)
  const featuredTours = hasActiveFilters
    ? (featuredFromFilters.length > 0 ? featuredFromFilters : featuredGlobal)
    : featuredGlobal

  const buildQuery = (overrides: Record<string, string | undefined>) => {
    const qp = new URLSearchParams()
    const next = {
      city: initialCity || undefined,
      q: initialSearch || undefined,
      language: initialLanguage || undefined,
      duration: initialDuration || undefined,
      sort: initialSort !== "recommended" ? initialSort : undefined,
      featured: initialFeatured ? "1" : undefined,
      ...overrides,
    }

    Object.entries(next).forEach(([key, value]) => {
      if (value) qp.set(key, value)
    })
    return qp.toString()
  }

  const activeFilters = [
    initialCity ? `City: ${initialCity}` : null,
    initialSearch ? `Search: "${initialSearch}"` : null,
    initialLanguage ? `Language: ${initialLanguage}` : null,
    initialDuration ? `Duration: ${initialDuration}` : null,
    initialFeatured ? "Featured only" : null,
  ].filter(Boolean) as string[]

  const resultSummary = activeFilters.length > 0
    ? `${allTours.length} tours matching ${activeFilters.join(" · ")}`
    : `${allTours.length} free walking tours available`

  const siteUrl = BRAND_SITE_URL

  const cityCountMap = new Map<string, number>()
  const languageCountMap = new Map<string, number>()

  for (const tour of allTours) {
    if (tour?.city) {
      cityCountMap.set(tour.city, (cityCountMap.get(tour.city) || 0) + 1)
    }

    if (Array.isArray(tour?.languages)) {
      for (const language of tour.languages) {
        if (!language) continue
        languageCountMap.set(language, (languageCountMap.get(language) || 0) + 1)
      }
    }
  }

  const topCityLinks =
    cityCountMap.size > 0
      ? Array.from(cityCountMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }))
      : suggestedCities.slice(0, 8).map((city) => ({ name: city.name, count: city.tours }))

  const topLanguageLinks = Array.from(languageCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  const cityRecommendedTours = (
    initialCity
      ? allTours.filter((tour: any) => (tour.city || "").toLowerCase() === initialCity.toLowerCase())
      : []
  )
    .sort(
      (a: any, b: any) =>
        (b.review_count || 0) - (a.review_count || 0) ||
        Number(b.average_rating || 0) - Number(a.average_rating || 0),
    )
    .slice(0, 6)

  const internalLinkItems = [
    ...topCityLinks.slice(0, 8).map((city) => ({
      name: `Tours in ${city.name}`,
      url: `${siteUrl}${buildCityToursPath(city.name)}`,
    })),
    ...topLanguageLinks.slice(0, 6).map((language) => ({
      name: `${language.name} walking tours`,
      url: `${siteUrl}/tours?language=${encodeURIComponent(language.name)}`,
    })),
  ]

  const internalDiscoverySchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Tour discovery links",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: internalLinkItems.length,
    itemListElement: internalLinkItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  }

  const cityRecommendationsSchema =
    initialCity && cityRecommendedTours.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Recommended tours in ${initialCity}`,
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          numberOfItems: cityRecommendedTours.length,
          itemListElement: cityRecommendedTours.map((tour: any, index: number) => ({
            "@type": "ListItem",
            position: index + 1,
            name: tour.title,
            url: `${siteUrl}${buildTourPathFromRecord(tour)}`,
          })),
        }
      : null

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(internalDiscoverySchema) }} />
      {cityRecommendationsSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityRecommendationsSchema) }} />
      )}

      <main className="public-template-main flex-1">
        <div className="public-hero-section">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="public-template-heading text-3xl font-bold tracking-tight md:text-4xl">
                  {initialCity ? `Tours in ${initialCity}` : "Explore All Tours"}
                </h1>
                <p className="public-template-copy mt-2">{resultSummary}</p>
                {!initialFeatured && featuredTours.length > 0 && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] px-3 py-1 text-xs font-medium text-[color:var(--landing-accent)]">
                    <Award className="h-3.5 w-3.5" />
                    {featuredTours.length} featured listings from boosted guides
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {!initialFeatured && featuredTours.length > 0 && (
                  <Button asChild className="landing-btn-coral rounded-full">
                    <Link href="#featured-listings">
                      View Featured Listings
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button variant="outline" asChild className="rounded-full border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]">
                  <Link href="/become-guide">Become a Guide</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="public-shell-card mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <form action="/tours" method="GET" className="flex w-full max-w-md items-center gap-2">
              {initialCity && <input type="hidden" name="city" value={initialCity} />}
              {initialLanguage && <input type="hidden" name="language" value={initialLanguage} />}
              {initialDuration && <input type="hidden" name="duration" value={initialDuration} />}
              {initialFeatured && <input type="hidden" name="featured" value="1" />}
              {initialSort !== "recommended" && <input type="hidden" name="sort" value={initialSort} />}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  name="q"
                  placeholder="Search tours or cities..."
                  defaultValue={initialSearch}
                  className="pl-10 border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]"
                />
              </div>
              <Button type="submit" variant="outline" className="shrink-0 border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]">
                Search
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <SortSelect value={initialSort} />

              {/* Mobile Filter Button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px]">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <TourFilters />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="public-shell-card-muted mb-8 flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm text-[color:var(--landing-muted)]">Active filters:</span>
            {initialCity && (
              <Link href={`/tours?${buildQuery({ city: undefined })}`}>
                <Badge variant="secondary" className="gap-1 cursor-pointer border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                  City: {initialCity}
                  <X className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {initialSearch && (
              <Link href={`/tours?${buildQuery({ q: undefined })}`}>
                <Badge variant="secondary" className="gap-1 cursor-pointer border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                  Search: "{initialSearch}"
                  <X className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {initialLanguage && (
              <Link href={`/tours?${buildQuery({ language: undefined })}`}>
                <Badge variant="secondary" className="gap-1 cursor-pointer border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                  Lang: {initialLanguage}
                  <X className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {initialDuration && (
              <Link href={`/tours?${buildQuery({ duration: undefined })}`}>
                <Badge variant="secondary" className="gap-1 cursor-pointer border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                  Duration: {initialDuration}
                  <X className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {initialFeatured && (
              <Link href={`/tours?${buildQuery({ featured: undefined })}`}>
                <Badge variant="secondary" className="gap-1 cursor-pointer border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                  Featured only
                  <X className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {initialSort !== "recommended" && (
              <Link href={`/tours?${buildQuery({ sort: undefined })}`}>
                <Badge variant="secondary" className="gap-1 cursor-pointer border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                  Sort: {initialSort}
                  <X className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {(initialCity || initialSearch || initialLanguage || initialDuration || initialFeatured || initialSort !== "recommended") && (
              <Link href="/tours" className="ml-2 text-sm font-medium text-[color:var(--landing-accent)] hover:underline">
                Clear all
              </Link>
            )}
            {(!initialCity && !initialSearch && !initialLanguage && !initialDuration && !initialFeatured && initialSort === "recommended") && (
              <span className="text-sm italic text-[color:var(--landing-muted)]">None</span>
            )}
          </div>

          {!initialFeatured && featuredTours.length > 0 && (
            <section id="featured-listings" className="public-band mb-10 p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="public-template-heading text-2xl font-bold tracking-tight">Featured Listings</h2>
                  <p className="public-template-copy mt-1 text-sm">
                    These tours are currently boosted by guides for extra visibility.
                  </p>
                </div>
                <Button asChild className="landing-btn-coral w-full sm:w-auto">
                  <Link href="/tours">
                    Start Free Booking
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {featuredTours.map((tour: any) => (
                  <TourCard key={`featured-${tour.id}`} {...mapTourCardProps(tour)} />
                ))}
              </div>
            </section>
          )}

          <div className="flex gap-8">
            <aside className="hidden w-64 shrink-0 lg:block">
              <div className="public-shell-card sticky top-24 p-6">
                <h2 className="mb-6 text-lg font-semibold text-[color:var(--landing-ink)]">Filters</h2>
                <TourFilters />
              </div>
            </aside>

            <div className="flex-1">
              <div className="public-shell-card-muted mb-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-[color:var(--landing-ink)]">All Matching Tours</h2>
                    <p className="mt-1 text-sm text-[color:var(--landing-muted)]">
                      Book free now, tip your guide at the end of the tour.
                    </p>
                  </div>
                  <Button asChild className="landing-btn-coral w-full sm:w-auto">
                    <Link href="/tours">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Book a Free Tour
                    </Link>
                  </Button>
                </div>
              </div>

              {allTours.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {allTours?.map((tour: any) => (
                    <TourCard key={tour.id} {...mapTourCardProps(tour)} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Globe className="mb-4 h-16 w-16 text-[color:var(--landing-muted-2)]" />
                  <h3 className="mb-2 text-xl font-semibold text-[color:var(--landing-ink)]">No tours found</h3>
                  <p className="mb-6 text-[color:var(--landing-muted)]">
                    Try adjusting your filters or search for a different destination.
                  </p>
                  <div className="mb-5 flex flex-wrap justify-center gap-2">
                    {suggestedCities.map((city) => (
                      <Link key={city.name} href={buildCityToursPath(city.name)}>
                        <Badge variant="outline" className="cursor-pointer border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                          Try {city.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]">
                    <Link href="/tours">Reset Filters</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <section className="public-shell-card mt-12 p-6 sm:p-8">
            <h2 className="public-template-heading text-2xl font-bold tracking-tight">Explore More Tours</h2>
            <p className="public-template-copy mt-2 text-sm">
              Use these direct links to discover more tours by city and language.
            </p>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">
                Popular City Links
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {topCityLinks.slice(0, 10).map((city) => (
                  <Link key={city.name} href={buildCityToursPath(city.name)}>
                    <Badge variant="outline" className="cursor-pointer border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                      {city.name} ({city.count})
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>

            {topLanguageLinks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">
                  Browse by Language
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topLanguageLinks.map((language) => (
                    <Link key={language.name} href={`/tours?language=${encodeURIComponent(language.name)}`}>
                      <Badge variant="secondary" className="cursor-pointer border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/80">
                        {language.name} ({language.count})
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {initialCity && cityRecommendedTours.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">
                  Recommended in {initialCity}
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {cityRecommendedTours.map((tour: any) => (
                    <Link
                      key={tour.id}
                      href={buildTourPathFromRecord(tour)}
                      className="group flex items-center justify-between rounded-lg border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-2)] px-3 py-2 transition-colors hover:border-[color:var(--landing-border-2)] hover:bg-[color:var(--landing-accent-soft)]"
                    >
                      <span className="line-clamp-1 text-sm font-medium text-[color:var(--landing-ink)] group-hover:text-[color:var(--landing-accent)]">
                        {tour.title}
                      </span>
                      <span className="shrink-0 pl-3 text-xs text-[color:var(--landing-muted)]">
                        {tour.review_count || 0} reviews
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer variant="landingTemplate" />
    </div>
  )
}
