import type { Metadata } from "next"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { toCanonicalUrl } from "@/lib/seo/brand"
import { getSiteUrl } from "@/lib/site-url"

const PAGE_PATH = "/guides/charles-afeavo"
const PAGE_TITLE = "Charles Afeavo — Local City of Lights Tour Guide in Paris"
const PAGE_DESCRIPTION =
  "Meet Charles Afeavo, Touricho guide for central Paris routes around Pont Neuf, Notre-Dame, and Île de la Cité."
const IMAGE_URL = "https://www.touricho.com/images/guides/charles-afeavo.jpg"

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

export default function CharlesAfeavoGuidePage() {
  const siteUrl = getSiteUrl()
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Charles Afeavo",
    jobTitle: "Local Walking Tour Guide",
    worksFor: {
      "@type": "Organization",
      name: "Touricho",
      url: siteUrl,
    },
    knowsAbout: ["Pont Neuf", "Notre-Dame", "Ile de la Cite", "Sainte-Chapelle", "Point Zero"],
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
            <h1 className="public-template-heading text-3xl font-bold tracking-tight md:text-4xl">Charles Afeavo</h1>
            <p className="public-template-copy mt-4">
              Charles leads Touricho’s City of Lights route through central Paris, including Pont Neuf and Île de la
              Cité. His tours focus on clear historical context and practical orientation for first-time visitors.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <article className="public-shell-card p-5">
                <h2 className="text-base font-semibold text-[color:var(--landing-ink)]">Specialty</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Central Paris walking tours around Pont Neuf, Notre-Dame, Île de la Cité, Sainte-Chapelle, and Point
                  Zéro.
                </p>
              </article>
              <article className="public-shell-card p-5">
                <h2 className="text-base font-semibold text-[color:var(--landing-ink)]">Credentials</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  PRO verified on Touricho with 5.0★ rating signals and small-group walks designed for question-friendly
                  pacing.
                </p>
              </article>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/tours/paris/city-of-lights-walking-tour" className="landing-btn-coral inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
                Book Charles’s City Tour
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
