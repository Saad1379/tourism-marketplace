import type React from "react"
import type { Metadata } from "next"
import { BRAND_NAME, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to common questions about booking free walking tours, becoming a guide, credits, payments, and more on Touricho.",
  keywords: ["touricho FAQ", "walking tour questions", "how to book a tour", "become a guide FAQ", "touricho credits help"],
  openGraph: {
    title: withBrandSuffix("Frequently Asked Questions"),
    description: "Find answers to common questions about booking tours, becoming a guide, payments, and more.",
    url: toCanonicalUrl("/faq"),
    siteName: BRAND_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: withBrandSuffix("Frequently Asked Questions"),
    description: "Find answers to common questions about booking tours, becoming a guide, payments, and more.",
  },
  alternates: { canonical: toCanonicalUrl("/faq") },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a free walking tour?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A free walking tour is a guided tour where you don't pay a fixed price upfront. Instead, at the end of the tour, you tip the guide based on your satisfaction and experience. This model ensures guides are motivated to deliver excellent tours while making travel experiences accessible to everyone.",
      },
    },
    {
      "@type": "Question",
      name: "How much should I tip?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tipping is flexible and depends on your satisfaction. Most travelers tip between €10-20 per person for a 2-3 hour tour. However, you're free to tip whatever feels right based on the experience, your budget, and local customs.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to book in advance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We strongly recommend booking in advance to secure your spot, especially for popular tours and during peak tourist seasons. However, if spots are available, you can join a tour on the same day.",
      },
    },
    {
      "@type": "Question",
      name: "What if I need to cancel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can cancel your booking for free up to 24 hours before the tour starts. For cancellations within 24 hours, we ask that you message your guide directly.",
      },
    },
    {
      "@type": "Question",
      name: "Are tours available in my language?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We offer tours in many languages including English, Spanish, French, German, Italian, Portuguese, and more. Each tour listing shows which languages the guide speaks. Use our filter options to find tours in your preferred language.",
      },
    },
    {
      "@type": "Question",
      name: "How do I become a guide on Touricho?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Click 'Become a Guide' and complete our registration process. You'll provide information about yourself, your experience, and create your first tour. Once approved, your tour will be live and you can start accepting bookings.",
      },
    },
    {
      "@type": "Question",
      name: "How much can I earn as a guide?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Earnings vary based on location, tour quality, and frequency. Top guides can earn €50-200+ per tour. Building great reviews helps attract more bookings.",
      },
    },
    {
      "@type": "Question",
      name: "What are credits?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Credits are our platform currency that guides use to access premium features such as Featured Listings, Search Boost, and Profile Highlights. Credits can be purchased in packages and never expire.",
      },
    },
    {
      "@type": "Question",
      name: "Is my booking confirmed immediately?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most bookings are confirmed instantly. However, some guides review bookings manually, especially for large groups or special requests. You'll receive a confirmation email once your booking is confirmed.",
      },
    },
  ],
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  )
}
