import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getSiteUrl } from "@/lib/site-url"
import { getToursForCitySlug } from "@/lib/supabase/queries"
import { buildTourPathFromRecord } from "@/lib/tour-url"

const SITE_URL = getSiteUrl()
const PAGE_PATH = "/guides/paris/what-to-expect-tip-based-tours"
const PAGE_TITLE = "What to Expect from Tip-Based Tours in Paris"
const PAGE_DESCRIPTION =
  "Understand how tip-based walking tours in Paris work, including reservation flow, payment timing, and practical expectations before booking."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: `${PAGE_TITLE} | Touricho`,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}${PAGE_PATH}`,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | Touricho`,
    description: PAGE_DESCRIPTION,
  },
}

export default async function TipBasedParisTourExpectationsPage() {
  const parisTours = await getToursForCitySlug("paris", 6)
  const featuredTours = parisTours.slice(0, 4)

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <main className="public-template-main flex-1">
        <section className="public-hero-section">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="public-template-heading text-3xl font-bold tracking-tight md:text-4xl">
              What to Expect from Tip-Based Tours in Paris
            </h1>
            <p className="public-template-copy mt-4">
              Tip-based tours keep booking accessible while rewarding guides for quality. This page explains how reservations, payments, and expectations work so guests can book with confidence.
            </p>
            <div className="mt-6 space-y-5">
              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">How reservation works</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  On Touricho, guests reserve a tour spot without paying upfront. You choose a date, time, and guest count, then receive confirmation details for the meeting point. This removes payment friction and helps travelers compare multiple options before committing.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">What you pay and when</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  There is no booking fee for guests. At the end of the tour, you tip your guide based on overall value: route quality, storytelling, pacing, and practical recommendations. Most guides accept cash, and many can accept digital options depending on their setup.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Tip amounts are your choice. The model is built around fairness: guests pay what the experience was worth, and strong guides are directly rewarded for good delivery.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">Guest expectations before the tour</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-[color:var(--landing-muted)]">
                  <li>Arrive early at the listed meeting point so the group can start on time.</li>
                  <li>Review route length and language before booking.</li>
                  <li>Adults are 15 or older, and children are under 15.</li>
                  <li>Cancel early if plans change so another traveler can take your spot.</li>
                </ul>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">Why this format works in Paris</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Paris has different route styles, from major landmarks to neighborhood-specific experiences. A tip-based format lets travelers test routes without upfront risk, while guides still have a direct incentive to provide high-quality local context.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">What guides and guests both gain</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Guests gain flexibility because they can compare different routes and reserve early without prepaying. Guides gain transparent feedback because tips reflect actual guest satisfaction at the end of each walk.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  For marketplace quality, this creates healthy pressure on clear communication: better meeting-point instructions, stronger storytelling, practical local recommendations, and more reliable schedule management.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  If you are choosing between tours, compare start times, language, route intensity, and review signals first. Then pick the experience that matches your trip style rather than only choosing the shortest description.
                </p>
              </article>
            </div>

            {featuredTours.length > 0 ? (
              <article className="public-shell-card mt-6 p-5">
                <h2 className="text-base font-semibold text-[color:var(--landing-ink)]">Paris tours to compare now</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {featuredTours.map((tour) => (
                    <li key={tour.id}>
                      <Link
                        href={buildTourPathFromRecord(tour)}
                        className="text-sm font-medium text-[color:var(--landing-accent)] hover:underline"
                      >
                        {tour.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/tours/paris" className="landing-btn-coral inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
                Compare Paris Tours
              </Link>
              <Link
                href="/faq"
                className="inline-flex h-11 items-center rounded-full border border-[color:var(--landing-border-2)] px-5 text-sm font-semibold text-[color:var(--landing-accent)]"
              >
                Read FAQ
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="landingTemplate" />
    </div>
  )
}
