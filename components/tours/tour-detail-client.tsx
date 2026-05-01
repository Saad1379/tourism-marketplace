"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  Star,
  Clock,
  Users,
  MapPin,
  Globe,
  Check,
  ChevronRight,
  MessageCircle,
  CalendarDays,
  ShieldCheck,
  Banknote,
} from "lucide-react"
import { cn, getStorageUrl } from "@/lib/utils"
import { useAuth } from "@/lib/supabase/auth-context"
import { toast } from "sonner"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReviewCard } from "@/components/review-card"
import { TourBookingCalendar } from "@/components/tour-booking-calendar"
import { GoogleMapEmbed } from "@/components/google-map-embed"
import { Skeleton } from "@/components/ui/skeleton"
import { getStoredUtmParams, pushGa4Event, trackFunnelEvent } from "@/lib/analytics/ga"
import { trackMetaLead } from "@/lib/analytics/meta"
import { buildCityToursPath, buildTourPathFromRecord } from "@/lib/tour-url"
import { buildHighlightFallback, buildRouteSnapshotFallback } from "@/lib/tours/stop-content"
import { resolveTourTimeZone } from "@/lib/timezone"

const PRO_BADGE_EXPLANATION =
  "PRO means this guide is on Touricho's paid Pro plan with extra tools and visibility, not a quality guarantee by itself."
const DEFAULT_WHAT_TO_BRING = "Wear comfortable shoes and bring water, weather protection, and anything you need for a walking tour."
const DEFAULT_CANCELLATION_POLICY = "Cancel at least 24h before the tour start so other travelers can take the available seat."
const DEFAULT_TIP_EXPECTATION =
  "Book free now, tip your guide at the end of the tour."
const DEFAULT_TIP_GUIDANCE =
  "The tip amount is your choice. Guests who enjoy the tour often tip around EUR 10-EUR 20 per adult."

type EnrichedHighlight = {
  title: string
  detail: string
}

function splitDescriptionIntoParagraphs(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function buildTourNarrativeParagraphs(input: {
  description: string
  city: string
  durationLabel: string
  languageLabel: string
  maxCapacity: number
  highlights: string[]
}): string[] {
  const baseParagraphs = splitDescriptionIntoParagraphs(input.description)
  const longDescription =
    baseParagraphs.length > 0
      ? baseParagraphs
      : [
          `This walking tour is designed to help you discover ${input.city} with local context, practical route guidance, and enough time to ask questions throughout the experience.`,
        ]

  const highlightsPreview = input.highlights.slice(0, 3).join(", ")
  const routeParagraph = highlightsPreview
    ? `During this ${input.durationLabel} route, your guide covers key stops such as ${highlightsPreview}. You get historical context, neighborhood orientation, and practical recommendations you can use for the rest of your stay.`
    : `During this ${input.durationLabel} route, your guide adapts pacing to the group and focuses on stories that help first-time and returning visitors understand the city better.`
  const fitParagraph = `This tour is best for travelers who want a reliable introduction to ${input.city} without prepaying. Sessions run in ${input.languageLabel} and are designed for small groups of up to ${input.maxCapacity} guests for better interaction.`

  return [...longDescription, routeParagraph, fitParagraph]
}

function getInitials(name: string | null | undefined): string {
  const text = String(name || "").trim()
  if (!text) return "LG"
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "LG"
}

interface TourSchedule {
  id: string
  start_time: string
  capacity: number
  language: string
  booked_count: number
}

interface TourGuide {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  role: string
  created_at?: string | null
  guide_verified?: boolean | null
  plan_type?: "free" | "pro" | null
  is_pro?: boolean
  verified_badge?: boolean
  first_published_tour_at?: string | null
  total_published_tours?: number | null
  guide_rating?: number | null
  guide_total_reviews?: number | null
}

interface TourReview {
  id: string
  rating: number
  content: string
  title: string
  guide_response?: string
  created_at: string
  tourist: {
    full_name: string
    avatar_url: string | null
  }
}

interface Tour {
  id: string
  title: string
  description: string
  city: string
  city_slug?: string | null
  tour_slug?: string | null
  country: string
  duration_minutes: number
  max_capacity: number
  minimum_attendees?: number | null
  rating: number
  review_count: number
  images: string[]
  languages: string[]
  highlights: string[]
  tour_stops?: Array<{
    id: string
    tour_id: string
    position: number
    stop_name: string
    highlight: string | null
    route_snapshot: string | null
  }>
  included?: string[]
  is_premium?: boolean
  meeting_point: string
  meeting_point_details: string
  what_to_expect?: string | null
  what_to_bring?: string | null
  accessibility_info?: string | null
  cancellation_policy_short?: string | null
  booking_aggregates?: {
    total_reserved_spots?: number | null
    bookings_next_30_days?: number | null
    upcoming_schedule_count?: number | null
    trusted_review_count?: number | null
    verified_booking_signal?: boolean | null
  }
  practical_policies?: {
    minimum_attendees?: number | null
    payment_methods?: string[] | null
    group_policy?: string | null
    accessibility?: string | null
    cancellation_policy_short?: string | null
  }
  guide: TourGuide
  tour_schedules: TourSchedule[]
  reviews: TourReview[]
}

interface ScheduleAvailability {
  max_adults: number
}

interface RelatedTour {
  id: string
  title: string
  city: string
  city_slug?: string | null
  tour_slug?: string | null
  country: string | null
  duration_minutes: number
  max_capacity: number
  languages: string[]
  images: any[]
  photos: any[]
  review_count: number
  average_rating: number
  next_available_start_time: string | null
  next_available_spots: number | null
  is_premium?: boolean
}

function formatScheduleLabel(schedule: TourSchedule, timeZone?: string) {
  const date = new Date(schedule.start_time)
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  })
}

function formatMonthYear(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function normalizeGuidePayload(rawGuide: any): TourGuide {
  return {
    id: String(rawGuide?.id || ""),
    full_name: String(rawGuide?.full_name || "Local Guide"),
    avatar_url: rawGuide?.avatar_url || null,
    bio: rawGuide?.bio || null,
    role: String(rawGuide?.role || "guide"),
    created_at: rawGuide?.created_at || null,
    guide_verified: rawGuide?.guide_verified ?? null,
    plan_type: rawGuide?.plan_type ?? null,
    is_pro: Boolean(rawGuide?.is_pro || rawGuide?.plan_type === "pro"),
    verified_badge: Boolean(rawGuide?.verified_badge),
    first_published_tour_at: rawGuide?.first_published_tour_at || null,
    total_published_tours: Number(rawGuide?.total_published_tours || 0) || null,
    guide_rating: Number(rawGuide?.guide_rating || 0) || null,
    guide_total_reviews: Number(rawGuide?.guide_total_reviews || 0) || null,
  }
}

function normalizeSchedulesPayload(rawSchedules: any[]): TourSchedule[] {
  if (!Array.isArray(rawSchedules)) return []
  return rawSchedules.map((schedule) => ({
    id: String(schedule?.id || ""),
    start_time: String(schedule?.start_time || ""),
    capacity: Number(schedule?.capacity || 0),
    language: String(schedule?.language || "English"),
    booked_count: Number(schedule?.booked_count || 0),
  }))
}

function normalizeTourPayload(rawTour: any): Tour | null {
  if (!rawTour) return null

  const guideRaw = Array.isArray(rawTour.guide) ? rawTour.guide[0] : rawTour.guide
  const normalizedSchedules = normalizeSchedulesPayload(rawTour.tour_schedules || [])
  const normalizedReviews = Array.isArray(rawTour.reviews) ? rawTour.reviews : []
  const maxCapacity = Number(rawTour.max_capacity || rawTour.max_group_size || 0)
  const practicalPolicies = rawTour.practical_policies && typeof rawTour.practical_policies === "object"
    ? rawTour.practical_policies
    : null
  const normalizedMinimumAttendees = Math.max(
    1,
    Number(practicalPolicies?.minimum_attendees ?? rawTour.minimum_attendees ?? 1),
  )

  const normalizeTourStops = () => {
    const rawStops = Array.isArray(rawTour.tour_stops) ? rawTour.tour_stops : []
    if (rawStops.length > 0) {
      return rawStops
        .map((row: any, index: number) => ({
          id: String(row?.id || `${rawTour.id || "tour"}-stop-${index + 1}`),
          tour_id: String(row?.tour_id || rawTour.id || ""),
          position: Number(row?.position || index + 1),
          stop_name: String(row?.stop_name || ""),
          highlight: row?.highlight ? String(row.highlight) : null,
          route_snapshot: row?.route_snapshot ? String(row.route_snapshot) : null,
        }))
        .sort((a: any, b: any) => Number(a.position || 0) - Number(b.position || 0))
    }

    const fallbackHighlights = Array.isArray(rawTour.highlights) ? rawTour.highlights : []
    return fallbackHighlights
      .map((value: unknown) => String(value || "").trim())
      .filter(Boolean)
      .map((stopName: string, index: number) => ({
        id: `${rawTour.id || "tour"}-legacy-stop-${index + 1}`,
        tour_id: String(rawTour.id || ""),
        position: index + 1,
        stop_name: stopName,
        highlight: stopName,
        route_snapshot: null,
      }))
  }

  return {
    id: String(rawTour.id || ""),
    title: String(rawTour.title || ""),
    description: String(rawTour.description || ""),
    city: String(rawTour.city || ""),
    city_slug: rawTour.city_slug || null,
    tour_slug: rawTour.tour_slug || null,
    country: String(rawTour.country || ""),
    duration_minutes: Number(rawTour.duration_minutes || 0),
    max_capacity: maxCapacity,
    minimum_attendees: normalizedMinimumAttendees,
    rating: Number(rawTour.rating || rawTour.average_rating || 0),
    review_count: Number(rawTour.review_count || normalizedReviews.length || 0),
    images:
      Array.isArray(rawTour.images) && rawTour.images.length > 0
        ? rawTour.images
        : Array.isArray(rawTour.photos)
          ? rawTour.photos
          : [],
    languages: Array.isArray(rawTour.languages) ? rawTour.languages : [],
    highlights: Array.isArray(rawTour.highlights) ? rawTour.highlights : [],
    tour_stops: normalizeTourStops(),
    included: Array.isArray(rawTour.included) ? rawTour.included : [],
    is_premium: Boolean(rawTour.is_premium),
    meeting_point: String(rawTour.meeting_point || rawTour.meeting_point_address || ""),
    meeting_point_details: String(rawTour.meeting_point_details || ""),
    what_to_expect: rawTour.what_to_expect || null,
    what_to_bring: rawTour.what_to_bring || null,
    accessibility_info: rawTour.accessibility_info || null,
    cancellation_policy_short: rawTour.cancellation_policy_short || null,
    booking_aggregates: rawTour.booking_aggregates || undefined,
    practical_policies: {
      minimum_attendees: normalizedMinimumAttendees,
      payment_methods:
        Array.isArray(practicalPolicies?.payment_methods) && practicalPolicies.payment_methods.length > 0
          ? practicalPolicies.payment_methods
          : ["Tip after the tour (cash or digital, as accepted by your guide)."],
      group_policy: String(practicalPolicies?.group_policy || "").trim() || `Max ${maxCapacity || 10} guests`,
      accessibility: practicalPolicies?.accessibility || rawTour.accessibility_info || null,
      cancellation_policy_short:
        practicalPolicies?.cancellation_policy_short || rawTour.cancellation_policy_short || DEFAULT_CANCELLATION_POLICY,
    },
    guide: normalizeGuidePayload(guideRaw),
    tour_schedules: normalizedSchedules,
    reviews: normalizedReviews,
  }
}

type TourDetailClientProps = {
  tourId: string
  initialTour?: any
  initialRelatedTours?: RelatedTour[]
  seoH1?: string
}

export default function TourDetailClient({ tourId, initialTour, initialRelatedTours = [], seoH1 }: TourDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, user } = useAuth()
  const initialTourData = useMemo(() => normalizeTourPayload(initialTour), [initialTour])
  const hasInitialRelatedTours = Array.isArray(initialRelatedTours) && initialRelatedTours.length > 0

  const [tour, setTour] = useState<Tour | null>(initialTourData)
  const [schedules, setSchedules] = useState<TourSchedule[]>(() => initialTourData?.tour_schedules || [])
  const [loading, setLoading] = useState(!initialTourData)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [groupSize, setGroupSize] = useState<string>("1")
  const [children, setChildren] = useState<string>("0")
  const [messagingGuide, setMessagingGuide] = useState(false)
  const [scheduleAvailability, setScheduleAvailability] = useState<Record<string, ScheduleAvailability>>({})
  const [relatedTours, setRelatedTours] = useState<RelatedTour[]>(() =>
    Array.isArray(initialRelatedTours) ? initialRelatedTours : [],
  )
  const [relatedLoading, setRelatedLoading] = useState<boolean>(
    () => !(Array.isArray(initialRelatedTours) && initialRelatedTours.length > 0),
  )
  const [isBookingCardInView, setIsBookingCardInView] = useState(false)
  const lastTrackedScheduleRef = useRef<string | null>(null)
  const trustStackTrackedRef = useRef(false)
  const certaintyBlockTrackedRef = useRef(false)
  const routePreviewTrackedRef = useRef(false)

  useEffect(() => {
    if (!initialTourData) return
    setTour(initialTourData)
    setSchedules(initialTourData.tour_schedules || [])
    setLoading(false)
  }, [initialTourData])

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId],
  )
  const handleSelectDate = useCallback(
    (date: Date | null) => {
      setSelectedDate(date)
      if (!date || !tour?.title) return
      pushGa4Event("select_date", {
        item_name: tour.title,
      })
    },
    [tour?.title],
  )

  const nextAvailableSchedule = useMemo(
    () =>
      [...schedules]
        .filter((schedule) => {
          const startMs = new Date(schedule.start_time).getTime()
          return Number.isFinite(startMs) && startMs > Date.now() && (schedule.capacity || 0) - (schedule.booked_count || 0) > 0
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] || null,
    [schedules],
  )

  const nextAvailableSpots = nextAvailableSchedule
    ? Math.max((nextAvailableSchedule.capacity || 0) - (nextAvailableSchedule.booked_count || 0), 0)
    : 0

  useEffect(() => {
    if (selectedScheduleId) {
      fetch(`/api/schedules/availability?schedule_id=${selectedScheduleId}`)
        .then((res) => res.json())
        .then((data) => {
          setScheduleAvailability((prev) => ({ ...prev, [selectedScheduleId]: data }))
          if (typeof data.max_adults === "number") {
            setGroupSize((prev) => {
              const currentAdults = Number.parseInt(prev, 10)
              if (data.max_adults < currentAdults) {
                return Math.max(1, data.max_adults).toString()
              }
              return prev
            })
          }
        })
        .catch(console.error)
    }
  }, [selectedScheduleId])

  useEffect(() => {
    let isMounted = true

    const loadTour = async () => {
      if (!tourId) {
        if (isMounted) {
          setTour(null)
          setLoading(false)
        }
        return
      }
      if (!isMounted) return

      const response = await fetch(`/api/tours/${tourId}`, { cache: "no-store" })
      if (!response.ok) {
        if (isMounted) {
          if (!initialTourData) {
            setTour(null)
            setSchedules([])
          }
          setLoading(false)
        }
        return
      }

      const tourData = normalizeTourPayload(await response.json())
      if (!tourData) {
        if (isMounted) {
          if (!initialTourData) {
            setTour(null)
            setSchedules([])
          }
          setLoading(false)
        }
        return
      }

      if (isMounted) {
        setTour(tourData)
        setSchedules(tourData.tour_schedules || [])
        setLoading(false)
      }
    }

    loadTour()
    return () => {
      isMounted = false
    }
  }, [tourId, initialTourData])

  useEffect(() => {
    if (!tour) return

    trackFunnelEvent("tour_detail_viewed", {
      city: tour.city,
      tour_id: tour.id,
      entry_page: pathname,
    })
    pushGa4Event("view_item", {
      item_name: tour.title,
      item_category: "walking_tour",
      item_variant: tour.city,
    })
  }, [tour, pathname])

  useEffect(() => {
    if (!tour || trustStackTrackedRef.current) return

    const hasReviews = Number(tour.review_count || 0) > 0
    const bookedFromSchedules = Array.isArray(tour.tour_schedules)
      ? tour.tour_schedules.reduce((sum, schedule) => sum + Math.max(Number(schedule.booked_count || 0), 0), 0)
      : 0

    trackFunnelEvent("tour_detail_trust_stack_viewed", {
      city: tour.city,
      tour_id: tour.id,
      has_reviews: hasReviews,
      review_count: Number(tour.review_count || 0),
      booked_spots: bookedFromSchedules,
      has_guide_tenure: Boolean(tour.guide?.first_published_tour_at || tour.guide?.created_at),
    })
    trustStackTrackedRef.current = true
  }, [tour])

  useEffect(() => {
    if (!tour || certaintyBlockTrackedRef.current) return

    trackFunnelEvent("tour_detail_certainty_block_viewed", {
      city: tour.city,
      tour_id: tour.id,
      has_meeting_point: Boolean((tour.meeting_point || "").trim()),
      has_accessibility: Boolean((tour.practical_policies?.accessibility || tour.accessibility_info || "").trim()),
      has_cancellation_policy: Boolean((tour.cancellation_policy_short || "").trim()),
    })
    certaintyBlockTrackedRef.current = true
  }, [tour])

  useEffect(() => {
    if (!tour || routePreviewTrackedRef.current) return

    trackFunnelEvent("tour_detail_route_preview_viewed", {
      city: tour.city,
      tour_id: tour.id,
      highlight_count: Array.isArray(tour.tour_stops) ? tour.tour_stops.length : Array.isArray(tour.highlights) ? tour.highlights.length : 0,
      has_map_preview: Boolean((tour.meeting_point || "").trim()),
    })
    routePreviewTrackedRef.current = true
  }, [tour])

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") return

    const card = document.getElementById("booking-card")
    if (!card) return

    const observer = new window.IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setIsBookingCardInView(Boolean(entry?.isIntersecting))
      },
      {
        threshold: 0.2,
        rootMargin: "-72px 0px -25% 0px",
      },
    )

    observer.observe(card)
    return () => observer.disconnect()
  }, [tour?.id, schedules.length])

  useEffect(() => {
    if (!tour?.id) return

    let isMounted = true
    if (!hasInitialRelatedTours) {
      setRelatedLoading(true)
    }
    const relatedCitySlug =
      String(tour.city_slug || "")
        .trim()
        .toLowerCase() ||
      String(tour.city || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    const params = new URLSearchParams({
      city_slug: relatedCitySlug,
      exclude: tour.id,
      limit: "3",
    })

    fetch(`/api/tours/recommended?${params.toString()}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch related tours")
        return res.json()
      })
      .then((data) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[v0] Related tours response:", data)
        }
        if (isMounted) {
          setRelatedTours(Array.isArray(data) ? data : [])
        }
      })
      .catch((error) => {
        console.error("[v0] Related tours fetch error:", error)
      })
      .finally(() => {
        if (isMounted) setRelatedLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [hasInitialRelatedTours, tour?.city, tour?.city_slug, tour?.id])

  useEffect(() => {
    if (!tour || !selectedScheduleId || !selectedSchedule) return
    if (lastTrackedScheduleRef.current === selectedScheduleId) return

    const slotsLeft = Math.max((selectedSchedule.capacity || 0) - (selectedSchedule.booked_count || 0), 0)

    trackFunnelEvent("booking_slot_selected", {
      city: tour.city,
      tour_id: tour.id,
      schedule_id: selectedScheduleId,
      slot_time: selectedSchedule.start_time,
      slots_left: slotsLeft,
    })
    lastTrackedScheduleRef.current = selectedScheduleId
  }, [tour, selectedScheduleId, selectedSchedule])

  const handleBooking = async () => {
    if (bookingLoading) return

    pushGa4Event("begin_checkout", {
      item_name: tour?.title || "Tour",
    })

    if (!session) {
      trackFunnelEvent("auth_started", {
        city: tour?.city,
        tour_id: tour?.id,
        entry_page: pathname,
      })
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    if (!selectedDate || !selectedScheduleId) {
      toast.error("Please complete your selection", {
        description: "Choose a date and time for your tour",
      })
      return
    }

    const adults = Number.parseInt(groupSize, 10)
    const childrenCount = Number.parseInt(children, 10)
    const totalGuests = adults + childrenCount

    if (totalGuests === 0) {
      toast.error("Invalid group size", {
        description: "Please select at least one adult",
      })
      return
    }

    if (selectedSchedule) {
      const remainingCapacity = (selectedSchedule.capacity || 0) - (selectedSchedule.booked_count || 0)
      if (totalGuests > remainingCapacity) {
        toast.error("Not enough capacity", {
          description: `Only ${remainingCapacity} spot${remainingCapacity === 1 ? "" : "s"} available`,
        })
        return
      }
    }

    trackFunnelEvent("booking_started", {
      city: tour?.city,
      tour_id: tour?.id,
      schedule_id: selectedScheduleId,
      adults,
      children: childrenCount,
    })

    setBookingLoading(true)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: selectedScheduleId,
          adults,
          children: childrenCount,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.message || "Booking failed")
      }

      toast.success("Booking confirmed!", {
        description: "Check your bookings page for details.",
      })
      trackFunnelEvent("booking_completed", {
        city: tour?.city,
        tour_id: tour?.id,
        schedule_id: selectedScheduleId,
        adults,
        children: childrenCount,
      })
      const utmParams = getStoredUtmParams()
      pushGa4Event("generate_lead", {
        item_name: tour?.title || "Tour",
        currency: "EUR",
        value: 0,
        ...utmParams,
      })
      trackMetaLead({
        currency: "EUR",
        value: 0,
        content_name: tour?.title || "Tour",
      })

      router.push("/bookings")
    } catch (error) {
      console.error("[v0] Booking error:", error)
      toast.error("Booking failed", {
        description: error instanceof Error ? error.message : "Unable to complete booking",
      })
    } finally {
      setBookingLoading(false)
    }
  }

  const handleMessageGuide = async () => {
    if (!session || !user) {
      router.push("/login")
      return
    }

    if (!tour || !tour.guide?.id) {
      toast.error("Error", { description: "Guide information not available" })
      return
    }

    setMessagingGuide(true)
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourist_id: user.id,
          guide_id: tour.guide.id,
          tour_id: tour.id,
        }),
      })

      if (!res.ok) throw new Error("Failed to create conversation")
      const conversation = await res.json()
      router.push(`/messages?conversation_id=${conversation.id}`)
    } catch (error) {
      console.error("Message guide error:", error)
      toast.error("Error", { description: "Failed to open messages" })
    } finally {
      setMessagingGuide(false)
    }
  }

  if (loading) {
    return (
      <div className="public-template-page landing-template flex min-h-screen flex-col">
        <Navbar variant="landingTemplate" />
        <main className="flex-1">
          <div className="public-section-soft border-b border-[color:var(--landing-border)]">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
              <Skeleton className="h-5 w-56" />
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="aspect-[4/3] rounded-xl md:col-span-2 lg:row-span-2 lg:h-[420px]" />
              <Skeleton className="hidden aspect-[4/3] rounded-xl lg:block" />
              <Skeleton className="hidden aspect-[4/3] rounded-xl lg:block" />
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Skeleton className="h-9 w-4/5" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
              <Card className="public-shell-card shadow-lg">
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-44 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer variant="landingTemplate" />
      </div>
    )
  }

  if (!tour) {
    return (
      <div className="public-template-page landing-template flex min-h-screen flex-col">
        <Navbar variant="landingTemplate" />
        <main className="flex flex-1 items-center justify-center px-4 py-20">
          <Card className="public-shell-card w-full max-w-xl text-center">
            <CardHeader>
              <CardTitle className="public-template-heading text-2xl">Tour Not Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="public-template-copy">
                This tour may have been unpublished or removed. Browse other local experiences nearby.
              </p>
              <Button asChild className="landing-btn-coral">
                <Link href="/tours">Browse Tours</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer variant="landingTemplate" />
      </div>
    )
  }

  const safeStops = Array.isArray(tour.tour_stops) ? tour.tour_stops : []
  const safeHighlights: string[] = safeStops.map((stop) => String(stop?.stop_name || "").trim()).filter(Boolean)
  const safeIncluded: string[] = Array.isArray(tour.included) ? tour.included : []
  const safeReviews: TourReview[] = Array.isArray(tour.reviews) ? tour.reviews : []
  const reviewCount = Math.max(Number(tour.review_count || 0), safeReviews.length)
  const reviewCountLabel = `${reviewCount} review${reviewCount === 1 ? "" : "s"}`
  const averageRating = Number(tour.rating || 0) > 0
    ? Number(tour.rating || 0)
    : safeReviews.length > 0
      ? Number((safeReviews.reduce((acc, r) => acc + (r.rating || 0), 0) / safeReviews.length).toFixed(1))
      : 0

  const rawImages = Array.isArray(tour.images) && tour.images.length > 0 ? tour.images : (tour as any).photos || []
  const processedImages: string[] =
    Array.isArray(rawImages) && rawImages.length > 0
      ? rawImages
          .map((img: any) => (typeof img === "string" ? img : img?.url))
          .filter(Boolean)
          .map((img) => getStorageUrl(img))
      : []

  const safeImages = processedImages.length > 0 ? processedImages : ["/placeholder.svg"]
  const safeLanguages: string[] = Array.isArray(tour.languages) ? tour.languages : []
  const maxCapacity = tour.max_capacity ?? 10
  const selectedMaxAdults = selectedScheduleId ? scheduleAvailability[selectedScheduleId]?.max_adults : undefined
  const maxAdultsForSelection = Math.max(1, Math.min(maxCapacity, selectedMaxAdults ?? maxCapacity))
  const selectedScheduleSpots = selectedSchedule
    ? Math.max((selectedSchedule.capacity || 0) - (selectedSchedule.booked_count || 0), 0)
    : null
  const selectedGuests = Number.parseInt(groupSize, 10) + Number.parseInt(children, 10)
  const displayCity = tour.city
    ? tour.city.charAt(0).toUpperCase() + tour.city.slice(1)
    : "this city"
  const tourTimeZone = resolveTourTimeZone({
    citySlug: tour.city_slug,
    city: tour.city,
    country: tour.country,
  })
  const cityToursHref = buildCityToursPath(tour.city_slug || tour.city || "city")
  const guideReviewCount = Number(tour.guide?.guide_total_reviews || 0)
  const guideRating =
    typeof tour.guide?.guide_rating === "number" ? Number(tour.guide.guide_rating.toFixed(1)) : null
  const durationLabel = `${tour.duration_minutes ?? 90} minutes`
  const meetingPointSummary = (tour.meeting_point || "").trim() || "Shared after booking"
  const compactMeetingPoint = meetingPointSummary.split(",")[0]?.trim() || meetingPointSummary
  const languageLabel = safeLanguages.length > 0 ? safeLanguages.join(", ") : "Language details shared by guide"
  const whatToExpectText = (tour.what_to_expect || "").trim()
  const whatToBringText = (tour.what_to_bring || "").trim() || DEFAULT_WHAT_TO_BRING
  const cancellationPolicyText =
    (tour.practical_policies?.cancellation_policy_short || tour.cancellation_policy_short || "").trim() ||
    DEFAULT_CANCELLATION_POLICY
  const paymentMethods = Array.isArray(tour.practical_policies?.payment_methods) && tour.practical_policies?.payment_methods.length > 0
    ? tour.practical_policies.payment_methods
    : ["Tip at the end of the tour (cash or digital, based on your guide's options)."]
  const minimumAttendees = Math.max(1, Number(tour.practical_policies?.minimum_attendees || 1))
  const groupPolicySummary =
    (tour.practical_policies?.group_policy || "").trim() || `Adults 15+, children under 15, max ${maxCapacity} guests.`
  const accessibilitySummary = (tour.practical_policies?.accessibility || tour.accessibility_info || "").trim()

  const guideSinceValue = tour.guide?.first_published_tour_at || tour.guide?.created_at || null
  const guideSinceLabel = formatMonthYear(guideSinceValue)
  const guidePublishedToursCount = Math.max(Number(tour.guide?.total_published_tours || 0), 0)
  const hasGuideVerifiedBadge = Boolean(tour.guide?.verified_badge || tour.guide?.guide_verified)

  const routePreviewStops = safeStops.slice(0, 6)
  const enrichedHighlights: EnrichedHighlight[] = safeStops.map((stop) => {
    const stopName = String(stop?.stop_name || "").trim()
    const highlightText = String(stop?.highlight || "").trim()
    return {
      title: stopName,
      detail: highlightText || buildHighlightFallback(stopName, displayCity),
    }
  })
  const aboutTourParagraphs = buildTourNarrativeParagraphs({
    description: tour.description || "",
    city: displayCity,
    durationLabel,
    languageLabel,
    maxCapacity,
    highlights: safeHighlights,
  })
  const isMontmartreCanonicalTour =
    String(tour.city_slug || "").toLowerCase() === "paris" &&
    String(tour.tour_slug || "").toLowerCase() === "montmartre-walking-tour"
  const selectedScheduleLanguage = selectedSchedule?.language || safeLanguages[0] || "Language shown on selected slot"
  const bookingSummarySchedule = selectedSchedule ? formatScheduleLabel(selectedSchedule, tourTimeZone) : null

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />

      <main className="public-template-main flex-1">
        {/* Breadcrumb */}
        <div className="public-section-soft border-b border-[color:var(--landing-border)]">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-2 text-sm text-[color:var(--landing-muted)]">
              <Link href="/" className="transition-colors hover:text-[color:var(--landing-ink)]">
                Home
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link href="/tours" className="transition-colors hover:text-[color:var(--landing-ink)]">
                Tours
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link href={cityToursHref} className="transition-colors hover:text-[color:var(--landing-ink)]">
                {displayCity}
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="max-w-[200px] truncate text-[color:var(--landing-ink)]">{tour.title}</span>
            </nav>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-xl md:col-span-2",
              safeImages.length >= 3 && "lg:row-span-2 lg:aspect-auto lg:h-full"
            )}>
              <Image
                src={safeImages[0]}
                alt={tour.title || "Tour Image"}
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
                priority
              />
              {tour.is_premium && (
                <Badge className="absolute left-4 top-4 gap-1 bg-secondary text-secondary-foreground">
                  Sponsored Ad
                </Badge>
              )}
            </div>
            {safeImages.slice(1, 3).map((image: string, index: number) => (
              <div key={index} className="relative hidden aspect-[4/3] overflow-hidden rounded-xl lg:block">
                <Image
                  src={image}
                  alt={`${tour.title} - Image ${index + 2}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 22vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:pb-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Header */}
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {tour.city}, {tour.country}
                </div>
                <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {seoH1 || `${tour.title} in ${displayCity}`}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {reviewCount > 0 ? (
                    <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                      <Star className="h-5 w-5 fill-chart-3 text-chart-3" />
                      <span className="font-semibold text-foreground">{averageRating}</span>
                      <span className="text-muted-foreground">({reviewCountLabel})</span>
                    </div>
                  ) : (
                    <Badge className="rounded-full bg-primary/10 text-primary">New tour</Badge>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {durationLabel}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Max {tour.max_capacity ?? 10} people
                  </div>
                  {safeLanguages.length > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      {safeLanguages.join(", ")}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild variant="outline" className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]">
                    <a href="#booking-card">Check availability</a>
                  </Button>
                  <Button asChild variant="outline" className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]">
                    <Link href={cityToursHref}>Back to tours in {displayCity}</Link>
                  </Button>
                </div>

                {nextAvailableSchedule && (
                  <div className="public-shell-card-muted mt-6 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <CalendarDays className="mt-0.5 h-5 w-5 text-secondary" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Next available slot</p>
                          <p className="text-sm text-muted-foreground">{formatScheduleLabel(nextAvailableSchedule, tourTimeZone)}</p>
                          <p className="text-xs text-secondary">
                            {nextAvailableSpots} seat{nextAvailableSpots === 1 ? "" : "s"} left
                          </p>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full border-[color:var(--landing-border-2)] bg-[color:var(--landing-surface)] text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)] sm:w-auto">
                        <a href="#booking-card">View availability</a>
                      </Button>
                    </div>
                  </div>
                )}

                {!nextAvailableSchedule && (
                  <div className="mt-6 rounded-lg border border-amber-300/50 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-100">
                    Dates updating soon — check back shortly or message the guide.
                  </div>
                )}
              </div>

              <div className="mb-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-secondary" />
                    Start Point
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{compactMeetingPoint}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Full meeting details are visible in the meeting-point tab and after booking.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-secondary" />
                    Group Rules
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">Max {maxCapacity} people</p>
                  <p className="mt-1 text-xs text-muted-foreground">Adults are 15 or older. Children are under 15.</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-secondary" />
                    Tour Duration
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{durationLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Plan comfortable shoes and weather-ready clothing.</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Globe className="h-3.5 w-3.5 text-secondary" />
                    Languages
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{languageLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choose the best schedule/language combination in booking.</p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="overview" className="mb-8">
                <TabsList className="grid w-full grid-cols-3 rounded-xl border border-border bg-muted/50 p-1">
                  <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    id="reviews-tab-trigger"
                    value="reviews"
                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Reviews{reviewCount > 0 ? ` (${reviewCount})` : ""}
                  </TabsTrigger>
                  <TabsTrigger value="meeting" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Meeting Point
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-8">
                  {/* Description */}
                  <div className="rounded-xl border border-border/60 bg-card p-5">
                    <h2 className="mb-4 text-xl font-semibold text-foreground">About This Tour</h2>
                    <div className="space-y-3">
                      {aboutTourParagraphs.map((paragraph) => (
                        <p key={paragraph} className="leading-relaxed text-muted-foreground">
                          {paragraph}
                        </p>
                      ))}
                      {isMontmartreCanonicalTour ? (
                        <p className="pt-1 text-sm text-muted-foreground">
                          <Link href="/blog/how-much-to-tip-tour-guide-paris" className="hover:underline">
                            Wondering how much to tip? Read our tipping guide →
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Highlights */}
                  {enrichedHighlights.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card p-5">
                      <h2 className="mb-4 text-xl font-semibold text-foreground">Tour Highlights</h2>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {enrichedHighlights.map((highlight, index) => (
                          <li key={`${highlight.title}-${index}`} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <Check className="h-3 w-3 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{highlight.title}</p>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{highlight.detail}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {routePreviewStops.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card p-5">
                      <h2 className="mb-4 text-xl font-semibold text-foreground">Route Snapshot</h2>
                      <ol className="grid gap-3 sm:grid-cols-2">
                        {routePreviewStops.map((stop, index) => {
                          const stopName = String(stop?.stop_name || "").trim() || `Stop ${index + 1}`
                          const routeSnapshotText = String(stop?.route_snapshot || "").trim()
                          const routeDescription = routeSnapshotText || buildRouteSnapshotFallback(stopName, displayCity)
                          return (
                            <li
                              key={`${stop?.id || stopName}-${index}`}
                              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                            >
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                {index + 1}
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">{stopName}</p>
                                <p className="text-sm leading-relaxed text-muted-foreground">{routeDescription}</p>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  )}

                  {/* What's Included */}
                  {safeIncluded.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card p-5">
                      <h2 className="mb-4 text-xl font-semibold text-foreground">What's Included</h2>
                      <ul className="space-y-2">
                        {safeIncluded.map((item: string, index: number) => (
                          <li key={index} className="flex items-center gap-3">
                            <Check className="h-3 w-3 text-primary" />
                            <span className="text-sm text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-xl border border-border/60 bg-card p-5">
                    <h2 className="mb-4 text-xl font-semibold text-foreground">What to Know Before You Go</h2>
                    <div className={`grid gap-4 ${whatToExpectText ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
                      {whatToExpectText && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                          <p className="text-sm font-semibold text-foreground">What to expect</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{whatToExpectText}</p>
                        </div>
                      )}
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <p className="text-sm font-semibold text-foreground">What to bring / wear</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{whatToBringText}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <ShieldCheck className="h-4 w-4 text-secondary" />
                          Cancellation policy
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cancellationPolicyText}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <Banknote className="h-4 w-4 text-secondary" />
                          Tip timing and payment
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{DEFAULT_TIP_EXPECTATION}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{DEFAULT_TIP_GUIDANCE}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent id="reviews-section" value="reviews" className="mt-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">Guest Reviews</h2>
                    {reviewCount > 0 ? (
                      <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                        <Star className="h-5 w-5 fill-chart-3 text-chart-3" />
                        <span className="text-lg font-semibold text-foreground">{averageRating}</span>
                        <span className="text-muted-foreground">({reviewCountLabel})</span>
                      </div>
                    ) : (
                      <Badge className="rounded-full bg-primary/10 text-primary">New tour</Badge>
                    )}
                  </div>
                  {reviewCount > 0 ? (
                    <div className="space-y-4">
                      {safeReviews.map((review: TourReview) => (
                        <ReviewCard
                          key={review.id}
                          id={review.id}
                          authorName={review.tourist?.full_name || "Anonymous User"}
                          authorAvatar={review.tourist?.avatar_url || null}
                          rating={review.rating}
                          date={new Date(review.created_at).toLocaleDateString()}
                          content={review.content}
                          tourTitle={tour.title}
                          city={tour.city}
                          guideResponse={review.guide_response}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card className="border-border/60">
                      <CardContent className="p-5">
                        <p className="text-sm text-muted-foreground">
                          This tour is new on Touricho. Review history will appear after the first completed bookings.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="meeting" className="mt-6">
                  <div className="space-y-6">
                    <div>
                      <h2 className="mb-4 text-xl font-semibold text-foreground">Meeting Point</h2>
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <MapPin className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{tour.meeting_point || "TBD"}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {tour.meeting_point_details || "Details will be provided after booking"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {tour.meeting_point && (
                      <GoogleMapEmbed address={tour.meeting_point} height={360} />
                    )}

                    {tour.meeting_point && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tour.meeting_point)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" className="gap-2 bg-transparent">
                          <MapPin className="h-4 w-4" />
                          Open in Google Maps
                        </Button>
                      </a>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Guide Info */}
              {tour.guide && (
                <Card className="border-border/60 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Meet Your Guide</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={tour.guide.avatar_url || undefined} alt={tour.guide.full_name || "Anonymous Guide"} />
                        <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                          {getInitials(tour.guide.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">{tour.guide.full_name || "Deleted Guide"}</h3>
                          {(tour.guide.is_pro || tour.guide.plan_type === "pro") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  tabIndex={0}
                                  className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary"
                                >
                                  Pro
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-64 leading-relaxed" sideOffset={6}>
                                {PRO_BADGE_EXPLANATION}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Local Guide in {displayCity}
                        </p>
                        {safeLanguages.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {safeLanguages.slice(0, 3).map((language) => (
                              <Badge key={language} variant="outline">
                                {language}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {tour.guide.bio || "Experienced tour guide"}
                        </p>
                        {(guideRating || guideReviewCount > 0) && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {guideRating ? `Guide rating ${guideRating}` : "Guide profile active"}{guideReviewCount > 0 ? ` · ${guideReviewCount} total reviews` : ""}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {guideSinceLabel ? `Hosting on Touricho since ${guideSinceLabel}` : "Local guide on Touricho"}
                          {guidePublishedToursCount > 0 ? ` · ${guidePublishedToursCount} published tour${guidePublishedToursCount === 1 ? "" : "s"}` : ""}
                          {hasGuideVerifiedBadge ? " · Identity verified" : ""}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 gap-2"
                          onClick={handleMessageGuide}
                          disabled={messagingGuide}
                        >
                          <MessageCircle className="h-4 w-4" />
                          {messagingGuide ? "Opening..." : "Message Guide"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>

            {/* Booking Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <Card id="booking-card" className="public-shell-card shadow-lg">
                  <CardHeader className="border-b border-border pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Free Tour</p>
                        <p className="text-2xl font-bold text-foreground">Reserve Your Spot for Free</p>
                        <p className="mt-1 text-xs text-muted-foreground">No upfront payment. Book free now, tip your guide at the end of the tour.</p>
                      </div>
                    </div>
                    {nextAvailableSchedule && (
                      <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next available</p>
                        <p className="text-sm font-semibold text-foreground">{formatScheduleLabel(nextAvailableSchedule, tourTimeZone)}</p>
                        <p className="text-xs text-secondary">
                          {nextAvailableSpots} seat{nextAvailableSpots === 1 ? "" : "s"} left
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {schedules.length > 0 ? (
                        <>
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="flex items-start justify-between gap-3">
                              {reviewCount > 0 ? (
                                <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
                                  <Star className="h-4 w-4 fill-chart-3 text-chart-3" />
                                  <span className="font-medium text-foreground">{averageRating}</span>
                                  <span>({reviewCountLabel})</span>
                                </div>
                              ) : (
                                <p className="text-sm font-medium text-primary">New tour</p>
                              )}
                              <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-1.5">
                                {hasGuideVerifiedBadge ? (
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    ID verified
                                  </Badge>
                                ) : (tour.guide?.is_pro || tour.guide?.plan_type === "pro") ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="cursor-help text-[10px] uppercase tracking-wide">
                                        Pro guide
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-64 leading-relaxed" sideOffset={6}>
                                      {PRO_BADGE_EXPLANATION}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                                {tour.booking_aggregates?.verified_booking_signal && (
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    Trusted bookings
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--landing-accent)]">Step 1</p>
                            <p className="text-sm font-semibold text-foreground">Select Travel Date &amp; Time</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Choose your preferred slot first to unlock your booking summary.
                            </p>
                          </div>

                          <TourBookingCalendar
                            schedules={schedules}
                            onSelectDate={handleSelectDate}
                            onSelectSchedule={setSelectedScheduleId}
                            selectedDate={selectedDate}
                            selectedScheduleId={selectedScheduleId}
                            tourTimeZone={tourTimeZone}
                          />

                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2</p>
                            <p className="text-sm font-semibold text-foreground">Choose Guests</p>
                            <div className="space-y-4 pt-3">
                              <div>
                                <Label htmlFor="adults-select" className="mb-2 block text-sm font-medium">Adults (15+)</Label>
                                <Select value={groupSize} onValueChange={setGroupSize}>
                                  <SelectTrigger id="adults-select">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: maxAdultsForSelection }, (_, i) => i + 1).map((num) => (
                                      <SelectItem key={num} value={num.toString()}>
                                        {num} {num === 1 ? "adult" : "adults"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {selectedScheduleId && selectedMaxAdults !== undefined && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Max {selectedMaxAdults} adults available
                                  </p>
                                )}
                              </div>

                              <div>
                                <Label htmlFor="children-select" className="mb-2 block text-sm font-medium">Children (&lt;15)</Label>
                                <Select value={children} onValueChange={setChildren}>
                                  <SelectTrigger id="children-select">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(
                                      { length: Math.min(10, Math.max(0, maxCapacity - Number.parseInt(groupSize, 10) + 1)) },
                                      (_, i) => i,
                                    ).map((num) => (
                                      <SelectItem key={num} value={num.toString()}>
                                        {num} {num === 1 ? "child" : num === 0 ? "no children" : "children"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="rounded-lg bg-background/80 p-3">
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">Total guests: </span>
                                  {selectedGuests} {selectedGuests === 1 ? "person" : "people"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Adults are 15 years and older. Children are under 15.</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--landing-accent)]">Step 3</p>
                            <p className="text-sm font-semibold text-foreground">Review &amp; Reserve</p>
                            {bookingSummarySchedule ? (
                              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">Date & time:</span> {bookingSummarySchedule}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Language:</span> {selectedScheduleLanguage}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Guests:</span> {selectedGuests}{" "}
                                  {selectedGuests === 1 ? "person" : "people"}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Meeting point:</span> {compactMeetingPoint}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Select date, time, and guests to unlock your final reservation summary.
                              </p>
                            )}
                            {selectedScheduleSpots !== null && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {selectedScheduleSpots > 0 ? (
                                  <>
                                    Only{" "}
                                    <span className="font-semibold text-foreground">
                                      {selectedScheduleSpots} seat{selectedScheduleSpots === 1 ? "" : "s"}
                                    </span>{" "}
                                    left for your selected slot.
                                  </>
                                ) : (
                                  "This time is currently full. Select another slot."
                                )}
                              </p>
                            )}
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
                              Book free now, tip your guide at the end of the tour.
                            </p>
                            <p className="text-xs text-muted-foreground">{DEFAULT_TIP_GUIDANCE}</p>
                            <a href="#reviews-tab-trigger" className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">
                              Read reviews first
                            </a>
                          </div>

                          <Button
                            className="landing-btn-coral w-full"
                            size="lg"
                            onClick={handleBooking}
                            disabled={bookingLoading || !selectedDate || !selectedScheduleId}
                          >
                            {bookingLoading ? "Booking..." : "Reserve Your Spot for Free"}
                          </Button>
                        </>
                      ) : (
                        <div className="py-6 text-center">
                          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                          <p className="text-sm font-medium text-foreground mb-1">No available times yet</p>
                          <p className="text-xs text-muted-foreground mb-4">Check back soon for tour dates</p>
                          <Button variant="outline" className="w-full bg-transparent" asChild>
                            <Link href="/tours">Browse Other Tours</Link>
                          </Button>
                        </div>
                      )}
                      <p className="text-center text-xs text-muted-foreground">
                        Free reservation with no upfront payment. Book free now, tip your guide at the end of the tour.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">Plan Your Tour</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Practical details are here when you need them, without interrupting booking.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route and stops</p>
                {routePreviewStops.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {routePreviewStops.map((stop, index) => {
                      const stopName = String(stop?.stop_name || "").trim() || `Stop ${index + 1}`
                      const routeSnapshotText = String(stop?.route_snapshot || "").trim()
                      const routeDescription = routeSnapshotText || buildRouteSnapshotFallback(stopName, displayCity)
                      return (
                      <li key={`${stop?.id || stopName}-${index}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span>
                          <span className="font-semibold text-foreground">{stopName}</span>
                          <span className="block text-muted-foreground">{routeDescription}</span>
                        </span>
                      </li>
                    )})}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    The guide will confirm the detailed route after reservation.
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before you go</p>
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                    <span>Meeting point: {compactMeetingPoint}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                    <span>Duration: {durationLabel}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                    <span>{groupPolicySummary} · Minimum attendees: {minimumAttendees}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                    <span>{cancellationPolicyText}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                    <span>{paymentMethods[0]}</span>
                  </p>
                  {accessibilitySummary && (
                    <p className="flex items-start gap-1.5">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                      <span>Accessibility: {accessibilitySummary}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">More Tours in {displayCity}</h2>
                <p className="text-sm text-muted-foreground">
                  Similar experiences nearby with direct internal links.
                </p>
              </div>
                  <Button asChild variant="outline" className="w-full border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)] sm:w-auto">
                    <Link href={cityToursHref}>Browse All {displayCity} Tours</Link>
                  </Button>
            </div>

            {relatedLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Card key={idx} className="border-border/50">
                    <CardContent className="p-4">
                      <Skeleton className="mb-3 h-36 w-full rounded-lg" />
                      <Skeleton className="mb-2 h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : relatedTours.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedTours.slice(0, 3).map((relatedTour) => {
                  const rawImage = relatedTour.photos?.[0] || relatedTour.images?.[0]
                  const imagePath = typeof rawImage === "string" ? rawImage : rawImage?.url
                  const relatedImage = getStorageUrl(imagePath)
                  return (
                    <Card key={relatedTour.id} className="overflow-hidden border-border/50 transition-colors hover:border-primary/30">
                      <Link href={buildTourPathFromRecord(relatedTour)} className="block">
                        <div className="relative aspect-[16/9]">
                          <Image
                            src={relatedImage}
                            alt={relatedTour.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 50vw"
                            className="object-cover"
                          />
                        </div>
                      </Link>
                      <CardContent className="p-4">
                        <Link href={buildTourPathFromRecord(relatedTour)} className="group inline-block">
                          <h3 className="line-clamp-2 text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                            {relatedTour.title}
                          </h3>
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {Number(relatedTour.review_count || 0) > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-chart-3 text-chart-3" />
                              {relatedTour.average_rating} ({relatedTour.review_count})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                              New tour
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {relatedTour.duration_minutes} min
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Max {relatedTour.max_capacity}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <Button asChild size="sm" variant="outline" className="bg-transparent">
                            <Link href={buildTourPathFromRecord(relatedTour)}>View Tour</Link>
                          </Button>
                          {relatedTour.is_premium ? (
                            <span className="text-xs font-medium uppercase tracking-wide text-secondary">
                              Ad · Boosted
                            </span>
                          ) : relatedTour.next_available_start_time ? (
                            <span className="text-xs text-secondary">{relatedTour.next_available_spots} left</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Check availability</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="flex flex-col items-start gap-3 p-5">
                  <p className="text-sm text-muted-foreground">
                    No similar tours are published in {displayCity} yet.
                  </p>
                  <Button asChild variant="outline" className="bg-transparent">
                    <Link href={cityToursHref}>Browse All {displayCity} Tours</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>

      {schedules.length > 0 && !isBookingCardInView && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Book this tour</p>
              <p className="truncate text-sm font-medium text-foreground">
                {selectedSchedule
                  ? formatScheduleLabel(selectedSchedule, tourTimeZone)
                  : nextAvailableSchedule
                    ? `Next: ${formatScheduleLabel(nextAvailableSchedule, tourTimeZone)}`
                    : "Select your date and time"}
              </p>
            </div>
            {selectedDate && selectedScheduleId ? (
              <Button onClick={handleBooking} disabled={bookingLoading}>
                {bookingLoading ? "Booking..." : "Reserve Your Spot for Free"}
              </Button>
            ) : (
              <Button asChild variant="outline" className="bg-transparent">
                <a href="#booking-card">Choose Date & Time</a>
              </Button>
            )}
          </div>
        </div>
      )}

      <Footer variant="landingTemplate" />
    </div>
  )
}
