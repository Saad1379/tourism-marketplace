import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, ShieldCheck, Sparkles } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Guide Resources | TipWalk",
  description: "Best practices and onboarding resources for TipWalk guides.",
  alternates: {
    canonical: "/guide-resources",
  },
  openGraph: {
    title: "Guide Resources | TipWalk",
    description: "Best practices and onboarding resources for TipWalk guides.",
    url: "/guide-resources",
    type: "website",
  },
}

const resources = [
  {
    icon: BookOpen,
    title: "Tour Hosting Basics",
    description: "Plan clear routes, manage pacing, and deliver memorable storytelling for mixed-size groups.",
  },
  {
    icon: ShieldCheck,
    title: "Safety & Reliability",
    description: "Follow city regulations, emergency protocols, and attendee communication standards.",
  },
  {
    icon: Sparkles,
    title: "Profile & Growth",
    description: "Optimize your profile, gather quality reviews, and improve conversion from listing views to bookings.",
  },
]

export default function GuideResourcesPage() {
  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />
      <main className="public-template-main flex-1">
        <section className="public-hero-section">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="public-template-heading text-3xl font-bold tracking-tight">Guide Resources</h1>
            <p className="public-template-copy mt-3 max-w-3xl">
              Use these starter resources to publish better tours, earn stronger reviews, and keep guest experiences consistent.
            </p>
          </div>
        </section>

        <section className="public-section mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {resources.map(({ icon: Icon, title, description }) => (
              <article key={title} className="landing-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-[color:var(--landing-ink)]">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--landing-muted)]">{description}</p>
              </article>
            ))}
          </div>

          <div className="public-shell-card-muted mt-10 p-6">
            <h2 className="text-xl font-semibold text-[color:var(--landing-ink)]">Need help from the team?</h2>
            <p className="mt-2 text-sm text-[color:var(--landing-muted)]">
              Reach out to support for account, listing, or payout questions.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild className="landing-btn-coral">
                <Link href="/contact">
                  Contact Support <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]">
                <Link href="/become-guide">Guide Onboarding</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="landingTemplate" />
    </div>
  )
}
