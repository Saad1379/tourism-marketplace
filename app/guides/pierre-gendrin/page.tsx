import type { Metadata } from "next"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { toCanonicalUrl } from "@/lib/seo/brand"
import { getSiteUrl } from "@/lib/site-url"

const PAGE_PATH = "/guides/pierre-gendrin"
const PAGE_TITLE = "Pierre Gendrin — Local Walking Tour Guide in Montmartre"
const PAGE_DESCRIPTION =
  "Meet Pierre Gendrin, Touricho local guide in Montmartre. Explore Sacre-Coeur, Moulin Rouge, and hidden corners with a guide who has lived in the neighborhood for 8 years."
const IMAGE_URL = "https://www.touricho.com/images/guides/pierre-gendrin.jpg"

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: `${PAGE_TITLE} | Touricho`,
    description: PAGE_DESCRIPTION,
    url: toCanonicalUrl(PAGE_PATH),
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | Touricho`,
    description: PAGE_DESCRIPTION,
  },
}

export default function PierreGendrinGuidePage() {
  const siteUrl = getSiteUrl()
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Pierre Gendrin",
    jobTitle: "Local Walking Tour Guide",
    worksFor: {
      "@type": "Organization",
      name: "Touricho",
      url: siteUrl,
    },
    knowsAbout: ["Montmartre", "Paris history", "French art", "Sacre-Coeur", "Moulin Rouge"],
    url: toCanonicalUrl(PAGE_PATH),
    image: IMAGE_URL,
  }

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <main className="public-template-main flex-1">
        <section className="public-hero-section">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
            <h1 className="public-template-heading text-3xl font-bold tracking-tight md:text-4xl">Pierre Gendrin</h1>
            <p className="public-template-copy mt-4">
              Pierre leads Touricho’s Montmartre route with deep local knowledge from 8 years living in the neighborhood.
              He focuses on practical context, artist history, and the side streets most visitors miss.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <article className="public-shell-card p-5">
                <h2 className="text-base font-semibold text-[color:var(--landing-ink)]">Specialty</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Montmartre walking tours covering Place Blanche, Moulin Rouge, Sacre-Coeur, Moulin de la Galette,
                  Place du Tertre, and nearby backstreets.
                </p>
              </article>
              <article className="public-shell-card p-5">
                <h2 className="text-base font-semibold text-[color:var(--landing-ink)]">Credentials</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  PRO verified on Touricho with consistent 5.0★ guest feedback and a small-group format (max 10 guests).
                </p>
              </article>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/tours/paris/montmartre-walking-tour" className="landing-btn-coral inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
                Book Pierre’s Montmartre Tour
              </Link>
              <Link
                href="/blog"
                className="inline-flex h-11 items-center rounded-full border border-[color:var(--landing-border-2)] px-5 text-sm font-semibold text-[color:var(--landing-accent)]"
              >
                Read Touricho Guides
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="landingTemplate" />
    </div>
  )
}
