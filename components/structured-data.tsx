import { buildTourPathFromRecord } from "@/lib/tour-url"
import { getSiteUrl } from "@/lib/site-url"
import { BRAND_NAME } from "@/lib/seo/brand"

const SITE_URL = getSiteUrl()
const ORGANIZATION_PHONE = process.env.ORGANIZATION_PHONE?.trim()

function absoluteUrl(value: string): string {
  if (!value) return SITE_URL
  return /^https?:\/\//i.test(value) ? value : `${SITE_URL}${value}`
}

export function WebsiteStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: SITE_URL,
    description: "Free walking tours with passionate local guides in 350+ cities worldwide",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/tours?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}

export function OrganizationStructuredData() {
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: "Connecting travelers with passionate local guides for free walking tours",
    foundingDate: "2024",
    sameAs: ["https://twitter.com/tipwalk", "https://facebook.com/tipwalk", "https://instagram.com/tipwalk"],
  }

  if (ORGANIZATION_PHONE) {
    structuredData.contactPoint = {
      "@type": "ContactPoint",
      telephone: ORGANIZATION_PHONE,
      contactType: "customer service",
      email: "support@tipwalk.com",
    }
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}

interface TourStructuredDataProps {
  tour: {
    id: string
    title: string
    city_slug?: string
    tour_slug?: string
    description: string
    city: string
    image: string
    rating: number
    reviewCount: number
    duration: string
    guide: {
      name: string
      image: string
    }
  }
}

export function TourStructuredData({ tour }: TourStructuredDataProps) {
  const hasAggregateRating = Number(tour.reviewCount) > 0 && Number(tour.rating) > 0
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.title,
    description: tour.description,
    touristType: "Cultural tourist",
    image: absoluteUrl(tour.image),
    url: absoluteUrl(buildTourPathFromRecord(tour)),
    itinerary: {
      "@type": "ItemList",
      name: tour.title,
      description: tour.description,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      description: "Free walking tour - pay what you want",
    },
    ...(hasAggregateRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: tour.rating,
            reviewCount: tour.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    provider: {
      "@type": "Person",
      name: tour.guide.name,
      image: tour.guide.image,
    },
    location: {
      "@type": "City",
      name: tour.city,
    },
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}

interface FAQStructuredDataProps {
  faqs: Array<{ question: string; answer: string }>
}

export function FAQStructuredData({ faqs }: FAQStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}

interface BreadcrumbStructuredDataProps {
  items: Array<{ name: string; url: string }>
}

export function BreadcrumbStructuredData({ items }: BreadcrumbStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}
