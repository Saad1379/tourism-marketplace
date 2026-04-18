import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getSiteUrl } from "@/lib/site-url"
import { getToursForCitySlug } from "@/lib/supabase/queries"
import { buildTourPathFromRecord } from "@/lib/tour-url"

const SITE_URL = getSiteUrl()
const PAGE_PATH = "/guides/paris/first-time-free-walking-tour-tips"
const PAGE_TITLE = "First-Time Free Walking Tour Tips for Paris"
const PAGE_DESCRIPTION =
  "Plan your first free walking tour in Paris with practical tips on timing, meeting points, group size, and how tip-based tours work."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: `${PAGE_TITLE} | TipWalk`,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}${PAGE_PATH}`,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | TipWalk`,
    description: PAGE_DESCRIPTION,
  },
}

export default async function FirstTimeParisTourTipsPage() {
  const parisTours = await getToursForCitySlug("paris", 6)
  const featuredTours = parisTours.slice(0, 4)

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <main className="public-template-main flex-1">
        <section className="public-hero-section">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="public-template-heading text-3xl font-bold tracking-tight md:text-4xl">
              First-Time Free Walking Tour Tips for Paris
            </h1>
            <p className="public-template-copy mt-4">
              Your first Paris walking tour should feel simple and clear. These tips help you reserve the right route, arrive prepared, and avoid common mistakes that reduce tour quality.
            </p>
            <div className="mt-6 space-y-5">
              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">1. Pick the right start time</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Morning routes usually feel less crowded and cooler in warmer months. Late-afternoon routes can be more atmospheric, but major sites may be busier. Match timing to your energy level, weather, and any museum reservations later in the day.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">2. Review practical details before booking</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Check duration, language, and maximum group size before you reserve. Adults are 15 or older, and children are under 15. If you are traveling with family, confirm the route pace and terrain to avoid fatigue on longer walks.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-[color:var(--landing-muted)]">
                  <li>Arrive 10 to 15 minutes early at the exact meeting point.</li>
                  <li>Bring water, weather layers, and comfortable walking shoes.</li>
                  <li>Keep your booking confirmation accessible on your phone.</li>
                </ul>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">3. Understand the tip-based model</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  You reserve for free on TipWalk. At the end of the experience, tip your guide based on the value you received. This keeps booking accessible while rewarding clear storytelling, useful recommendations, and a well-paced route.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  If your plans change, cancel early so other travelers can take the seat. This improves reliability for guides and keeps schedules available for guests who are ready to join.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">4. Use your first tour as city orientation</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Ask your guide for route suggestions after the tour: where to eat nearby, what to revisit at quieter hours, and how to connect neighborhoods by metro. A good first tour can save hours during the rest of your Paris stay.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">Common first-time mistakes to avoid</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-[color:var(--landing-muted)]">
                  <li>Booking without checking duration, then missing your next activity.</li>
                  <li>Arriving late and losing route context in the first 20 minutes.</li>
                  <li>Choosing footwear for photos instead of comfort on real streets.</li>
                  <li>Skipping weather checks and walking long routes without layers.</li>
                  <li>Forgetting to save the meeting point offline in case of weak signal.</li>
                </ul>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  A small planning check before reserving leads to better reviews, smoother group pacing, and a much stronger first impression of Paris.
                </p>
              </article>
            </div>

            {featuredTours.length > 0 ? (
              <article className="public-shell-card mt-6 p-5">
                <h2 className="text-base font-semibold text-[color:var(--landing-ink)]">Start with these Paris tours</h2>
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
                Reserve a Paris Tour
              </Link>
              <Link
                href="/guides/paris/what-to-expect-tip-based-tours"
                className="inline-flex h-11 items-center rounded-full border border-[color:var(--landing-border-2)] px-5 text-sm font-semibold text-[color:var(--landing-accent)]"
              >
                See Tip-Based Expectations
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="landingTemplate" />
    </div>
  )
}
