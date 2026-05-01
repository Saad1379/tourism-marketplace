import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getSiteUrl } from "@/lib/site-url"
import { getToursForCitySlug } from "@/lib/supabase/queries"
import { buildTourPathFromRecord } from "@/lib/tour-url"

const SITE_URL = getSiteUrl()
const PAGE_PATH = "/guides/paris/best-neighborhood-walking-routes"
const PAGE_TITLE = "Best Neighborhood Walking Routes in Paris"
const PAGE_DESCRIPTION =
  "Discover the best Paris neighborhoods for free walking tours, from historic routes to local streets, and pick the right experience before you reserve."

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

export default async function ParisNeighborhoodWalkingRoutesPage() {
  const parisTours = await getToursForCitySlug("paris", 6)
  const featuredTours = parisTours.slice(0, 4)

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <main className="public-template-main flex-1">
        <section className="public-hero-section">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="public-template-heading text-3xl font-bold tracking-tight md:text-4xl">
              Best Neighborhood Walking Routes in Paris
            </h1>
            <p className="public-template-copy mt-4">
              Paris is easier to understand when you explore it district by district. This practical guide helps you choose the right neighborhood route based on your interests, walking pace, and available time.
            </p>
            <div className="mt-6 space-y-5">
              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">Historic Core: Ile de la Cite + Latin Quarter</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  This route works best for first-time visitors. You get a clear timeline of Paris from medieval foundations to modern boulevards, usually with landmarks that are easy to revisit after the tour.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Choose this area if you want context quickly: cathedral stories, old river crossings, and practical orientation around central metro stations.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">Marais: Architecture, Culture, and Local Rhythm</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Marais tours usually balance history with everyday Parisian life. Expect elegant facades, hidden courtyards, and practical food recommendations that are still useful after the walk.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  This district is ideal if you want less monument-only sightseeing and more neighborhood understanding with shorter walking segments between story points.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">Montmartre: Views, Art History, and Hills</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Montmartre is perfect for travelers who enjoy dramatic viewpoints and artist-era storytelling. The route is usually steeper, so comfortable shoes and a moderate pace matter.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Pick this neighborhood if atmosphere is your priority and you want a route with personality, photo spots, and layered cultural stories.
                </p>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">How to Choose the Right Route</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-[color:var(--landing-muted)]">
                  <li>First time in Paris: start in the historic core for orientation and major context.</li>
                  <li>Food and local streets: choose Marais or mixed neighborhood routes.</li>
                  <li>Views and creative history: choose Montmartre, but expect more elevation.</li>
                  <li>Short city break: pick tours near your accommodation to save transit time.</li>
                </ul>
              </article>

              <article className="public-shell-card p-5">
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">When to walk each area</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Morning tours are usually easier in dense central zones because sidewalks are calmer and weather is often milder. For riverside or viewpoint routes, late afternoon can produce better light and stronger atmosphere, but crowds increase near major monuments.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  If your trip is short, combine one orientation-focused route with one neighborhood route. This gives you both broad context and practical local recommendations without overloading the same day.
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--landing-muted)]">
                  Always verify meeting-point details and expected walking intensity before booking, especially for routes with hills, stairs, or longer open stretches in sun or rain.
                </p>
              </article>
            </div>

            {featuredTours.length > 0 ? (
              <article className="public-shell-card mt-6 p-5">
                <h2 className="text-base font-semibold text-[color:var(--landing-ink)]">Popular Paris tours on Touricho</h2>
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
                Browse Paris Walking Tours
              </Link>
              <Link
                href="/tours"
                className="inline-flex h-11 items-center rounded-full border border-[color:var(--landing-border-2)] px-5 text-sm font-semibold text-[color:var(--landing-accent)]"
              >
                Explore All Cities
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="landingTemplate" />
    </div>
  )
}
