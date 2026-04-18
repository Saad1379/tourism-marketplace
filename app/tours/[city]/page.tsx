import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { TourCard } from "@/components/tour-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buildCityMetaDescription, toTitleCaseLabel } from "@/lib/seo/metadata"
import { BRAND_NAME, BRAND_SITE_URL, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"
import {
  getCitySeoPageData,
  getPublishedCitySlugs,
  getTourCanonicalById,
} from "@/lib/supabase/queries"
import {
  buildCanonicalTourPath,
  buildCityToursPath,
  buildTourPathFromRecord,
  extractTourIdFromParam,
  resolveCitySlug,
} from "@/lib/tour-url"
import { getStorageUrl } from "@/lib/utils"

export const revalidate = 1800
export const dynamicParams = true

type PageProps = {
  params: Promise<{ city: string }>
}

const EMPTY_CITY_REDIRECT_SLUGS = new Set(["paris", "rome", "barcelona", "london", "amsterdam", "prague"])

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
    isGuidePro: Boolean(tour.guide?.is_pro || tour.guide?.plan_type === "pro"),
    meetingPoint: tour.meeting_point || null,
    cancellationPolicyShort: tour.cancellation_policy_short || null,
    isNewTour: Boolean(tour.is_new_tour || reviewCount === 0),
    isPremium: Boolean(tour.is_premium),
    nextAvailableStartTime: tour.next_available_start_time,
    nextAvailableSpots: tour.next_available_spots,
  }
}

function splitLongText(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export async function generateStaticParams() {
  const citySlugs = await getPublishedCitySlugs(2000)
  return citySlugs.map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: rawCity } = await params
  const normalizedRequestedCity = resolveCitySlug(rawCity)
  const legacyTourId = extractTourIdFromParam(rawCity)
  if (legacyTourId) {
    const canonicalTour = await getTourCanonicalById(legacyTourId)
    if (canonicalTour) {
        const canonicalPath = buildCanonicalTourPath(canonicalTour.city_slug, canonicalTour.tour_slug)
        return {
          title: {
            absolute: withBrandSuffix(canonicalTour.title),
          },
          description: `Redirecting to ${canonicalTour.title}.`,
          alternates: { canonical: toCanonicalUrl(canonicalPath) },
          robots: { index: false, follow: true },
        }
      }
  }

  const cityData = await getCitySeoPageData(rawCity)
  if (!cityData) {
    if (EMPTY_CITY_REDIRECT_SLUGS.has(normalizedRequestedCity)) {
      return {
        title: {
          absolute: withBrandSuffix("Free Walking Tours by City"),
        },
        description: "Discover free walking tours with verified local guides. Reserve free and tip at the end.",
        alternates: { canonical: toCanonicalUrl("/tours") },
        robots: { index: false, follow: true },
      }
    }

    return {
      title: {
        absolute: withBrandSuffix("Page Not Found"),
      },
      description: "Discover free walking tours with verified local guides. Reserve free and tip at the end.",
      robots: { index: false, follow: false },
    }
  }

  const cityName = toTitleCaseLabel(cityData.cityName) || cityData.cityName
  const canonicalPath = buildCityToursPath(cityData.citySlug)
  const canonicalUrl = toCanonicalUrl(canonicalPath)
  const description = buildCityMetaDescription(cityName, cityData.description)
  const title = withBrandSuffix(`Best Walking Tours in ${cityName}`)

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true },
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

export default async function CityToursPage({ params }: PageProps) {
  const { city: rawCity } = await params
  const normalizedRequestedCity = resolveCitySlug(rawCity)

  // Preserve legacy one-segment URLs by redirecting old slug/uuid tour paths.
  const legacyTourId = extractTourIdFromParam(rawCity)
  if (legacyTourId) {
    const canonicalTour = await getTourCanonicalById(legacyTourId)
    if (canonicalTour) {
      permanentRedirect(buildCanonicalTourPath(canonicalTour.city_slug, canonicalTour.tour_slug))
    }
  }

  const cityData = await getCitySeoPageData(rawCity)
  if (!cityData) {
    if (EMPTY_CITY_REDIRECT_SLUGS.has(normalizedRequestedCity)) {
      permanentRedirect("/tours")
    }
    notFound()
  }

  if (normalizedRequestedCity !== cityData.citySlug) {
    permanentRedirect(buildCityToursPath(cityData.citySlug))
  }

  const siteUrl = BRAND_SITE_URL
  const cityDisplayName = toTitleCaseLabel(cityData.cityName) || cityData.cityName
  const cityDescriptionParagraphs = splitLongText(cityData.description)
  const isParisCity = cityData.citySlug === "paris"
  const heroSubtitle = isParisCity
    ? "Compare top-rated free walking tours in Paris. Reserve in seconds and tip your guide at the end."
    : `Compare top-rated free walking tours in ${cityDisplayName}. Reserve in seconds and tip your guide at the end.`
  const cityDiscoveryHighlights = [
    `Reserve for free and tip your guide at the end based on your experience.`,
    `Adults are 15 or older. Children are under 15.`,
    `Cancel early if plans change so other travelers can take your seat.`,
  ]
  const cityFaqItems = [
    {
      question: `How do free walking tours in ${cityDisplayName} work?`,
      answer: `Reservation is free. Join your guide in ${cityDisplayName} and tip at the end based on the value you received.`,
    },
    {
      question: `Where do tours in ${cityDisplayName} usually start?`,
      answer:
        "Each tour page includes the exact meeting point and practical arrival details before you confirm your reservation.",
    },
    {
      question: "Can I cancel my booking?",
      answer: "Yes. If your plans change, cancel early so other travelers can take your seat.",
    },
  ]
  const parisEditorialSections = [
    {
      heading: "How Free Walking Tours in Paris Work",
      paragraphs: [
        "TipWalk reservations are free, so guests can compare routes and reserve without upfront payment. After the tour, you tip your guide in cash or by card based on how useful, engaging, and practical the experience felt.",
        "This model helps travelers test a route with low risk while still rewarding excellent guides. It also means guides focus on value: clear storytelling, local recommendations, and strong group pacing from the first stop to the final stop.",
      ],
      bullets: [
        "Reserve for free and confirm your slot before arriving.",
        "Meet your guide at the exact meeting point shown on each tour page.",
        "Tip at the end based on your experience and your budget.",
      ],
    },
    {
      heading: "Best Paris Areas to Explore on Foot",
      paragraphs: [
        "The Marais works well for travelers who want medieval lanes, elegant architecture, and a mix of classic landmarks with modern local life. Montmartre is best for hilltop views, art history, and dramatic storytelling around Parisian bohemian culture.",
        "If you prefer major historical context, routes around Ile de la Cite and the Latin Quarter provide strong introductions to Paris foundations, cathedral history, and the Seine river corridor. These districts are also practical for first-time visitors because they connect easily to metro lines and central neighborhoods.",
      ],
      bullets: [
        "Marais: layered history, hidden courtyards, and local food stops.",
        "Montmartre: panoramic views, artists, and hill routes.",
        "Latin Quarter and Ile de la Cite: classic first-time Paris orientation.",
      ],
    },
    {
      heading: "Practical Planning Before You Reserve",
      paragraphs: [
        "Choose your tour by start time, language, and walking duration. Spring and early fall are generally the easiest seasons for long walks, while summer afternoons can be hot and crowded around major landmarks.",
        "Wear comfortable shoes, carry water, and arrive 10 to 15 minutes early so the group can leave on time. Always check meeting-point instructions and cancellation details before booking, especially when your schedule is tight.",
      ],
      bullets: [
        "Adults are 15 or older. Children are under 15.",
        "Bring weather-ready layers and comfortable footwear.",
        "Cancel early if your plans change so others can take your seat.",
      ],
    },
  ]
  const parisResourceLinks = [
    { href: "/guides/paris/best-neighborhood-walking-routes", label: "Best Neighborhood Walking Routes in Paris" },
    { href: "/guides/paris/first-time-free-walking-tour-tips", label: "First-Time Free Walking Tour Tips for Paris" },
    { href: "/guides/paris/what-to-expect-tip-based-tours", label: "What to Expect on Tip-Based Tours in Paris" },
  ]
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Best Walking Tours in ${cityDisplayName}`,
    numberOfItems: cityData.tours.length,
    itemListElement: cityData.tours.map((tour: any, index: number) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tour.title,
      url: `${siteUrl}${buildTourPathFromRecord(tour)}`,
    })),
  }
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cityFaqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className="public-template-main flex-1">
        <section className="public-hero-section">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <Badge className="mb-4 border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]" variant="secondary">City Guide</Badge>
            <h1 className="public-template-heading text-3xl font-bold tracking-tight md:text-4xl">
              Best Walking Tours in {cityDisplayName}
            </h1>
            <p className="public-template-copy mt-4 max-w-3xl">
              {heroSubtitle}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="landing-btn-coral">
                <Link href="/tours">Browse All Cities</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="public-shell-card-muted mb-6 p-5">
              <h2 className="text-xl font-semibold text-[color:var(--landing-ink)]">
                {cityData.tours.length} Tour{cityData.tours.length === 1 ? "" : "s"} Available in {cityDisplayName}
              </h2>
            </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {cityData.tours.map((tour: any) => (
              <TourCard key={tour.id} {...mapTourCardProps(tour)} />
            ))}
          </div>
        </section>

        {isParisCity ? (
          <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="public-shell-card p-5">
              <h2 className="text-xl font-semibold text-[color:var(--landing-ink)]">Quick Paris Booking Info</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {cityDiscoveryHighlights.map((item) => (
                  <article key={item} className="rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-2)] p-4">
                    <p className="text-sm leading-7 text-[color:var(--landing-muted)]">{item}</p>
                  </article>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {parisResourceLinks.map((resource) => (
                  <Link
                    key={resource.href}
                    href={resource.href}
                    className="inline-flex rounded-full border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--landing-accent)] transition-colors hover:bg-[color:var(--landing-accent-soft)]/70"
                  >
                    {resource.label}
                  </Link>
                ))}
              </div>

              <details className="mt-5 rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-2)] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[color:var(--landing-accent)]">
                  Read full Paris guide
                </summary>
                <div className="mt-4 space-y-5">
                  {cityDescriptionParagraphs.length > 1 ? (
                    <article>
                      <h3 className="text-base font-semibold text-[color:var(--landing-ink)]">Local context for {cityDisplayName}</h3>
                      {cityDescriptionParagraphs.slice(1).map((paragraph) => (
                        <p key={paragraph} className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                          {paragraph}
                        </p>
                      ))}
                    </article>
                  ) : null}

                  {parisEditorialSections.map((section) => (
                    <article key={section.heading}>
                      <h3 className="text-base font-semibold text-[color:var(--landing-ink)]">{section.heading}</h3>
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                          {paragraph}
                        </p>
                      ))}
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-[color:var(--landing-muted)]">
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </details>
            </div>
          </section>
        ) : null}

        <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="public-shell-card p-5">
            <h2 className="text-xl font-semibold text-[color:var(--landing-ink)]">Before You Reserve</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {cityFaqItems.map((item) => (
                <article key={item.question} className="rounded-xl border border-[color:var(--landing-border)] p-4">
                  <h3 className="text-sm font-semibold text-[color:var(--landing-ink)]">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="public-shell-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">
              Explore More in {cityDisplayName}
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {cityData.tours.slice(0, 6).map((tour: any) => (
                <li key={tour.id}>
                  <Link
                    href={buildTourPathFromRecord(tour)}
                    className="inline-flex rounded-md px-2 py-1 text-sm font-medium text-[color:var(--landing-accent)] transition-colors hover:bg-[color:var(--landing-accent-soft)] hover:no-underline"
                  >
                    {tour.title}
                  </Link>
                </li>
              ))}
            </ul>
            {cityData.tours.length > 6 ? (
              <details className="mt-3 rounded-lg border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-2)] p-3">
                <summary className="cursor-pointer text-sm font-medium text-[color:var(--landing-accent)]">
                  View all {cityData.tours.length} tour links
                </summary>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {cityData.tours.slice(6).map((tour: any) => (
                    <li key={tour.id}>
                      <Link
                        href={buildTourPathFromRecord(tour)}
                        className="inline-flex rounded-md px-2 py-1 text-sm font-medium text-[color:var(--landing-accent)] transition-colors hover:bg-[color:var(--landing-accent-soft)] hover:no-underline"
                      >
                        {tour.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </section>
      </main>

      <Footer variant="landingTemplate" />
    </div>
  )
}
