import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Cookie Policy | Touricho",
  description: "Learn how Touricho uses cookies and similar technologies.",
  alternates: {
    canonical: "/cookies",
  },
  openGraph: {
    title: "Cookie Policy | Touricho",
    description: "Learn how Touricho uses cookies and similar technologies.",
    url: "/cookies",
    type: "article",
  },
}

export default function CookiesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Cookie Policy</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              We use essential cookies to keep Touricho secure and optional analytics cookies to improve your experience.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              Touricho uses cookies and similar technologies to provide core platform functionality, remember preferences,
              and understand how travelers use the product.
            </p>
            <p>
              Essential cookies are always enabled because they are required for authentication, security, and booking
              flow integrity. Analytics cookies are optional and controlled by your consent preference.
            </p>
            <p>
              You can update cookie preferences at any time using the consent controls shown in the site interface.
            </p>
            <p>
              For questions, contact us at{" "}
              <a href="mailto:hello@touricho.com" className="font-medium text-primary hover:underline">
                hello@touricho.com
              </a>
              .
            </p>
            <p className="text-xs">
              This page is a summary notice. For full legal terms, see <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and{" "}
              <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
