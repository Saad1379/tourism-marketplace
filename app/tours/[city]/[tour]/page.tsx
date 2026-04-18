import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import TourDetailClient from "@/components/tours/tour-detail-client"
import { BRAND_NAME, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"
import {
  getToursForCitySlug,
  getPublishedTourSlugParams,
  getTourCanonicalById,
  getTourByCityAndTourSlug,
} from "@/lib/supabase/queries"
import {
  buildCanonicalTourPath,
  extractTourIdFromParam,
  resolveCitySlug,
  resolveTourSlug,
} from "@/lib/tour-url"
import { getStorageUrl } from "@/lib/utils"
import {
  buildTourJsonLdSchemas,
  buildTourSeoHeading,
  buildTourSeoMetaDescription,
  getOrderedStopNames,
} from "@/lib/seo/tour-page-seo"

export const revalidate = 1800
export const dynamicParams = true

type PageProps = {
  params: Promise<{ city: string; tour: string }>
}

export async function generateStaticParams() {
  const rows = await getPublishedTourSlugParams(5000)
  const unique = new Set<string>()
  const params: Array<{ city: string; tour: string }> = []

  for (const row of rows) {
    const key = `${row.city}/${row.tour}`
    if (unique.has(key)) continue
    unique.add(key)
    params.push({ city: row.city, tour: row.tour })
  }

  return params
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: rawCity, tour: rawTour } = await params
  const tour = await getTourByCityAndTourSlug(rawCity, rawTour)

  if (!tour) {
    const legacyTourId = extractTourIdFromParam(rawTour)
    if (legacyTourId) {
      const canonicalTour = await getTourCanonicalById(legacyTourId)
      if (canonicalTour) {
        const canonicalPath = buildCanonicalTourPath(canonicalTour.city_slug, canonicalTour.tour_slug)
        return {
          title: {
            absolute: withBrandSuffix(canonicalTour.title),
          },
          description: `Redirecting to ${canonicalTour.title}.`,
          alternates: { canonical: toCanonicalUrl(canonicalPath) },
          robots: { index: false, follow: true },
        }
      }
    }

    return {
      title: {
        absolute: withBrandSuffix("Tour not found"),
      },
      description: "This tour is no longer available.",
      robots: { index: false, follow: false },
    }
  }

  const citySlug = tour.city_slug || resolveCitySlug(tour.city || rawCity)
  const tourSlug = tour.tour_slug || resolveTourSlug(tour.title || rawTour)
  const canonicalPath = buildCanonicalTourPath(citySlug, tourSlug)
  const canonicalUrl = toCanonicalUrl(canonicalPath)
  const stopNames = getOrderedStopNames(tour.tour_stops)
  const { cityLabel, neighbourhood, title } = buildTourSeoHeading({
    city: tour.city || citySlug,
    tourTitle: tour.title,
    stopNames,
  })
  const description = buildTourSeoMetaDescription({
    neighbourhood,
    stopNames,
    maxGuests: tour.max_capacity,
  })
  const rawImage = tour.photos?.[0] || tour.images?.[0]
  const imagePath = typeof rawImage === "string" ? rawImage : rawImage?.url
  const image = getStorageUrl(imagePath)

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true },
    keywords: [
      ...(Array.isArray(tour.seo_keywords) ? tour.seo_keywords : []),
      `${tour.title} ${cityLabel}`,
      `walking tour ${cityLabel}`,
      `best tours in ${cityLabel}`,
      "free walking tour",
      "local guide",
    ],
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: BRAND_NAME,
      images: image ? [{ url: image, alt: `${tour.title} in ${cityLabel}` }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function TourPage({ params }: PageProps) {
  const { city: rawCity, tour: rawTour } = await params
  const tour = await getTourByCityAndTourSlug(rawCity, rawTour)

  if (!tour) {
    const legacyTourId = extractTourIdFromParam(rawTour)
    if (legacyTourId) {
      const canonicalTour = await getTourCanonicalById(legacyTourId)
      if (canonicalTour) {
        permanentRedirect(buildCanonicalTourPath(canonicalTour.city_slug, canonicalTour.tour_slug))
      }
    }
    notFound()
  }

  const citySlug = tour.city_slug || resolveCitySlug(tour.city || rawCity)
  const tourSlug = tour.tour_slug || resolveTourSlug(tour.title || rawTour)
  const canonicalPath = buildCanonicalTourPath(citySlug, tourSlug)
  if (rawCity !== citySlug || rawTour !== tourSlug) {
    permanentRedirect(canonicalPath)
  }

  const stopNames = getOrderedStopNames(tour.tour_stops)
  const { cityLabel, h1 } = buildTourSeoHeading({
    city: tour.city || citySlug,
    tourTitle: tour.title,
    stopNames,
  })
  const canonicalUrl = toCanonicalUrl(canonicalPath)
  const { touristAttraction, event } = buildTourJsonLdSchemas({
    tour,
    canonicalUrl,
    cityLabel,
  })
  const shouldIncludeAggregateRating =
    citySlug === "paris" && (tourSlug === "montmartre-walking-tour" || tourSlug === "city-of-lights-walking-tour")
  const eventSchema = event && shouldIncludeAggregateRating
    ? {
        ...event,
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Number(tour.average_rating || 0).toFixed(1),
          reviewCount: String(Math.max(0, Number(tour.review_count || 0))),
          bestRating: "5",
          worstRating: "1",
        },
      }
    : event

  const relatedTours = (await getToursForCitySlug(citySlug, 50))
    .filter((item) => String(item?.id || "") !== String(tour.id))
    .sort((a: any, b: any) => {
      const reviewDelta = Number(b?.review_count || 0) - Number(a?.review_count || 0)
      if (reviewDelta !== 0) return reviewDelta

      const ratingDelta = Number(b?.average_rating || 0) - Number(a?.average_rating || 0)
      if (ratingDelta !== 0) return ratingDelta

      return String(a?.title || "").localeCompare(String(b?.title || ""))
    })
    .slice(0, 3)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(touristAttraction) }}
      />
      {eventSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
      )}
      <TourDetailClient
        tourId={tour.id}
        initialTour={tour}
        initialRelatedTours={relatedTours}
        seoH1={h1}
      />
    </>
  )
}
