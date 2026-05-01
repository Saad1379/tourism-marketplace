import type { Metadata } from "next"
import Link from "next/link"
import { Users, Globe, Heart, Award, ArrowRight, CheckCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getFeaturedCities } from "@/lib/supabase/queries"
import { BRAND_NAME, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn how Touricho started in 2024 and how we connect travelers with local guides through a value-first walking tour marketplace.",
  keywords: [
    "about touricho",
    "walking tour marketplace",
    "local guide platform",
    "travel community",
    "tip-based tours",
  ],
  openGraph: {
    title: withBrandSuffix("About Us"),
    description: "Touricho started in 2024 to make authentic local tours easier to discover and book.",
    url: toCanonicalUrl("/about"),
    siteName: BRAND_NAME,
    type: "website",
  },
  alternates: { canonical: toCanonicalUrl("/about") },
}

const values = [
  {
    icon: Heart,
    title: "Authenticity First",
    description:
      "We prioritize real local perspective over scripted tourism. Every route should feel alive and human.",
  },
  {
    icon: Users,
    title: "Guide Empowerment",
    description:
      "Guides own the quality of their experience and are rewarded directly through tips and repeat reputation.",
  },
  {
    icon: Globe,
    title: "Accessible Travel",
    description: "Travelers can reserve without upfront booking fees and decide value after the experience.",
  },
  {
    icon: Award,
    title: "Quality Through Feedback",
    description: "Verified reviews and guide accountability help keep standards high across every city.",
  },
]

export default async function AboutPage() {
  const featuredCities = await getFeaturedCities(8)
  const cityLabels = featuredCities.map((city) => city.name).filter(Boolean)

  const milestones = [
    { year: "2024", title: "Company Started", description: "Touricho launched with a focused set of city pilots." },
    {
      year: "2025",
      title: "Marketplace Scale",
      description: "Expanded route quality standards and launched small-group tours designed for deeper local context.",
    },
    {
      year: "2026",
      title: "Quality & Trust",
      description: "Focused on consistent guide quality, transparent tipping, and dependable small-group traveler experiences.",
    },
  ]

  return (
    <div className="public-template-page landing-template">
      <Navbar variant="landingTemplate" />

      <section className="public-hero-section py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/10" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-5 border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)]">
              Founded in 2024
            </Badge>
            <h1 className="public-template-heading text-4xl font-bold tracking-tight lg:text-5xl">
              We built Touricho to make local discovery feel personal again.
            </h1>
            <p className="public-template-copy mt-6 text-lg leading-relaxed">
              Touricho started in 2024 as a traveler-and-guide marketplace for authentic city experiences. Our model is
              simple: reserve for free, explore with a local, and tip based on the real value of the tour.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="landing-btn-coral" asChild>
                <Link href="/tours">
                  Explore Tours
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]" asChild>
                <Link href="/become-guide">Become a Guide</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section-soft py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">Max 10</p>
              <p className="mt-2 text-sm text-muted-foreground">Guests per tour</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">Book Free</p>
              <p className="mt-2 text-sm text-muted-foreground">No upfront booking fee</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-secondary">Tip Later</p>
              <p className="mt-2 text-sm text-muted-foreground">Pay based on experience value</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">Small Groups</p>
              <p className="mt-2 text-sm text-muted-foreground">Designed to run with confidence</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <h2 className="public-template-heading text-3xl font-bold">Our Story</h2>
            <p className="public-template-copy mt-4 leading-relaxed">
              We started in 2024 after seeing the same issue again and again: travelers wanted local context, while
              local guides needed a better way to be discovered. Touricho was created to connect both sides with clear
              incentives for quality and trust.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {milestones.map((milestone) => (
              <Card key={milestone.year} className="public-shell-card">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-primary">{milestone.year}</p>
                  <h3 className="mt-2 text-lg font-semibold">{milestone.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{milestone.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section-soft py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-14">
            <h2 className="public-template-heading text-3xl font-bold">Our Values</h2>
            <p className="public-template-copy mt-4">The product decisions we make every day are grounded in these principles.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <Card key={value.title} className="public-shell-card">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="public-shell-card p-8 lg:p-12">
            <div className="flex items-start gap-3 mb-6">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h2 className="public-template-heading text-2xl font-bold">Where we operate</h2>
                <p className="public-template-copy mt-2">
                  Touricho currently serves guides and travelers across a growing set of cities.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {cityLabels.length > 0 ? (
                cityLabels.map((city) => (
                  <Badge key={city} variant="secondary" className="border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)]">
                    {city}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-[color:var(--landing-muted)]">City coverage is expanding continuously.</p>
              )}
            </div>
            <ul className="mt-8 space-y-3">
              {[
                "No booking fee for travelers",
                "Tip-based earnings for guides",
                "Verified review system for trust",
                "Small-group tours designed for reliable starts",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="public-section-soft py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-band p-8 text-center lg:p-16">
            <h2 className="public-template-heading text-3xl font-bold lg:text-4xl">Build your next city experience with us</h2>
            <p className="public-template-copy mt-4 max-w-2xl mx-auto text-lg">
              Whether you're traveling or guiding, Touricho is built to reward authentic, high-quality experiences.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button size="lg" className="landing-btn-coral" asChild>
                <Link href="/tours">Find a Tour</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]"
                asChild
              >
                <Link href="/become-guide">Become a Guide</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer variant="landingTemplate" />
    </div>
  )
}
