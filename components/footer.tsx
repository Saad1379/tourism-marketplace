import Link from "next/link"
import { Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildCityToursPath } from "@/lib/tour-url"
import { TourichoLogo } from "@/components/brand/touricho-logo"
import { ConditionalReviewsLink } from "@/components/conditional-reviews-link"

type FooterVariant = "default" | "landingTemplate"

interface FooterProps {
  variant?: FooterVariant
}

const CONTACT_PHONE = process.env.ORGANIZATION_PHONE?.trim()
const CONTACT_PHONE_HREF = CONTACT_PHONE
  ? `tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`
  : null

export function Footer({ variant = "default" }: FooterProps = {}) {
  if (variant === "landingTemplate") {
    return (
      <footer className="landing-template border-t border-[color:var(--landing-border)] bg-[color:var(--landing-footer-bg)] text-[color:var(--landing-footer-ink)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-4">
              <Link href="/" aria-label="Touricho home">
                <TourichoLogo size="lg" textClassName="text-[color:var(--landing-footer-ink)]" />
              </Link>
              <p className="max-w-sm text-sm leading-relaxed text-[color:var(--landing-footer-muted)]">
                Connecting curious travelers with passionate local guides for authentic walking tour experiences that
                reveal the soul of every city.
              </p>
              <div className="flex flex-col gap-2 text-sm text-[color:var(--landing-footer-muted)]">
                <a href="mailto:hello@touricho.com" className="flex items-center gap-2 transition-colors hover:text-[color:var(--landing-footer-ink)]">
                  <Mail className="h-4 w-4" />
                  hello@touricho.com
                </a>
                {CONTACT_PHONE && CONTACT_PHONE_HREF ? (
                  <a href={CONTACT_PHONE_HREF} className="flex items-center gap-2 transition-colors hover:text-[color:var(--landing-footer-ink)]">
                    <Phone className="h-4 w-4" />
                    {CONTACT_PHONE}
                  </a>
                ) : null}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[color:var(--landing-footer-head)]">Explore</h3>
              <ul className="space-y-2.5">
                {["Paris", "Rome", "Barcelona", "London", "Amsterdam", "Prague"].map((city) => (
                  <li key={city}>
                    <Link href={buildCityToursPath(city)} className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">
                      {city}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[color:var(--landing-footer-head)]">Travelers</h3>
              <ul className="space-y-2.5">
                <li><Link href="/tours" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Find Tours</Link></li>
                <li><Link href="/how-it-works" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">How It Works</Link></li>
                <ConditionalReviewsLink className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]" />
                <li><Link href="/faq" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">FAQ</Link></li>
                <li><Link href="/about" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">About Us</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[color:var(--landing-footer-head)]">Guides</h3>
              <ul className="space-y-2.5">
                <li><Link href="/become-guide" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Become a Guide</Link></li>
                <li><Link href="/dashboard" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Guide Dashboard</Link></li>
                <li><Link href="/dashboard/credits" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Buy Credits</Link></li>
                <li><Link href="/guide-resources" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Resources</Link></li>
                <li><Link href="/contact" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Support</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-[color:var(--landing-border)]/80 pt-7">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <p className="text-sm text-[color:var(--landing-footer-muted)]">© {new Date().getFullYear()} Touricho. All rights reserved.</p>
              <div className="flex gap-6">
                <Link href="/privacy" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Privacy</Link>
                <Link href="/terms" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Terms</Link>
                <Link href="/cookies" className="text-sm text-[color:var(--landing-footer-muted)] transition-colors hover:text-[color:var(--landing-footer-ink)]">Cookies</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Newsletter Section */}
      <div className="border-b border-sidebar-border/80">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div>
              <h3 className="text-2xl font-bold text-sidebar-foreground">Stay Curious</h3>
              <p className="mt-1 text-sidebar-foreground/70">Get travel inspiration and exclusive offers in your inbox.</p>
            </div>
            <form action="/api/newsletter" method="POST" className="flex w-full max-w-md gap-2">
              <Input
                type="email"
                name="email"
                placeholder="Enter your email"
                required
                aria-label="Email address"
                className="rounded-full border-sidebar-border bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/55"
              />
              <input type="hidden" name="source" value="footer_newsletter" />
              <Button className="rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" aria-label="Touricho home">
              <TourichoLogo size="md" textClassName="text-sidebar-foreground" />
            </Link>
            <p className="text-sm leading-relaxed text-sidebar-foreground/70 max-w-sm">
              Connecting curious travelers with passionate local guides for authentic walking tour experiences that
              reveal the soul of every city.
            </p>
            <div className="flex flex-col gap-2 text-sm text-sidebar-foreground/70">
              <a
                href="mailto:hello@touricho.com"
                className="flex items-center gap-2 transition-colors hover:text-sidebar-foreground"
              >
                <Mail className="h-4 w-4" />
                hello@touricho.com
              </a>
              {CONTACT_PHONE && CONTACT_PHONE_HREF ? (
                <a href={CONTACT_PHONE_HREF} className="flex items-center gap-2 transition-colors hover:text-sidebar-foreground">
                  <Phone className="h-4 w-4" />
                  {CONTACT_PHONE}
                </a>
              ) : null}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/85">Explore</h3>
            <ul className="space-y-2.5">
              {["Paris", "Rome", "Barcelona", "London", "Amsterdam", "Prague"].map((city) => (
                <li key={city}>
                  <Link
                    href={buildCityToursPath(city)}
                    className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
                  >
                    {city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Travelers */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/85">Travelers</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/tours" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  Find Tours
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  How It Works
                </Link>
              </li>
              <ConditionalReviewsLink className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground" />
              <li>
                <Link href="/faq" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Guides */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/85">Guides</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/become-guide" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  Become a Guide
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  Guide Dashboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard/credits" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  Buy Credits
                </Link>
              </li>
              <li>
                <Link href="/guide-resources" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  Resources
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
                  Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-sidebar-border/80 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-sidebar-foreground/60">© {new Date().getFullYear()} Touricho. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground">
                Terms
              </Link>
              <Link href="/cookies" className="text-sm text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
