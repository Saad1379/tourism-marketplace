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
  ShieldCheck,
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
      name: "Are Touricho walking tours really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. There is no upfront booking fee. You join the tour for free and tip your guide at the end based on the value you received.",
      },
    },
    {
      "@type": "Question",
      name: "How much should I tip a walking tour guide in Paris?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most guests tip around €10–€20 per person. You can pay by cash or card depending on your guide.",
      },
    },
    {
      "@type": "Question",
      name: "How many people are on a Touricho tour?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "All Touricho tours have a maximum of 10 guests for an intimate, personal experience.",
      },
    },
  ],
}

export const metadata: Metadata = {
  title: { absolute: HOME_META_TITLE },
  description: HOME_META_DESCRIPTION,
  keywords: ["free walking tours", "tip based tours", "local guides", "Paris walking tour", "city tours"],
  alternates: { canonical: toCanonicalUrl("/") },
  openGraph: {
    title: HOME_META_TITLE,
    description: HOME_META_DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND_NAME,
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Touricho Free Walking Tours" }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_META_TITLE,
    description: HOME_META_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
}

/* ─── Helpers ───────────────────────────────────────────────── */
function resolveTourImage(tour: any): string {
  const raw = tour?.photos?.[0] || tour?.images?.[0]
  return getStorageUrl(typeof raw === "string" ? raw : raw?.url)
}
function resolveCityImage(city: any): string {
  const raw = city?.image
  if (!raw) return "/placeholder.svg"
  if (raw.startsWith("/") || raw.startsWith("http")) return raw
  return getStorageUrl(raw)
}
function toTitleCase(v: string) {
  return v.replace(/\b\w/g, (c) => c.toUpperCase())
}
function normalizeCityKey(v: string) {
  return String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
function formatTourDuration(mins: number) {
  if (!Number.isFinite(mins) || mins <= 0) return "2 hrs"
  const h = mins / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hrs`
}
function getInitials(name: string) {
  return (
    name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "LG"
  )
}
function getTourLocation(tour: any, map: Map<string, string>) {
  const city = String(tour?.city || "Local tour").trim()
  const country = String(tour?.country || "").trim() || map.get(normalizeCityKey(city)) || ""
  return country ? `${city}, ${country}` : city
}
function getCityAlt(city: any) {
  const n = String(city?.name || "").trim()
  return n ? `Free walking tours in ${n}` : "Free walking tours by city"
}
function getTourAlt(tour: any) {
  const t = String(tour?.title || "").trim()
  const c = String(tour?.city || "").trim()
  if (t && c) return `${t} free walking tour in ${c}`
  return t || "Featured walking tour on Touricho"
}

/* ─── Page ──────────────────────────────────────────────────── */
export default async function HomePage() {
  const [toursRaw, featuredCities, reviewsRaw, landingStats, discoveryTours] = await Promise.all([
    getPublicTours({ limit: 12, sort: "recommended" }),
    getFeaturedCities(),
    getPublicReviews(6),
    getLandingStats(),
    getPublicTours({ limit: 100, sort: "recommended" }),
  ])

  const featuredTours = (toursRaw || []).slice(0, 3)
  const latestReviews = (reviewsRaw || []).slice(0, 3)

  /* City derived data */
  const cityCountMap = new Map<string, number>()
  for (const t of discoveryTours) {
    const c = String(t.city || "").trim()
    if (c) cityCountMap.set(c, (cityCountMap.get(c) || 0) + 1)
  }
  const heroCities = (
    cityCountMap.size > 0
      ? Array.from(cityCountMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => ({ name }))
      : featuredCities.slice(0, 5).map((c) => ({ name: c.name }))
  )
  const destinationCities = featuredCities.slice(0, 7)
  console.log("featuredCities = ", featuredCities)
  /* Country map */
  const cityCountryMap = new Map<string, string>()
  for (const city of featuredCities) {
    if (city?.name && city?.country) cityCountryMap.set(normalizeCityKey(city.name), String(city.country))
  }
  for (const t of discoveryTours) {
    const c = String(t?.city || "").trim()
    const co = String(t?.country || "").trim()
    if (c && co && !cityCountryMap.has(normalizeCityKey(c))) cityCountryMap.set(normalizeCityKey(c), co)
  }

  /* Top tours for SEO */
  const topTourLinks = [...discoveryTours]
    .sort((a: any, b: any) => (b.review_count || 0) - (a.review_count || 0))
    .slice(0, 16)
  const parisSeedTours = topTourLinks
    .filter((t: any) => normalizeCityKey(String(t?.city || "")) === "paris")
    .slice(0, 3)
  const crawlLinks = [
    { label: "All free walking tours", href: "/tours" },
    { label: "Best walking tours in Paris", href: buildCityToursPath("paris") },
    ...parisSeedTours.map((t: any) => ({ label: t.title, href: buildTourPathFromRecord(t) })),
  ]

  /* Stats */
  const totalReviews = Math.max(Number(landingStats?.totalReviews || 0), 0)
  const totalCities = Math.max(cityCountMap.size, featuredCities.length)
  const totalTours = discoveryTours.length
  const totalGuides = new Set(discoveryTours.map((t: any) => t.guide?.id).filter(Boolean)).size
  const reviewScore = "5.0"
  const showRatingWidget = totalReviews >= 10

  /* Hero images */
  const heroBgTour = toursRaw?.[0] || discoveryTours?.[0]
  const heroBgSrc = heroBgTour ? resolveTourImage(heroBgTour) : "/Stonehenge1.jpg"
  const aboutImgA = "/london-cityscape-big-ben.jpg"
  const aboutImgB = "/amsterdam-canal-houses-boats.jpg"

  const featuredToursSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Featured walking tours",
    numberOfItems: topTourLinks.length,
    itemListElement: topTourLinks.map((t: any, i: number) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${t.title} in ${t.city}`,
      url: `${SITE_URL}${buildTourPathFromRecord(t)}`,
    })),
  }

  return (
    <div className="landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_TOURIST_ATTRACTION_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_FAQ_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(featuredToursSchema) }} />

      <main className="flex-1">
        <LandingRevealObserver />

        {/* ══════════════════════════════════════════════════════
            HERO — full-width background image, centred content
        ══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden">
          {/* Background */}
          <Image
            src={heroBgSrc}
            alt="Explore the world with Touricho"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          {/* Gradient overlay — darker at edges, lighter centre */}
          <div className="absolute inset-0 bg-linear-to-b from-black/65 via-black/45 to-black/70" />

          {/* Content */}
          <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e58d4d]/50 bg-[#e58d4d]/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#e58d4d] backdrop-blur-sm">
              Tip-Based · No Booking Fee
            </span>

            <h1 className="mt-5 text-5xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.5rem]">
              Explore the World<br />
              <span className="text-[#e58d4d]">with Local Guides</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
              Book free walking tours in 35+ cities across Europe. Join a local guide, explore hidden gems, and tip at the end based on the value you received.
            </p>

            {/* Search bar */}
            <div className="mx-auto mt-10 max-w-2xl">
              <SearchBar variant="hero" theme="landingTemplate" />
            </div>

            {/* City chips */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.13em] text-white/50 self-center">Popular:</span>
              {heroCities.map((city) => (
                <Link
                  key={city.name}
                  href={buildCityToursPath(city.name)}
                  className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition-all hover:border-[#e58d4d] hover:bg-[#e58d4d] hover:text-white"
                >
                  {city.name}
                </Link>
              ))}
            </div>

            {/* SEO crawl links (visually minimal) */}
            <nav aria-label="Priority tour links" className="mt-8 flex flex-wrap justify-center gap-2">
              {crawlLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/50 transition-colors hover:text-white/80"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            WHO WE ARE — two-column image + text
        ══════════════════════════════════════════════════════ */}
        <section className="overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-14 lg:grid-cols-2">

              {/* Images */}
              <div className="landing-reveal relative flex gap-4">
                {/* Tall left image */}
                <div className="relative mt-10 w-1/2 overflow-hidden rounded-3xl" style={{ aspectRatio: "3/4" }}>
                  <Image src={aboutImgA} alt="Local guide leading a walking tour" fill className="object-cover" sizes="(max-width:1024px)50vw,25vw" />
                </div>
                {/* Shorter right image */}
                <div className="relative w-1/2 self-start overflow-hidden rounded-3xl" style={{ aspectRatio: "3/4" }}>
                  <Image src={aboutImgB} alt="Travelers exploring a city" fill className="object-cover" sizes="(max-width:1024px)50vw,25vw" />
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-6 left-4 rounded-2xl bg-[#0b3884] px-6 py-4 text-center shadow-xl">
                  <p className="text-3xl font-black text-white">35+</p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/70">Cities across Europe</p>
                </div>
              </div>

              {/* Text */}
              <div className="landing-reveal landing-reveal-delay-1">
                <p className="landing-template-label">Who We Are</p>
                <h2 className="mt-4 text-3xl font-bold leading-snug tracking-tight text-(--landing-ink) sm:text-4xl">
                  Experience authentic travel with passionate local guides
                </h2>
                <p className="landing-template-copy mt-5 text-base leading-relaxed">
                  Touricho is a tip-based marketplace connecting curious travelers with local guides who know every corner of their city. No upfront fees — book free, join the tour, and tip your guide at the end based on the experience you had.
                </p>
                <p className="landing-template-copy mt-3 text-base leading-relaxed">
                  Every tour runs with a maximum of 10 guests, keeping the experience intimate and personal. Our guides are passionate locals who share not just sights, but stories.
                </p>

                {/* Mini stats */}
                <div className="mt-8 grid grid-cols-2 gap-5">
                  {[
                    { value: `${totalTours || "100"}+`, label: "Tours available" },
                    { value: `${totalGuides || "50"}+`, label: "Local guides" },
                    { value: `${totalCities || "10"}+`, label: "Cities covered" },
                    { value: totalReviews >= 10 ? `${totalReviews}+` : "5.0 ★", label: totalReviews >= 10 ? "Happy travelers" : "Average rating" },
                  ].map(({ value, label }) => (
                    <div key={label} className="rounded-2xl border border-(--landing-border) bg-(--landing-surface) p-4">
                      <p className="text-2xl font-black text-[#e58d4d]">{value}</p>
                      <p className="mt-0.5 text-sm text-(--landing-muted)">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Button asChild className="rounded-full bg-[#e58d4d] px-7 text-white shadow-lg hover:bg-[#cf7334]">
                    <Link href="/about">Learn More <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            POPULAR DESTINATIONS — 6-card grid
        ══════════════════════════════════════════════════════ */}
        <section className="bg-(--landing-bg-soft) px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 text-center landing-reveal">
              <p className="landing-template-label mx-auto">Popular Destinations</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-(--landing-ink) sm:text-4xl">
                Explore Top Cities
              </h2>
              <p className="landing-template-copy mx-auto mt-4 max-w-xl text-base leading-relaxed">
                From the cobbled streets of Paris to the ancient ruins of Rome — find your next adventure.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {destinationCities.map((city, i) => (
                <Link
                  key={city.name}
                  href={buildCityToursPath(city.name)}
                  className={`landing-reveal group relative block overflow-hidden rounded-3xl shadow-(--landing-shadow-md) ${i > 0 ? `landing-reveal-delay-${Math.min(i, 4)}` : ""}`}
                  style={{ minHeight: 280 }}
                >
                  <Image
                    src={resolveCityImage(city)}
                    alt={getCityAlt(city)}
                    fill
                    sizes="(max-width:640px)100vw,(max-width:1024px)50vw,33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  {/* Tour count badge */}
                  <div className="absolute right-4 top-4 rounded-full bg-[#e58d4d] px-3 py-1 text-xs font-bold text-white shadow">
                    {city.tours || 0} tours
                  </div>
                  {/* Bottom text */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">{city.country}</p>
                    <p className="mt-1 text-2xl font-bold text-white">{city.name}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all group-hover:border-[#e58d4d] group-hover:bg-[#e58d4d]">
                      Explore <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Button asChild variant="outline" className="rounded-full border-(--landing-border-2) px-8 hover:border-[#e58d4d] hover:bg-(--landing-accent-soft) hover:text-[#e58d4d]">
                <Link href="/tours">View All Destinations <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            WHY CHOOSE US — 3 feature cards
        ══════════════════════════════════════════════════════ */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 text-center landing-reveal">
              <p className="landing-template-label mx-auto">Why Choose Us</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-(--landing-ink) sm:text-4xl">
                The Touricho Difference
              </h2>
              <p className="landing-template-copy mx-auto mt-4 max-w-xl text-base leading-relaxed">
                We believe great travel experiences should be accessible to everyone.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: "Small Groups Only",
                  body: "Every tour runs with a maximum of 10 guests. No overcrowded buses — just an intimate, personal experience with a guide who can answer every question.",
                  accent: "Max 10 per tour",
                },
                {
                  icon: Banknote,
                  title: "Free to Book",
                  body: "There is no upfront booking fee. Reserve your spot in under 60 seconds with no credit card required. Pay what you think the experience was worth — at the end.",
                  accent: "No credit card needed",
                },
                {
                  icon: ShieldCheck,
                  title: "Verified Local Guides",
                  body: "Our guides are passionate locals vetted by community feedback. They share not just sights but stories — the kind you won't find in any guidebook.",
                  accent: "Community reviewed",
                },
              ].map(({ icon: Icon, title, body, accent }, i) => (
                <article
                  key={title}
                  className={`landing-reveal landing-card group p-8 text-center ${i > 0 ? `landing-reveal-delay-${i}` : ""}`}
                >
                  {/* Icon circle */}
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b3884] transition-colors duration-300 group-hover:bg-[#e58d4d]">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-(--landing-ink)">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-(--landing-muted)">{body}</p>
                  <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-(--landing-accent-soft) px-3 py-1 text-xs font-bold text-[#e58d4d]">
                    <CheckCircle className="h-3.5 w-3.5" /> {accent}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            STATS BANNER — navy background
        ══════════════════════════════════════════════════════ */}
        <section className="bg-[#0b3884] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
              {[
                { value: `${totalTours || "100"}+`, label: "Tours Available", icon: Globe },
                { value: `${totalGuides || "50"}+`, label: "Local Guides", icon: Users },
                { value: `${totalCities || "10"}+`, label: "Cities Covered", icon: MapPin },
                { value: totalReviews >= 10 ? `${totalReviews}+` : "100%", label: totalReviews >= 10 ? "Happy Travelers" : "Satisfaction Rate", icon: Star },
              ].map(({ value, label, icon: Icon }) => (
                <div key={label} className="landing-reveal">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                    <Icon className="h-5 w-5 text-[#e58d4d]" />
                  </div>
                  <p className="text-4xl font-black text-white">{value}</p>
                  <p className="mt-2 text-sm font-medium uppercase tracking-wider text-white/60">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            FEATURED TOURS — 3-card row
        ══════════════════════════════════════════════════════ */}
        <section className="bg-(--landing-bg-soft) px-4 py-24 sm:px-6 lg:px-8" id="featured-tours">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 text-center landing-reveal">
              <p className="landing-template-label mx-auto">Featured Tours</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-(--landing-ink) sm:text-4xl">
                Handpicked Experiences
              </h2>
              <p className="landing-template-copy mx-auto mt-4 max-w-xl text-base leading-relaxed">
                Curated tip-based tours with verified local guides. Book free, tip at the end.
              </p>
            </div>

            <div className="grid gap-7 md:grid-cols-3">
              {featuredTours.map((tour: any, i: number) => {
                const reviewCount = Number(tour.review_count || 0)
                const hasReviews = reviewCount > 0
                const rating = hasReviews ? Number(tour.average_rating || 0).toFixed(1) : "New"
                const duration = formatTourDuration(Number(tour.duration_minutes || 0))
                const langs = Array.isArray(tour.languages) && tour.languages.length > 0
                  ? tour.languages.slice(0, 2).map((l: any) => toTitleCase(String(l || ""))).filter(Boolean).join(", ")
                  : "English"
                const guide = String(tour.guide?.full_name || "Local Guide")
                const guideAvatar = tour.guide?.avatar_url ? getStorageUrl(tour.guide.avatar_url, "avatars") : null
                const guideRating = Number(tour.guide?.guide_rating || tour.average_rating || 0)
                const location = getTourLocation(tour, cityCountryMap)

                return (
                  <article
                    key={tour.id}
                    className={`landing-reveal landing-card overflow-hidden ${i > 0 ? `landing-reveal-delay-${i}` : ""}`}
                  >
                    {/* Image */}
                    <Link href={buildTourPathFromRecord(tour)} className="relative block overflow-hidden" style={{ aspectRatio: "4/3" }}>
                      <Image
                        src={resolveTourImage(tour)}
                        alt={getTourAlt(tour)}
                        fill
                        sizes="(max-width:640px)100vw,(max-width:1024px)50vw,33vw"
                        className="object-cover transition-transform duration-500 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      {/* Badges */}
                      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-black/80 shadow-sm">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {hasReviews ? `${rating} (${reviewCount})` : "New"}
                        </span>
                        <span className="rounded-full bg-[#e58d4d] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                          Free to book
                        </span>
                      </div>
                    </Link>

                    {/* Body */}
                    <div className="p-6">
                      <p className="inline-flex items-center gap-1 rounded-full bg-(--landing-accent-soft) px-2.5 py-1 text-xs font-bold text-[#e58d4d]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="max-w-40 truncate">{location}</span>
                      </p>

                      <Link
                        href={buildTourPathFromRecord(tour)}
                        className="mt-3 line-clamp-2 block text-xl font-bold leading-snug text-(--landing-ink) transition-colors hover:text-[#e58d4d]"
                      >
                        {tour.title}
                      </Link>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-(--landing-muted)">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{duration}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />Max {tour.max_capacity || 10}</span>
                        <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{langs}</span>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-(--landing-border) pt-4">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {guideAvatar ? (
                            <Image src={guideAvatar} alt={guide} width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--landing-accent-soft) text-xs font-bold text-[#e58d4d]">
                              {getInitials(guide)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-(--landing-ink)">{guide}</p>
                            <p className="text-xs text-(--landing-muted)">
                              {guideRating > 0 ? `★ ${guideRating.toFixed(1)}` : "Trusted local guide"}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={buildTourPathFromRecord(tour)}
                          className="shrink-0 rounded-full bg-[#0b3884] px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#e58d4d]"
                        >
                          Book Free
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="mt-10 text-center">
              <Button asChild variant="outline" className="rounded-full border-(--landing-border-2) px-8 hover:border-[#e58d4d] hover:bg-(--landing-accent-soft) hover:text-[#e58d4d]">
                <Link href="/tours">See All Tours <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            TESTIMONIALS — 3-card row
        ══════════════════════════════════════════════════════ */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 text-center landing-reveal">
              <p className="landing-template-label mx-auto">Testimonials</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-(--landing-ink) sm:text-4xl">
                What Travelers Say
              </h2>
              {showRatingWidget && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <span className="text-3xl font-black text-(--landing-ink)">{reviewScore}</span>
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, idx) => <Star key={idx} className="h-5 w-5 fill-current" />)}
                  </div>
                  <span className="text-sm text-(--landing-muted)">{totalReviews} reviews</span>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {latestReviews.map((review: any, i: number) => {
                const name = review.tourist?.full_name || "Traveler"
                const avatar = review.tourist?.avatar_url ? getStorageUrl(review.tourist.avatar_url, "avatars") : null
                return (
                  <article
                    key={review.id}
                    className={`landing-reveal landing-card p-7 ${i > 0 ? `landing-reveal-delay-${Math.min(i, 4)}` : ""}`}
                  >
                    {/* Stars */}
                    <div className="mb-4 flex gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, idx) => <Star key={idx} className="h-4 w-4 fill-current" />)}
                    </div>
                    {/* Quote */}
                    <p className="line-clamp-4 text-base leading-relaxed text-(--landing-muted)">
                      &ldquo;{review.content}&rdquo;
                    </p>
                    {/* Author */}
                    <div className="mt-6 flex items-center gap-3 border-t border-(--landing-border) pt-5">
                      {avatar ? (
                        <Image src={avatar} alt={name} width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0b3884] text-sm font-bold text-white">
                          {getInitials(name)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-(--landing-ink)">{name}</p>
                        <p className="text-xs text-(--landing-muted)">
                          {review.tour?.title || "Touricho Tour"}{review.tour?.city ? ` · ${review.tour.city}` : ""}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {showRatingWidget && (
              <div className="mt-8 text-center">
                <Link href="/reviews" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#e58d4d] hover:underline">
                  Read all reviews <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            GUIDE CTA — navy, full-width
        ══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#0b3884] px-4 py-24 sm:px-6 lg:px-8">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#e58d4d]/10" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="landing-reveal">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/80">
                  For Guides
                </span>
                <h2 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
                  Your city is<br />
                  <span className="text-[#e58d4d]">your product.</span>
                </h2>
                <p className="mt-4 text-lg font-light italic text-white/70">
                  Start earning tips today.
                </p>
              </div>

              <div className="landing-reveal landing-reveal-delay-1">
                <p className="text-base leading-8 text-white/80">
                  List your tours, reach travelers from around the world, and keep every cent of what you earn. No hidden cuts, no commission surprises. Set your own schedule and grow at your own pace.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Button asChild className="rounded-full bg-[#e58d4d] px-7 py-3 text-white shadow-lg hover:bg-[#cf7334]">
                    <Link href="/become-guide">Become a Guide <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-white/30 bg-transparent px-7 py-3 text-white hover:bg-white/10">
                    <Link href="/how-it-works">How It Works</Link>
                  </Button>
                </div>
                <div className="mt-8 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
                  {[
                    { icon: CheckCircle, text: "Verified guides only" },
                    { icon: Banknote, text: "Keep 100% of your tips" },
                    { icon: CalendarClock, text: "Set your own schedule" },
                    { icon: Sparkles, text: "PRO tools for visibility" },
                  ].map(({ icon: Icon, text }) => (
                    <p key={text} className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#e58d4d]" />{text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            FAQ — two-column
        ══════════════════════════════════════════════════════ */}
        <section className="bg-(--landing-bg-soft) px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center landing-reveal">
              <p className="landing-template-label mx-auto">FAQ</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-(--landing-ink) sm:text-4xl">
                Questions Travelers Ask Most
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {[
                { q: "Are Touricho tours really free to book?", a: "Yes. Book free now, tip your guide at the end based on the value you received. No credit card required." },
                { q: "How much should I tip my guide?", a: "There's no fixed rule. Most guests who enjoy the experience tip around EUR 10–20 per person, but the amount is entirely your choice." },
                { q: "Can I tip by card?", a: "Many guides accept digital payments and cash. Payment options are shown on the tour detail page before you reserve." },
                { q: "How are guides verified?", a: "Touricho reviews quality signals and community feedback to surface trusted local guides. PRO means a paid plan with extra tools." },
                { q: "Can I book tours in multiple cities?", a: "Yes. You can reserve tours in as many destinations as you want from a single account." },
                { q: "What if I need to cancel?", a: "Since there's no upfront payment, cancellation is simple. We ask guests to cancel early so other travelers can take the spot." },
              ].map((item, i) => (
                <article
                  key={item.q}
                  className={`landing-card landing-reveal p-6 ${i > 1 ? "landing-reveal-delay-1" : ""}`}
                >
                  <h3 className="font-bold text-(--landing-ink)">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-(--landing-muted)">{item.a}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Button asChild variant="outline" className="rounded-full border-(--landing-border-2) px-8 hover:border-[#e58d4d] hover:bg-(--landing-accent-soft) hover:text-[#e58d4d]">
                <Link href="/faq">Read Full FAQ <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            NEWSLETTER
        ══════════════════════════════════════════════════════ */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="landing-reveal mx-auto max-w-3xl text-center">
            <p className="landing-template-label mx-auto">Stay Curious</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-(--landing-ink) sm:text-4xl">
              Travel better with city insights.
            </h2>
            <p className="landing-template-copy mx-auto mt-4 max-w-lg text-base leading-relaxed">
              Get new tour launches, destination guides, and useful travel tips. No spam — unsubscribe anytime.
            </p>
            <form action="/api/newsletter" method="POST" className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
              <input
                type="email"
                name="email"
                required
                aria-label="Email address"
                placeholder="Your email address"
                className="h-13 flex-1 rounded-full border border-(--landing-border) bg-(--landing-surface) px-5 text-sm text-(--landing-ink) placeholder:text-(--landing-muted-2) focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e58d4d]"
              />
              <input type="hidden" name="source" value="homepage_newsletter" />
              <button
                type="submit"
                className="landing-btn-coral h-13 shrink-0 rounded-full px-7 text-sm font-bold"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-3 text-xs text-(--landing-muted-2)">By subscribing, you agree to our Privacy Policy.</p>
          </div>
        </section>
      </main>

      <Footer variant="landingTemplate" />
    </div>
  )
}
