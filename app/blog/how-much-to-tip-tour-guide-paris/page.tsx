import type { Metadata } from "next"
import Link from "next/link"
import { TIPPING_GUIDE_POST } from "@/lib/blog/static-posts"

const CANONICAL_URL = "https://www.touricho.com/blog/how-much-to-tip-tour-guide-paris"

export const metadata: Metadata = {
  title: { absolute: TIPPING_GUIDE_POST.metaTitle },
  description: TIPPING_GUIDE_POST.metaDescription,
  alternates: { canonical: CANONICAL_URL },
}

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How Much Should You Tip a Walking Tour Guide in Paris?",
  author: { "@type": "Organization", name: "Touricho" },
  publisher: { "@type": "Organization", name: "Touricho", url: "https://www.touricho.com" },
  datePublished: "2026-03-27",
  description: "How much to tip a walking tour guide in Paris — real numbers from a Paris tour operator.",
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a normal tip for a walking tour guide in Paris?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most guests tip between €10 and €20 per person. Around €15 is a common benchmark on a 2-hour Paris walking tour.",
      },
    },
    {
      "@type": "Question",
      name: "Do I have to tip on a free walking tour?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There is no legal obligation, but tips are how guides are paid. If you enjoyed the tour, tipping is the expected way to support your guide.",
      },
    },
    {
      "@type": "Question",
      name: "Should I tip in cash or by card in Paris?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Many guides accept both cash and card. At Touricho, guides can accept card tips through the platform, and cash is also appreciated.",
      },
    },
    {
      "@type": "Question",
      name: "What if I’m on a tight budget?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If your budget is limited, tipping €5–10 is still appreciated. The tip-based model is designed so travelers can pay what they genuinely can.",
      },
    },
  ],
}

export default function ParisTippingGuideBlogPostPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <article className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-balance text-3xl font-semibold leading-tight text-[color:var(--landing-ink)] sm:text-4xl">
            {TIPPING_GUIDE_POST.title}
          </h1>
          <p className="text-sm text-[color:var(--landing-ink-muted)]">Published on March 27, 2026</p>
          <p className="text-sm text-[color:var(--landing-ink-muted)]">
            By{" "}
            <Link href="/guides/pierre-gendrin" className="font-medium text-[color:var(--landing-primary)] underline">
              Pierre Gendrin
            </Link>{" "}
            — Local guide, Montmartre resident for 8 years
          </p>
        </header>

        <div className="space-y-4 text-base leading-7 text-[color:var(--landing-ink)]">
          {TIPPING_GUIDE_POST.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          {TIPPING_GUIDE_POST.sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="pt-2 text-2xl font-semibold">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <p>
            Ready to book a free walking tour of Montmartre or the City Centre?{" "}
            <Link href="/tours/paris" className="text-[color:var(--landing-primary)] underline">
              Browse tours in Paris →
            </Link>
          </p>
        </div>
      </article>
    </main>
  )
}
