import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Guide Agreement | TipWalk",
  description: "Summary of operational and platform expectations for TipWalk guides.",
  alternates: {
    canonical: "/guide-agreement",
  },
  openGraph: {
    title: "Guide Agreement | TipWalk",
    description: "Summary of operational and platform expectations for TipWalk guides.",
    url: "/guide-agreement",
    type: "article",
  },
}

export default function GuideAgreementPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Guide Agreement</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              This summary outlines basic expectations for guides using TipWalk. It does not replace full legal terms.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h2 className="text-base font-semibold text-foreground">1. Tour quality and accuracy</h2>
              <p className="mt-2">
                Guides are responsible for accurate listings, punctual attendance, and delivering the published experience.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">2. Safety and conduct</h2>
              <p className="mt-2">
                Guides must follow local regulations, maintain professional behavior, and communicate schedule changes early.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">3. Payments and tips</h2>
              <p className="mt-2">
                TipWalk supports free reservations. Guides keep tips according to current platform terms and payout policies.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">4. Account integrity</h2>
              <p className="mt-2">
                Accounts may be reviewed or restricted for fraud, abuse, or policy violations.
              </p>
            </div>
            <p className="pt-2 text-xs">
              Read the complete legal framework in <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
              and <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
