import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Touricho's privacy policy explains how we collect, use, and protect your personal data in compliance with GDPR, CCPA, and CNIL regulations.",
  openGraph: {
    title: "Privacy Policy | Touricho",
    description: "How Touricho collects, uses, and protects your personal data.",
    url: "/privacy",
    type: "website",
  },
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Cookie Consent</h2>
          <p className="text-foreground/80 mb-4">
            Touricho uses Google Analytics to measure site performance and user behavior. All analytics cookies are
            disabled by default until you explicitly consent through our cookie banner.
          </p>
          <p className="text-foreground/80">
            Your consent choice is stored in a cookie that expires after 365 days. You can change your consent
            preferences at any time by clearing your browser cookies and revisiting the site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Google Analytics</h2>
          <p className="text-foreground/80 mb-4">
            We use Google Analytics 4 (GA4) to understand how visitors use Touricho. GA4 collects:
          </p>
          <ul className="list-disc pl-6 text-foreground/80 mb-4">
            <li>Page views and user journeys</li>
            <li>Device and browser information</li>
            <li>Anonymized IP addresses</li>
            <li>Traffic sources and search keywords</li>
          </ul>
          <p className="text-foreground/80">
            All data is anonymized and we comply with GDPR, CCPA, and French CNIL regulations.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Your Rights</h2>
          <p className="text-foreground/80">
            You have the right to refuse analytics cookies at any time. If you refuse, GA4 will not be loaded or track
            your activity. You can also opt out by modifying your privacy settings.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Contact</h2>
          <p className="text-foreground/80">For privacy inquiries, please contact us at privacy@touricho.com</p>
        </section>
      </div>
    </div>
  )
}
