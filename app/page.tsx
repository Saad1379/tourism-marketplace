import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle,
  Clock,
  CreditCard,
  Globe,
  MapPin,
  Sparkles,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SearchBar } from "@/components/search-bar"
import { LandingRevealObserver } from "@/components/landing/reveal-observer"
import { getPublicTours, getFeaturedCities, getPublicReviews, getLandingStats } from "@/lib/supabase/queries"
import { buildCityToursPath, buildTourPathFromRecord } from "@/lib/tour-url"
import { BRAND_NAME, BRAND_SITE_URL, toCanonicalUrl } from "@/lib/seo/brand"
import { getStorageUrl } from "@/lib/utils"

const SITE_URL = BRAND_SITE_URL
const HOME_META_DESCRIPTION =
  "Free walking tours in Paris with max 10 guests — no crowds, no booking fee. Explore Montmartre, Notre-Dame & more with a real local. Tip at the end."
const HOME_META_TITLE = "Free Walking Tours in Paris — Book Free, Tip Your Guide"
const HOMEPAGE_TOURIST_ATTRACTION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  name: "Free Walking Tours in Paris",
  description:
    "Tip-based free walking tours in Paris with max 10 guests. Explore Montmartre, Notre-Dame, Le Marais, Latin Quarter and more with local guides.",
  url: toCanonicalUrl("/tours/paris"),
  touristType: "Cultural tourists, first-time visitors, history lovers",
  availableLanguage: ["English", "French"],
}

const HOMEPAGE_FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Are TipWalk walking tours really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. There is no upfront booking fee. You join the tour for free and tip your guide at the end based on the value you received. Most guests tip between €10 and €20 per person.",
      },
    },
    {
      "@type": "Question",
      name: "How much should I tip a walking tour guide in Paris?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There is no fixed rule. Most guests who enjoy the experience tip around €10 to €20 per person. You can pay by cash or card depending on your guide.",
      },
    },
    {
      "@type": "Question",
      name: "How many people are on a TipWalk tour?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "All TipWalk tours have a maximum of 10 guests. This keeps the experience intimate and ensures you can hear your guide, ask questions, and explore at a comfortable pace.",
      },
    },
    {
      "@type": "Question",
      name: "What walking tours are available in Paris?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TipWalk currently offers free walking tours in Montmartre and the City Centre (Île de la Cité, Notre-Dame, Pont Neuf). Tours of the Latin Quarter, Le Marais, and Saint-Germain-des-Prés are coming soon.",
      },
    },
  ],
}

export const metadata: Metadata = {
  title: {
    absolute: HOME_META_TITLE,
  },
  description: HOME_META_DESCRIPTION,
  keywords: [
    "free walking tours",
    "tip based tours",
    "local guides",
    "city tours",
    "Paris walking tour",
    "Rome walking tour",
    "Barcelona walking tour",
    "travel experiences",
    "guided tours",
    "sightseeing",
  ],
  alternates: {
    canonical: toCanonicalUrl("/"),
  },
  openGraph: {
    title: HOME_META_TITLE,
    description: HOME_META_DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND_NAME,
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "TipWalk Free Walking Tours" }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_META_TITLE,
    description: HOME_META_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
}

function compactCount(value: number) {
  if (!value || value <= 0) return "0"
  if (value >= 1000000) return `${Math.round(value / 1000000)}M+`
  if (value >= 1000) return `${Math.round(value / 1000)}K+`
  return `${value}+`
}

function resolveTourImage(tour: any): string {
  const rawImage = tour?.photos?.[0] || tour?.images?.[0]
  const imageUrl = typeof rawImage === "string" ? rawImage : rawImage?.url
  return getStorageUrl(imageUrl)
}

function getHomepageTourImageAlt(tour: any): string {
  const title = String(tour?.title || "").trim()
  const normalizedTitle = title.toLowerCase()

  if (normalizedTitle.includes("montmartre")) {
    return "Montmartre walking tour Paris — Pierre Gendrin local guide"
  }

  if (normalizedTitle.includes("city of lights")) {
    return "City of Lights walking tour Paris — Pont Neuf and Notre-Dame with Charles Afeavo"
  }

  const city = String(tour?.city || "").trim()
  if (title && city) return `${title} free walking tour in ${city}`
  if (title) return title
  return "Featured walking tour on TipWalk"
}

function resolveCityImage(city: any): string {
  const rawImage = city?.image
  if (!rawImage) return "/placeholder.svg"
  if (rawImage.startsWith("/") || rawImage.startsWith("http")) return rawImage
  return getStorageUrl(rawImage)
}

function getHomepageCityImageAlt(city: any): string {
  const cityName = String(city?.name || "").trim()
  if (normalizeCityKey(cityName) === "paris") {
    return "Free walking tours in Paris — Eiffel Tower and city skyline"
  }
  if (cityName) return `Free walking tours in ${cityName}`
  return "Free walking tours by city"
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeCityKey(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function formatTourDuration(durationMinutes: number): string {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return "2 hrs"
  const hours = durationMinutes / 60
  const rounded = Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
  return `${rounded} hrs`
}

function getGuideInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
  return initials || "LG"
}

function getTourLocationLabel(tour: any, cityCountryMap: Map<string, string>): string {
  const city = String(tour?.city || "Local tour").trim()
  const countryFromTour = String(tour?.country || "").trim()
  const countryFromMap = cityCountryMap.get(normalizeCityKey(city)) || ""
  const country = countryFromTour || countryFromMap
  if (!country) return city
  return `${city}, ${country}`
}

export default async function HomePage() {
  const [featuredToursRaw, featuredCities, latestReviewsRaw, landingStats, discoveryTours] = await Promise.all([
    getPublicTours({ limit: 12, sort: "recommended" }),
    getFeaturedCities(5),
    getPublicReviews(6),
    getLandingStats(),
    getPublicTours({ limit: 100, sort: "recommended" }),
  ])

  const featuredTours = (featuredToursRaw || []).slice(0, 6)
  const latestReviews = (latestReviewsRaw || []).slice(0, 3)

  const cityCountMap = new Map<string, number>()
  for (const tour of discoveryTours) {
    const city = String(tour.city || "").trim()
    if (!city) continue
    cityCountMap.set(city, (cityCountMap.get(city) || 0) + 1)
  }

  const topCityLinks = cityCountMap.size > 0
    ? Array.from(cityCountMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 24)
        .map(([name, count]) => ({ name, count }))
    : featuredCities.map((city) => ({ name: city.name, count: city.tours || 0 }))

  const topTourLinks = [...discoveryTours]
    .sort(
      (a: any, b: any) =>
        (b.review_count || 0) - (a.review_count || 0) ||
        Number(b.average_rating || 0) - Number(a.average_rating || 0),
    )
    .slice(0, 16)

  const heroTours = featuredTours.length > 0 ? featuredTours : topTourLinks.slice(0, 3)
  const heroCities = topCityLinks.slice(0, 5)
  const parisSeedTours = topTourLinks
    .filter((tour: any) => normalizeCityKey(String(tour?.city || tour?.city_slug || "")) === "paris")
    .slice(0, 3)
  const crawlPriorityLinks = [
    { label: "All free walking tours", href: "/tours" },
    { label: "Best walking tours in Paris", href: buildCityToursPath("paris") },
    ...parisSeedTours.map((tour: any) => ({
      label: tour.title,
      href: buildTourPathFromRecord(tour),
    })),
  ]
  const cityCountryMap = new Map<string, string>()
  for (const city of featuredCities || []) {
    if (city?.name && city?.country) {
      cityCountryMap.set(normalizeCityKey(String(city.name)), String(city.country))
    }
  }
  for (const tour of discoveryTours || []) {
    const city = String(tour?.city || "").trim()
    const country = String(tour?.country || "").trim()
    if (city && country && !cityCountryMap.has(normalizeCityKey(city))) {
      cityCountryMap.set(normalizeCityKey(city), country)
    }
  }
  const reviewScoreLabel = "5.0"
  const totalReviewCount = Math.max(Number(landingStats?.totalReviews || 0), 0)
  const shouldShowTravelerRatingWidget = totalReviewCount >= 10
  const reviewWidgetLabel = `${reviewScoreLabel} · ${totalReviewCount} reviews`

  const faqItems = [
    {
      question: "Are TipWalk tours really free to book?",
      answer: "Yes. Book free now, tip your guide at the end of the tour based on the value you received.",
    },
    {
      question: "How much should I tip my guide?",
      answer: "There is no fixed rule. Most guests who enjoy the experience tip around EUR 10-EUR 20 per person, but the amount is your choice.",
    },
    {
      question: "Can I tip by card?",
      answer: "Many guides accept digital payments and cash. Payment options are shown on the tour detail page before you reserve.",
    },
    {
      question: "How are guides verified?",
      answer:
        "TipWalk reviews quality signals and community feedback to surface trusted local guides. PRO means a paid plan with extra tools and visibility, not a quality guarantee by itself.",
    },
    {
      question: "Can I book tours in multiple cities?",
      answer: "Yes. You can reserve tours in as many destinations as you want from one account.",
    },
    {
      question: "What if I need to cancel?",
      answer: "Since there is no upfront payment, cancellation is simple. We ask guests to cancel early so other travelers can join.",
    },
    {
      question: "How do I find a free walking tour in Paris?",
      answer:
        "Browse TipWalk's Paris tours, choose your neighbourhood — Montmartre, the City Centre, or the Latin Quarter — pick a date and time, and reserve for free in under 60 seconds. No credit card required. Tip your guide at the end.",
    },
  ]

  const featuredToursSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Featured walking tours",
    numberOfItems: topTourLinks.length,
    itemListElement: topTourLinks.map((tour: any, index: number) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${tour.title} in ${tour.city}`,
      url: `${SITE_URL}${buildTourPathFromRecord(tour)}`,
    })),
  }

  return (
    <div className="landing-template flex min-h-screen flex-col bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
      <Navbar variant="landingTemplate" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_TOURIST_ATTRACTION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_FAQ_JSON_LD) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(featuredToursSchema) }} />

      <main className="flex-1">
        <LandingRevealObserver />

        <section className="landing-hero-glow relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-20">
          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
            <div className="landing-reveal">
              <p className="landing-template-label mb-5">
                <span className="landing-dot-spark inline-block h-2 w-2 rounded-full bg-[color:var(--landing-accent)]" />
                Tip-Based Marketplace · No Booking Fee
              </p>
              <h1 className="landing-template-heading text-4xl leading-[1.04] sm:text-5xl lg:text-6xl">
                Free Walking Tours in Paris — Book Free, Tip Your Guide at the End
              </h1>
              <p className="landing-template-copy mt-6 max-w-xl text-base leading-8 sm:text-lg">
                TipWalk connects travelers with local guides who know every hidden corner of their city.
                Book free now, tip your guide at the end of the tour.
              </p>
              <p className="mt-3 max-w-xl text-sm font-medium text-[color:var(--landing-muted)]">
                Tours are designed to run with small groups, so travelers can book with confidence.
              </p>

              <div className="mt-8 max-w-xl">
                <SearchBar variant="hero" theme="landingTemplate" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--landing-muted-2)]">Popular:</span>
                {heroCities.map((city) => (
                  <Link key={city.name} href={buildCityToursPath(city.name)} className="landing-chip">
                    {city.name}
                  </Link>
                ))}
              </div>

              <nav aria-label="Priority tour links" className="mt-4 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/90 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[color:var(--landing-muted-2)]">
                  Quick links
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {crawlPriorityLinks.map((item) => (
                    <Link
                      key={`${item.label}:${item.href}`}
                      href={item.href}
                      className="inline-flex rounded-full border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--landing-accent)] hover:bg-[color:var(--landing-accent-soft)]/70"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Users, title: "Max 10 Guests", text: "Small-group format on every tour." },
                  { icon: Banknote, title: "Book Free", text: "No upfront booking fee required." },
                  { icon: CreditCard, title: "Tip at the End", text: "Pay based on the value you felt." },
                ].map(({ icon: Icon, title, text }, idx) => (
                  <div key={title} className={idx > 0 ? "landing-reveal landing-reveal-delay-1 landing-card px-4 py-3" : "landing-reveal landing-card px-4 py-3"}>
                    <div className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-4 w-4 text-[color:var(--landing-accent)]" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--landing-ink)]">{title}</p>
                        <p className="mt-0.5 text-xs text-[color:var(--landing-muted)]">{text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-reveal landing-reveal-delay-1">
              <div className="landing-hero-collage relative rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4 shadow-[var(--landing-shadow-lg)]">
                <div className="grid gap-4 sm:grid-cols-[1.08fr_0.92fr]">
                  <Link href={heroTours[0] ? buildTourPathFromRecord(heroTours[0]) : "/tours"} className="landing-media-card relative block min-h-[300px] overflow-hidden rounded-[1.35rem] sm:min-h-[380px]">
                    <Image
                      src={heroTours[0] ? resolveTourImage(heroTours[0]) : "/placeholder.svg"}
                      alt={heroTours[0] ? getHomepageTourImageAlt(heroTours[0]) : "Featured walking tour on TipWalk"}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 46vw"
                      priority
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-black/80">
                        Next available tour
                      </p>
                      <p className="mt-2 line-clamp-2 text-lg font-semibold text-white">{heroTours[0]?.title || "Discover top walking tours"}</p>
                    </div>
                  </Link>

                  <div className="grid gap-4">
                    {heroTours.slice(1, 3).map((tour: any) => (
                      <Link key={tour.id} href={buildTourPathFromRecord(tour)} className="landing-media-card relative block min-h-[182px] overflow-hidden rounded-[1.1rem]">
                        <Image
                          src={resolveTourImage(tour)}
                          alt={getHomepageTourImageAlt(tour)}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 44vw, 22vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="line-clamp-2 text-sm font-semibold text-white">{tour.title}</p>
                          <p className="mt-1 text-xs text-white/85">{tour.city}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {shouldShowTravelerRatingWidget ? (
                  <div className="landing-float-card absolute -bottom-5 left-4 right-4 rounded-2xl border border-[color:var(--landing-border-2)] bg-[color:var(--landing-surface)] p-3 shadow-[var(--landing-shadow-sm)] sm:right-auto sm:w-[280px]">
                    <p className="text-xs uppercase tracking-[0.11em] text-[color:var(--landing-muted-2)]">Traveler rating</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl font-semibold text-[color:var(--landing-ink)]">{reviewScoreLabel}</span>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[color:var(--landing-muted)]">{reviewWidgetLabel}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="landing-bg-soft px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-12 max-w-3xl text-center landing-reveal">
              <p className="landing-template-label">How It Works</p>
              <h2 className="landing-template-heading mt-4 text-3xl sm:text-4xl">Tours without the price tag.</h2>
              <p className="landing-template-copy mt-4 text-base leading-7 sm:text-lg">
                Reserve in seconds, join your local guide, and tip only after the experience.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: Globe,
                  title: "Browse & Reserve",
                  description: "Find your city and lock your place instantly with no upfront payment.",
                  hint: "Booking takes less than 60 seconds.",
                },
                {
                  step: "02",
                  icon: Users,
                  title: "Join Your Guide",
                  description: "Meet at the point shown on the tour and explore with a real local host.",
                  hint: "Local experts with city knowledge.",
                },
                {
                  step: "03",
                  icon: Banknote,
                  title: "Tip at the End",
                  description: "After the tour ends, tip your guide based on the value you received.",
                  hint: "Typical tips are often around EUR 10-EUR 20.",
                },
              ].map(({ step, icon: Icon, title, description, hint }, index) => (
                <article
                  key={step}
                  className={`landing-card landing-reveal relative overflow-hidden p-7 ${index > 0 ? `landing-reveal-delay-${Math.min(index + 1, 4)}` : ""}`}
                >
                  <span className="absolute right-5 top-4 text-5xl font-black text-[color:var(--landing-accent)]/18">{step}</span>
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--landing-accent-soft)]">
                    <Icon className="h-6 w-6 text-[color:var(--landing-accent)]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[color:var(--landing-ink)]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--landing-muted)]">{description}</p>
                  <p className="mt-4 text-xs font-medium text-[color:var(--landing-accent)]">{hint}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4 landing-reveal">
              <div>
                <p className="landing-template-label">Destinations</p>
                <h2 className="landing-template-heading mt-3 text-3xl sm:text-4xl">Explore Popular Cities</h2>
              </div>
              <Button asChild variant="outline" className="rounded-full border-[color:var(--landing-border-2)] bg-transparent hover:bg-[color:var(--landing-accent-soft)]">
                <Link href="/tours">
                  View all cities <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(featuredCities || []).slice(0, 4).map((city, index) => (
                <Link
                  key={city.name}
                  href={buildCityToursPath(city.name)}
                  className={`landing-media-card landing-reveal group relative block min-h-[320px] overflow-hidden rounded-[1.3rem] border border-[color:var(--landing-border)] shadow-[var(--landing-shadow-sm)] ${
                    index > 0 ? `landing-reveal-delay-${Math.min(index + 1, 4)}` : ""
                  }`}
                >
                  <Image
                    src={resolveCityImage(city)}
                    alt={getHomepageCityImageAlt(city)}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-black/80">
                    {city.tours || 0} tours
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/70">{city.country}</p>
                    <p className="mt-1 text-3xl font-semibold text-white">{city.name}</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs text-white/85">
                      Explore tours <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-bg-soft px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl landing-reveal">
            <div className="landing-card p-6 sm:p-8">
              <h2 className="landing-template-heading text-3xl sm:text-4xl">Explore Paris on Foot</h2>
              <p className="landing-template-copy mt-4 max-w-4xl text-base leading-8 sm:text-lg">
                Paris is TipWalk's first city — and the best place to start. Walk Montmartre's cobbled streets with a guide who's lived there for 8 years, or explore the Île de la Cité from Pont Neuf to Notre-Dame with someone who knows every story behind every stone. Choose from free walking tours covering Montmartre, the Latin Quarter, Le Marais, Saint-Germain, and the City Centre. All tours max 10 guests. All free to book — tip your guide at the end based on what it was worth to you.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-bg-soft px-4 py-20 sm:px-6 lg:px-8" id="featured-tours">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4 landing-reveal">
              <div>
                <p className="landing-template-label">Featured Tours</p>
                <h2 className="landing-template-heading mt-3 text-3xl sm:text-4xl">Handpicked Top Rated Experiences</h2>
                <p className="landing-template-copy mt-3 max-w-2xl text-base leading-7">
                  Curated tip-based tours with verified local guides. Book free now, tip your guide at the end of the tour by cash or card.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-full border-[color:var(--landing-border-2)] bg-transparent hover:bg-[color:var(--landing-accent-soft)]">
                <Link href="/tours">
                  See all tours <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredTours.map((tour: any, index: number) => {
                const reviewCount = Number(tour.review_count || 0)
                const hasReviews = reviewCount > 0
                const ratingLabel = hasReviews ? Number(tour.average_rating || 0).toFixed(1) : "New"
                const durationLabel = formatTourDuration(Number(tour.duration_minutes || 0))
                const languageLabel = Array.isArray(tour.languages) && tour.languages.length > 0
                  ? tour.languages
                      .slice(0, 2)
                      .map((language: unknown) => toTitleCase(String(language || "")))
                      .filter(Boolean)
                      .join(", ")
                  : "English"
                const guideName = String(tour.guide?.full_name || "Local Guide")
                const guideAvatar = tour.guide?.avatar_url ? getStorageUrl(tour.guide.avatar_url, "avatars") : null
                const guideRatingRaw = Number(tour.guide?.guide_rating || 0)
                const guideReviewCountRaw = Number(tour.guide?.guide_total_reviews || 0)
                const guideReviewCount = guideReviewCountRaw > 0 ? guideReviewCountRaw : reviewCount
                const guideRating = guideReviewCountRaw > 0 && guideRatingRaw > 0
                  ? guideRatingRaw.toFixed(1)
                  : hasReviews
                    ? Number(tour.average_rating || 0).toFixed(1)
                    : null
                const locationLabel = getTourLocationLabel(tour, cityCountryMap)

                return (
                  <article
                    key={tour.id}
                    className={`landing-card landing-tour-card landing-reveal overflow-hidden rounded-[1.75rem] border-[color:var(--landing-border-2)] ${index > 0 ? `landing-reveal-delay-${Math.min(index + 1, 4)}` : ""}`}
                  >
                    <Link href={buildTourPathFromRecord(tour)} className="landing-media-card relative block aspect-[16/10]">
                      <Image
                        src={resolveTourImage(tour)}
                        alt={getHomepageTourImageAlt(tour)}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-black/85">
                          <Star className="h-3.5 w-3.5 fill-[#f5b94c] text-[#f5b94c]" />
                          {hasReviews ? `${ratingLabel} (${reviewCount})` : "New tour"}
                        </span>
                        <span className="rounded-full bg-[color:var(--landing-accent)]/95 px-3 py-1 text-xs font-semibold text-white">
                          Tip-based
                        </span>
                      </div>
                    </Link>

                    <div className="p-5">
                      <p className="inline-flex max-w-full items-center gap-1 rounded-full bg-[color:var(--landing-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--landing-accent)]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{locationLabel}</span>
                      </p>
                      <Link href={buildTourPathFromRecord(tour)} className="mt-3 line-clamp-2 block text-3xl font-semibold leading-tight text-[color:var(--landing-ink)] hover:text-[color:var(--landing-accent)] sm:text-[2rem]">
                        {tour.title}
                      </Link>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--landing-muted)]">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {durationLabel}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Max {tour.max_capacity || 10}</span>
                        <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {languageLabel}</span>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--landing-border)] pt-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {guideAvatar ? (
                            <Image
                              src={guideAvatar}
                              alt={guideName}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--landing-accent-soft)] text-xs font-semibold text-[color:var(--landing-accent)]">
                              {getGuideInitials(guideName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-[color:var(--landing-ink)]">{guideName}</p>
                            <p className="truncate text-xs text-[color:var(--landing-muted)]">
                              {guideRating && guideReviewCount > 0 ? `★ ${guideRating} · ${guideReviewCount} reviews` : "Trusted local guide"}
                            </p>
                          </div>
                        </div>
                        {(tour.guide?.is_pro || tour.guide?.plan_type === "pro") && (
                          <span className="rounded-full border border-[#f2d9ab] bg-[#fff4d8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#a8751f] dark:border-[#9a7b3f] dark:bg-[#433218] dark:text-[#f7d79d]">
                            PRO
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] landing-reveal">
              <div>
                <p className="landing-template-label">Traveler Reviews</p>
                <h2 className="landing-template-heading mt-3 text-3xl sm:text-4xl">What Travelers Actually Say</h2>
                <p className="landing-template-copy mt-4 max-w-2xl text-base leading-7">
                  Real reviews from guests who have walked with TipWalk guides.
                </p>
              </div>
              {shouldShowTravelerRatingWidget ? (
                <div className="landing-card flex flex-col items-start justify-center p-6 lg:items-end">
                  <p className="text-5xl font-semibold text-[color:var(--landing-ink)]">{reviewScoreLabel}</p>
                  <div className="mt-2 flex gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--landing-muted)]">{reviewWidgetLabel}</p>
                  <Link href="/reviews" className="mt-4 inline-flex items-center text-sm font-medium text-[color:var(--landing-accent)] hover:underline">
                    Read all reviews <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {latestReviews.map((review: any, index: number) => {
                const authorName = review.tourist?.full_name || "Traveler"
                const authorAvatar = review.tourist?.avatar_url ? getStorageUrl(review.tourist.avatar_url, "avatars") : null
                return (
                  <article key={review.id} className={`landing-card landing-reveal p-5 ${index > 0 ? `landing-reveal-delay-${Math.min(index + 1, 4)}` : ""}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {authorAvatar ? (
                          <Image src={authorAvatar} alt={authorName} width={42} height={42} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--landing-accent-soft)] text-xs font-semibold text-[color:var(--landing-accent)]">
                            {getGuideInitials(authorName)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--landing-ink)]">{authorName}</p>
                          <p className="text-xs text-[color:var(--landing-muted)]">{new Date(review.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-[color:var(--landing-accent)]">{Number(review.rating || 0).toFixed(1)}</p>
                    </div>
                    <p className="line-clamp-4 text-sm leading-7 text-[color:var(--landing-muted)]">“{review.content}”</p>
                    <p className="mt-4 text-xs text-[color:var(--landing-muted-2)]">
                      {review.tour?.title || "TipWalk Tour"}
                      {review.tour?.city ? ` · ${review.tour.city}` : ""}
                    </p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="landing-reveal relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--landing-accent),#d35436)] p-8 shadow-[var(--landing-shadow-lg)] sm:p-12">
              <div className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-white/10" />
              <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-black/10" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_1fr]">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    For Guides
                  </p>
                  <h2 className="mt-4 text-4xl font-serif font-bold leading-tight text-white">
                    Your city is your product.
                    <span className="block italic">Start earning tips today.</span>
                  </h2>
                </div>
                <div>
                  <p className="text-base leading-8 text-white/90">
                    List your tours, reach travelers from around the world, and keep every cent of what you earn.
                    No hidden cuts, no commission surprises.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button asChild className="rounded-full bg-white text-black hover:bg-white/90">
                      <Link href="/become-guide">Become a Guide <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full border-white/45 bg-transparent text-white hover:bg-white/10">
                      <Link href="/how-it-works">How It Works</Link>
                    </Button>
                  </div>
                  <div className="mt-6 grid gap-2 text-sm text-white/90 sm:grid-cols-2">
                    <p className="inline-flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Verified guides only</p>
                    <p className="inline-flex items-center gap-2"><Banknote className="h-4 w-4" /> Keep 100% of your tips</p>
                    <p className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Set your own schedule</p>
                    <p className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> PRO tools for visibility</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-bg-soft px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
            <div className="landing-reveal">
              <p className="landing-template-label">FAQ</p>
              <h2 className="landing-template-heading mt-3 text-3xl sm:text-4xl">Questions Travelers Ask Most</h2>
              <div className="mt-6 space-y-3">
                {faqItems.map((item, index) => (
                  <article
                    key={item.question}
                    className={`landing-card p-4 ${index > 0 ? "landing-reveal landing-reveal-delay-1" : "landing-reveal"}`}
                  >
                    <h3 className="text-sm font-semibold text-[color:var(--landing-ink)]">{item.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">{item.answer}</p>
                  </article>
                ))}
              </div>
              <Button asChild variant="outline" className="mt-6 rounded-full border-[color:var(--landing-border-2)] bg-transparent hover:bg-[color:var(--landing-accent-soft)]">
                <Link href="/faq">Read Full FAQ</Link>
              </Button>
            </div>

            <div className="landing-reveal landing-reveal-delay-1">
              <p className="landing-template-label">Plan Better</p>
              <h2 className="landing-template-heading mt-3 text-3xl sm:text-4xl">Travel Guides & Helpful Resources</h2>
              <p className="landing-template-copy mt-4 text-base leading-7">
                Use these resources to compare tours, understand how tip-based booking works, and prepare for your next city experience.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  { href: "/how-it-works", title: "How TipWalk Works", description: "Booking flow, tipping model, and what to expect." },
                  { href: "/reviews", title: "Traveler Reviews", description: "Recent ratings and real experiences from guests." },
                  { href: "/guide-resources", title: "Guide Resources", description: "Insights and standards for quality local tours." },
                  { href: "/about", title: "About TipWalk", description: "Our mission and how the marketplace supports guides." },
                ].map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`landing-card flex items-center justify-between gap-4 p-4 ${index > 0 ? "landing-reveal landing-reveal-delay-2" : "landing-reveal"}`}
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-[color:var(--landing-ink)]">{item.title}</h3>
                      <p className="mt-1 text-sm text-[color:var(--landing-muted)]">{item.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--landing-accent)]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="landing-reveal mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-7 shadow-[var(--landing-shadow-md)] lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-10">
            <div>
              <p className="landing-template-label">Stay Curious</p>
              <h2 className="landing-template-heading mt-3 text-3xl sm:text-4xl">
                Travel better with city insights.
              </h2>
              <p className="landing-template-copy mt-3 max-w-xl text-base leading-7">
                Get new tour launches, destination guides, and useful travel tips. No spam, unsubscribe anytime.
              </p>
            </div>
            <form action="/api/newsletter" method="POST" className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="email"
                name="email"
                required
                aria-label="Email address"
                placeholder="Your email address"
                className="h-12 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-2)] px-4 text-sm text-[color:var(--landing-ink)] placeholder:text-[color:var(--landing-muted-2)]"
              />
              <input type="hidden" name="source" value="homepage_newsletter" />
              <button type="submit" className="landing-btn-coral h-12 px-6 text-sm font-semibold">
                Subscribe
              </button>
              <p className="sm:col-span-2 text-xs text-[color:var(--landing-muted-2)]">By subscribing, you agree to our Privacy Policy.</p>
            </form>
          </div>
        </section>
      </main>

      <Footer variant="landingTemplate" />
    </div>
  )
}
