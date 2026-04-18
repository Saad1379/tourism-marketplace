import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  Search,
  Calendar,
  MapPin,
  Heart,
  Star,
  Users,
  CreditCard,
  CheckCircle,
  ArrowRight,
  Shield,
  Clock,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getFeaturedCities, getPublicTours } from "@/lib/supabase/queries"
import { BRAND_NAME, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"
import { getStorageUrl } from "@/lib/utils"

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Discover how TipWalk works for travelers and guides. Book for free, meet your guide, and tip after your experience.",
  keywords: [
    "how free walking tours work",
    "book a walking tour",
    "how to become a tour guide",
    "pay what you want tours",
    "tip-based tours",
    "local guide booking",
  ],
  openGraph: {
    title: withBrandSuffix("How It Works"),
    description: "Book free walking tours with local guides. Tip only after the experience.",
    url: toCanonicalUrl("/how-it-works"),
    siteName: BRAND_NAME,
    type: "website",
  },
  alternates: { canonical: toCanonicalUrl("/how-it-works") },
}

const travelerStepContent = [
  {
    number: "01",
    icon: Search,
    title: "Find Your Tour",
    description:
      "Search by city and discover local walking tours with transparent ratings and schedule options.",
  },
  {
    number: "02",
    icon: Calendar,
    title: "Reserve for Free",
    description:
      "Pick your date and reserve instantly. No upfront payment is required to secure your place.",
  },
  {
    number: "03",
    icon: MapPin,
    title: "Meet Your Guide",
    description:
      "Show up at the meeting point, join your group, and explore with a local who knows the city deeply.",
  },
  {
    number: "04",
    icon: Heart,
    title: "Tip After the Tour",
    description:
      "After the experience, tip your guide based on the value you felt you received.",
  },
]

const guideStepContent = [
  {
    number: "01",
    icon: Users,
    title: "Create Your Guide Profile",
    description:
      "Set up your public profile and share what makes your point of view on the city unique.",
  },
  {
    number: "02",
    icon: MapPin,
    title: "Build and Publish Tours",
    description:
      "Define your route, highlights, meeting point, and schedule so travelers can reserve in advance.",
  },
  {
    number: "03",
    icon: Star,
    title: "Earn Trust Through Reviews",
    description:
      "Deliver memorable experiences and grow visibility with verified traveler ratings and feedback.",
  },
  {
    number: "04",
    icon: CreditCard,
    title: "Grow Your Reach",
    description:
      "Use dashboard tools and optional boosts to increase discoverability and repeat bookings.",
  },
]

function resolveImage(input?: string) {
  if (!input) return "/placeholder.svg"
  if (input.startsWith("http") || input.startsWith("/")) return input
  return getStorageUrl(input)
}

function getTourImage(tour: any) {
  const raw = tour?.photos?.[0] || tour?.images?.[0]
  if (typeof raw === "string") return raw
  if (raw && typeof raw === "object" && typeof raw.url === "string") return raw.url
  return undefined
}

export default async function HowItWorksPage() {
  const [featuredCities, featuredTours] = await Promise.all([
    getFeaturedCities(4),
    getPublicTours({ limit: 4, sort: "recommended" }),
  ])

  const cityImages = featuredCities.map((city) => resolveImage(city.image))
  const tourImages = featuredTours.map((tour) => resolveImage(getTourImage(tour)))
  const travelerFallbacks = [
    "/travel-walking-tour-city.jpg",
    "/walking-tour-city-travelers.jpg",
    "/paris-cityscape-eiffel-tower.jpg",
    "/travel-adventure-walking.jpg",
  ]
  const guideFallbacks = [
    "/professional-hispanic-man-portrait.jpg",
    "/italian-man-guide-portrait.jpg",
    "/french-woman-guide-portrait.jpg",
    "/czech-man-guide-portrait.jpg",
  ]

  const travelerSteps = travelerStepContent.map((step, index) => ({
    ...step,
    image: cityImages[index] || travelerFallbacks[index],
  }))

  const guideSteps = guideStepContent.map((step, index) => ({
    ...step,
    image: tourImages[index] || guideFallbacks[index],
  }))

  const benefits = [
    {
      icon: Users,
      title: "Max 10 Guests",
      description: "Small-group tours keep the experience personal and easier to follow.",
    },
    {
      icon: Clock,
      title: "Book Free",
      description: "Reserve instantly with no upfront booking fee.",
    },
    {
      icon: Globe,
      title: "Tip at the End",
      description: "Travelers tip based on the value they received after the tour.",
    },
    {
      icon: Shield,
      title: "Built for Reliability",
      description: "Tours are designed to run with small groups so guests can book with confidence.",
    },
  ]

  return (
    <div className="public-template-page landing-template">
      <Navbar variant="landingTemplate" />

      <section className="public-hero-section py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="public-template-heading text-4xl font-bold tracking-tight lg:text-5xl">How TipWalk Works</h1>
          <p className="public-template-copy mt-4 max-w-2xl mx-auto text-lg">
            Real tours, real local guides, and a booking flow designed around value-first travel.
          </p>
          <p className="mt-3 max-w-2xl mx-auto text-sm text-[color:var(--landing-muted)]">
            Tours are designed to run with small groups, so travelers can book with confidence.
          </p>
          <p className="mt-3 max-w-2xl mx-auto text-sm text-[color:var(--landing-muted)]">
            Guides marked <span className="font-semibold text-[color:var(--landing-ink)]">PRO</span> use TipWalk&apos;s paid plan and added tools.
            The badge is a plan signal, not a quality guarantee by itself.
          </p>
        </div>
      </section>

      <section className="public-section py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="travelers" className="w-full">
            <div className="flex justify-center mb-12">
              <TabsList className="grid w-full max-w-md grid-cols-2 border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]">
                <TabsTrigger value="travelers" className="text-sm sm:text-base">
                  For Travelers
                </TabsTrigger>
                <TabsTrigger value="guides" className="text-sm sm:text-base">
                  For Guides
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="travelers">
              <div className="space-y-24">
                {travelerSteps.map((step, index) => (
                  <div
                    key={step.number}
                    className={`grid lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
                  >
                    <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-5xl font-bold text-primary/20">{step.number}</span>
                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                          <step.icon className="w-6 h-6 text-primary-foreground" />
                        </div>
                      </div>
                      <h3 className="public-template-heading text-2xl font-bold">{step.title}</h3>
                      <p className="public-template-copy mt-4 text-lg leading-relaxed">{step.description}</p>
                    </div>
                    <div className={`relative ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                      <div className="aspect-video overflow-hidden rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-md)]">
                        <Image
                          src={step.image}
                          alt={step.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-16 text-center">
                <Button size="lg" className="landing-btn-coral" asChild>
                  <Link href="/tours">
                    Find a Tour
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="guides">
              <div className="space-y-24">
                {guideSteps.map((step, index) => (
                  <div
                    key={step.number}
                    className={`grid lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
                  >
                    <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-5xl font-bold text-primary/20">{step.number}</span>
                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                          <step.icon className="w-6 h-6 text-primary-foreground" />
                        </div>
                      </div>
                      <h3 className="public-template-heading text-2xl font-bold">{step.title}</h3>
                      <p className="public-template-copy mt-4 text-lg leading-relaxed">{step.description}</p>
                    </div>
                    <div className={`relative ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                      <div className="aspect-video overflow-hidden rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-md)]">
                        <Image
                          src={step.image}
                          alt={step.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-16 text-center">
                <Button size="lg" className="landing-btn-coral" asChild>
                  <Link href="/become-guide">
                    Become a Guide
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section className="public-section-soft py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="public-template-heading text-3xl font-bold">Why Choose TipWalk?</h2>
            <p className="public-template-copy mt-4">Built for trust, flexibility, and city-level authenticity.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="public-shell-card">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="public-template-heading text-3xl font-bold">What does "free" really mean?</h2>
              <p className="public-template-copy mt-4 leading-relaxed">
                There is no upfront booking fee. Travelers tip at the end based on how much value they received.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "No booking fee or hidden checkout charges",
                  "Tip directly to the guide after the tour",
                  "Incentives aligned with quality experiences",
                  "Accessible model for different travel budgets",
                  "Direct support for local experts",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="public-shell-card-muted p-8">
              <h3 className="mb-6 text-lg font-semibold text-[color:var(--landing-ink)]">Typical tip ranges</h3>
              <div className="space-y-4">
                {[
                  { label: "Excellent experience", amount: "€15-25", percentage: 60 },
                  { label: "Good experience", amount: "€10-15", percentage: 30 },
                  { label: "Average experience", amount: "€5-10", percentage: 10 },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.amount}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-[color:var(--landing-muted)]">
                *Illustrative ranges only. Actual tips vary by tour quality, length, and traveler preference.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section-soft py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-band p-8 text-center lg:p-16">
            <h2 className="public-template-heading text-3xl font-bold lg:text-4xl">Ready to get started?</h2>
            <p className="public-template-copy mt-4 max-w-2xl mx-auto text-lg">
              Book your next city walk or publish your own route as a local guide.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button size="lg" className="landing-btn-coral" asChild>
                <Link href="/tours">Explore Tours</Link>
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
