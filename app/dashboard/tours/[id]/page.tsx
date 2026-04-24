"use client"

/**
 * Tour edit wizard. Mirrors app/dashboard/tours/new/page.tsx in layout and
 * validation (react-hook-form + zod, horizontal stepper, step-level validation)
 * but differs in three ways:
 *   - Initial values come from the server (/api/tours/[id] + /api/schedules),
 *     not from localStorage. There is no draft persistence here.
 *   - Schedule changes are synced as a diff against the originals loaded at
 *     mount (create / update / delete), not a blanket replace.
 *   - Submit is a PATCH flow against /api/tours/[id] with a two-phase image
 *     reconciliation (first drop removed URLs, then upload new files).
 */

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  MapPin,
  Save,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  QrCode,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/supabase/auth-context"
import { useUserStore } from "@/store/user-store"
import { RecurringScheduleBuilder } from "@/components/recurring-schedule-builder"
import { PlacesAutocompleteInput } from "@/components/places-autocomplete-input"
import { GoogleMapEmbed } from "@/components/google-map-embed"
import { LoadingSpinner } from "@/components/loading-spinner"
import { compressTourImageForUpload, type TourImageCompressionStats } from "@/lib/images/client-compression"
import { TOUR_IMAGE_POLICY, formatBytes, medianBytes } from "@/lib/images/policy"
import { normalizeSeoKeywords } from "@/lib/tours/seo-quality"
import {
  countFutureSchedules,
  DESCRIPTION_MIN_MESSAGE,
  GUIDE_BIO_MIN_CHARS,
  GUIDE_BIO_MIN_MESSAGE,
  MIN_FUTURE_SCHEDULES_FOR_PUBLISH,
  MIN_FUTURE_SCHEDULES_MESSAGE,
  MIN_STOPS_FOR_PUBLISH,
  MIN_STOPS_MESSAGE,
  TOUR_DESCRIPTION_MIN_CHARS,
} from "@/lib/tours/publish-rules"

const languages = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Russian",
  "Chinese",
  "Japanese",
  "Korean",
  "Arabic",
]

const categories = [
  "History & Culture",
  "Art & Architecture",
  "Food & Drink",
  "Nature & Parks",
  "Nightlife",
  "Street Art",
  "Photography",
  "Hidden Gems",
  "Religious Sites",
]

const scheduleSchema = z.object({
  id: z.string(),
  language: z.string(),
  time: z.string().min(1, "Time is required"),
  capacity: z.number().min(1, "At least 1"),
  recurrence: z.enum(["once", "weekly", "daily"]),
  startDate: z.string().min(1, "Date is required"),
  endDate: z.string().optional(),
  daysOfWeek: z.array(z.number()).optional(),
})

const tourFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    city: z.string().min(1, "Please select a city"),
    duration: z.string().min(1, "Please select a duration"),
    maxGroupSize: z.string().min(1, "Please select a group size"),
    minimumAttendees: z
      .string()
      .regex(/^\d+$/, "Enter a whole number")
      .refine((v) => parseInt(v, 10) >= 1, "Must be at least 1"),
    languages: z.array(z.string()).min(1, "Select at least one language"),
    categories: z.array(z.string()).min(1, "Select at least one category"),
    description: z.string().trim().min(1, "Description is required"),
    seoKeywords: z.string().default(""),
    highlights: z.array(z.string()).default([""]),
    whatToExpect: z.string().default(""),
    whatToBring: z.string().default(""),
    accessibility_info: z.string().default(""),
    schedules: z.array(scheduleSchema).default([]),
    meetingPoint: z.string().trim().min(1, "Meeting point is required"),
    meetingPointDetails: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    const max = parseInt(data.maxGroupSize, 10)
    const min = parseInt(data.minimumAttendees, 10)
    if (Number.isFinite(max) && Number.isFinite(min) && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimumAttendees"],
        message: `Minimum attendees cannot exceed maximum group size (${max})`,
      })
    }
  })

type TourFormData = z.infer<typeof tourFormSchema>

interface ScheduleRow {
  id: string
  language: string
  time: string
  capacity: number
  recurrence: "once" | "weekly" | "daily"
  startDate: string
  endDate?: string
  daysOfWeek?: number[]
}

interface TourImageUploadItem {
  url: string
  file?: File
  stats?: TourImageCompressionStats
}

const defaultFormValues: TourFormData = {
  title: "",
  city: "",
  duration: "",
  maxGroupSize: "",
  minimumAttendees: "1",
  languages: [],
  categories: [],
  description: "",
  seoKeywords: "",
  highlights: [""],
  whatToExpect: "",
  whatToBring: "",
  accessibility_info: "",
  schedules: [],
  meetingPoint: "",
  meetingPointDetails: "",
}

const stepFieldMap: Record<number, (keyof TourFormData)[]> = {
  1: ["title", "city", "duration", "maxGroupSize", "minimumAttendees", "languages", "categories"],
  2: ["description"],
  4: ["schedules"],
  5: ["meetingPoint"],
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

function isNewScheduleId(id: string) {
  return id.startsWith("schedule_") || id.startsWith("temp_")
}

export default function EditTourPage() {
  const router = useRouter()
  const params = useParams()
  const { profile } = useAuth()
  const planType = useUserStore((s) => s.planType)
  const planLoading = useUserStore((s) => s.planLoading)
  const tourId = params.id as string

  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [images, setImages] = useState<TourImageUploadItem[]>([])
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagesError, setImagesError] = useState<string | null>(null)
  const [availableCities, setAvailableCities] = useState<
    { slug: string; name: string; country: string }[]
  >([])
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<string[]>([])
  const [originalSchedules, setOriginalSchedules] = useState<ScheduleRow[]>([])

  const [tourQrUrl, setTourQrUrl] = useState<string | null>(null)
  const [tourQrLoading, setTourQrLoading] = useState(false)
  const [tourQrError, setTourQrError] = useState<string | null>(null)
  const [tourQrCopied, setTourQrCopied] = useState(false)

  const form = useForm<TourFormData>({
    resolver: zodResolver(tourFormSchema) as Resolver<TourFormData>,
    defaultValues: defaultFormValues,
    mode: "onTouched",
  })
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    trigger,
    reset,
    formState: { errors },
  } = form

  const highlights = watch("highlights")
  const schedules = watch("schedules")
  const selectedLanguages = watch("languages")
  const selectedCategories = watch("categories")
  const title = watch("title")
  const city = watch("city")
  const duration = watch("duration")
  const maxGroupSize = watch("maxGroupSize")
  const minimumAttendees = watch("minimumAttendees")
  const description = watch("description")
  const seoKeywordsRaw = watch("seoKeywords")
  const meetingPoint = watch("meetingPoint")

  // Fetch available cities from DB
  useEffect(() => {
    fetch("/api/cities")
      .then((r) => r.json())
      .then((json) => {
        if (json.cities) setAvailableCities(json.cities)
      })
      .catch(() => {
        // silently fail; cities just won't populate
      })
  }, [])

  // Load tour data from API
  useEffect(() => {
    const fetchTour = async () => {
      if (!tourId) return
      try {
        const response = await fetch(`/api/tours/${tourId}`)
        if (!response.ok) throw new Error("Failed to fetch tour")
        const tour = await response.json()

        const schedulesRes = await fetch(`/api/schedules?tour_id=${tourId}`)
        let mappedSchedules: ScheduleRow[] = []
        if (schedulesRes.ok) {
          const schedulesData = await schedulesRes.json()
          if (Array.isArray(schedulesData)) {
            mappedSchedules = schedulesData.map((s: any) => {
              const startTime = new Date(s.start_time)
              return {
                id: s.id,
                language: s.language || "English",
                time: startTime.toTimeString().slice(0, 5),
                capacity: s.capacity,
                recurrence: "once" as const,
                startDate: startTime.toISOString().split("T")[0],
              }
            })
          }
        }

        const tourImages = tour.photos || tour.images || []
        const initialImages: TourImageUploadItem[] =
          Array.isArray(tourImages) && tourImages.length > 0
            ? tourImages.map((url: string) => ({ url }))
            : []

        const initialHighlights =
          Array.isArray(tour.highlights) && tour.highlights.length > 0 ? tour.highlights : [""]
        const initialLanguages =
          Array.isArray(tour.languages) && tour.languages.length > 0
            ? tour.languages
            : ["English"]
        const initialCategories = Array.isArray(tour.categories) ? tour.categories : []

        reset({
          title: tour.title || "",
          city: tour.city || "",
          description: tour.description || "",
          seoKeywords: Array.isArray(tour.seo_keywords) ? tour.seo_keywords.join(", ") : "",
          duration: tour.duration_minutes ? String(tour.duration_minutes / 60) : "1.5",
          maxGroupSize: String(tour.max_capacity || tour.max_group_size || 10),
          minimumAttendees: String(tour.minimum_attendees || 1),
          languages: initialLanguages,
          categories: initialCategories,
          highlights: initialHighlights,
          whatToExpect: tour.what_to_expect || "",
          whatToBring: tour.what_to_bring || "",
          accessibility_info: tour.accessibility_info || "",
          schedules: mappedSchedules,
          meetingPoint: tour.meeting_point || tour.meeting_point_address || "",
          meetingPointDetails: tour.meeting_point_details || "",
        })

        setImages(initialImages)
        setOriginalSchedules(JSON.parse(JSON.stringify(mappedSchedules)))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tour")
      } finally {
        setIsLoading(false)
      }
    }
    fetchTour()
  }, [tourId, reset])

  // Tour QR code
  useEffect(() => {
    let isMounted = true
    const fetchTourQr = async () => {
      if (!tourId) return
      try {
        setTourQrLoading(true)
        setTourQrError(null)
        const res = await fetch("/api/review-qr/tour-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tour_id: tourId }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data?.error || "Unable to load tour QR.")
        }
        if (isMounted) {
          setTourQrUrl(typeof data?.qrUrl === "string" ? data.qrUrl : null)
        }
      } catch (err) {
        if (isMounted) {
          setTourQrUrl(null)
          setTourQrError(err instanceof Error ? err.message : "Unable to load tour QR.")
        }
      } finally {
        if (isMounted) setTourQrLoading(false)
      }
    }
    void fetchTourQr()
    return () => {
      isMounted = false
    }
  }, [tourId])

  const handleCopyTourQr = async () => {
    if (!tourQrUrl) return
    try {
      await navigator.clipboard.writeText(tourQrUrl)
      setTourQrCopied(true)
      window.setTimeout(() => setTourQrCopied(false), 1800)
    } catch {
      setTourQrCopied(false)
    }
  }

  // Highlights helpers
  const addHighlight = () => setValue("highlights", [...highlights, ""], { shouldDirty: true })
  const removeHighlight = (index: number) =>
    setValue(
      "highlights",
      highlights.filter((_, i) => i !== index),
      { shouldDirty: true, shouldValidate: true },
    )
  const updateHighlight = (index: number, value: string) => {
    const next = [...highlights]
    next[index] = value
    setValue("highlights", next, { shouldDirty: true })
  }

  // Plan limits
  const effectiveTier = planLoading ? profile?.guide_tier ?? "free" : planType
  const isFreePlan = effectiveTier === "free"
  const canUseLargeGroups = !planLoading && !isFreePlan
  const defaultCapacity = !planLoading && isFreePlan ? 7 : 10

  // Schedule helpers
  const addSchedule = (lang: string) => {
    const newSchedule: ScheduleRow = {
      id: `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      language: lang,
      time: "10:00",
      capacity: defaultCapacity,
      recurrence: "once",
      startDate: new Date().toISOString().split("T")[0],
    }
    setValue("schedules", [...schedules, newSchedule], { shouldDirty: true, shouldValidate: true })
  }

  const handleRecurringSchedules = (newSchedules: any[]) => {
    // Builder emits rows without `recurrence` and with extra keys — normalise.
    const normalized: ScheduleRow[] = newSchedules.map((s) => ({
      id:
        typeof s.id === "string" && s.id
          ? s.id
          : `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      language: String(s.language || ""),
      time: String(s.time || ""),
      capacity:
        typeof s.capacity === "number"
          ? s.capacity
          : Number.parseInt(String(s.capacity ?? ""), 10) || defaultCapacity,
      recurrence: (s.recurrence as ScheduleRow["recurrence"]) ?? "weekly",
      startDate: String(s.startDate || ""),
      endDate: s.endDate ? String(s.endDate) : undefined,
      daysOfWeek: Array.isArray(s.daysOfWeek) ? s.daysOfWeek : undefined,
    }))
    setValue("schedules", [...schedules, ...normalized], {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const updateSchedule = (id: string, field: keyof ScheduleRow, value: any) => {
    setValue(
      "schedules",
      schedules.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      { shouldDirty: true },
    )
  }

  const removeSchedule = (id: string) => {
    // Track server-persisted schedules for deletion on save.
    if (!isNewScheduleId(id)) {
      setDeletedScheduleIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    }
    setValue(
      "schedules",
      schedules.filter((s) => s.id !== id),
      { shouldDirty: true, shouldValidate: true },
    )
  }

  const toggleLanguage = (lang: string) => {
    const next = selectedLanguages.includes(lang)
      ? selectedLanguages.filter((l) => l !== lang)
      : [...selectedLanguages, lang]
    setValue("languages", next, { shouldDirty: true, shouldValidate: true })
  }

  const toggleCategory = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat]
    setValue("categories", next, { shouldDirty: true, shouldValidate: true })
  }

  const steps = [
    { number: 1, title: "Basic Info", description: "Tour details" },
    { number: 2, title: "Description", description: "What to expect" },
    { number: 3, title: "Photos", description: "Add 1-6 images" },
    { number: 4, title: "Schedules", description: "Dates & times" },
    { number: 5, title: "Meeting Point", description: "Location" },
    { number: 6, title: "Preview", description: "Final check" },
  ]

  const compressionMedianBytes = useMemo(() => {
    const sizes = images
      .map((image) => image.stats?.compressedBytes)
      .filter((size): size is number => Number.isFinite(size))
    return medianBytes(sizes)
  }, [images])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setError(null)
    setImagesError(null)
    setPhotoWarnings([])
    const remainingSlots = TOUR_IMAGE_POLICY.maxImagesPerTour - images.length

    if (remainingSlots <= 0) {
      setError(`Maximum ${TOUR_IMAGE_POLICY.maxImagesPerTour} photos allowed`)
      return
    }

    const filesToAdd = Array.from(files).slice(0, remainingSlots)
    const nextImages: TourImageUploadItem[] = []
    const warnings: string[] = []

    for (const file of filesToAdd) {
      try {
        const { file: compressedFile, previewUrl, stats } = await compressTourImageForUpload(file)
        nextImages.push({ url: previewUrl, file: compressedFile, stats })

        if (stats.lowResolution) {
          warnings.push(
            `${stats.originalName}: resolution ${stats.width}x${stats.height} is below the recommended ${TOUR_IMAGE_POLICY.minRecommendedWidth}x${TOUR_IMAGE_POLICY.minRecommendedHeight}.`,
          )
        }
        if (stats.aboveTargetSize) {
          warnings.push(
            `${stats.originalName}: compressed size is ${formatBytes(stats.compressedBytes)} (target ${formatBytes(
              TOUR_IMAGE_POLICY.targetBytesMax,
            )} max).`,
          )
        }
      } catch (compressionError) {
        const message =
          compressionError instanceof Error ? compressionError.message : "Image processing failed."
        warnings.push(`${file.name}: ${message}`)
      }
    }

    if (nextImages.length > 0) setImages((prev) => [...prev, ...nextImages])
    if (warnings.length > 0) setPhotoWarnings(warnings)

    e.target.value = ""
  }

  const removePhoto = (index: number) => setImages(images.filter((_, i) => i !== index))

  const getGoogleMapsUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  const seoKeywords = useMemo(() => normalizeSeoKeywords(seoKeywordsRaw || ""), [seoKeywordsRaw])
  const descriptionLength = String(description || "").trim().length
  const descriptionMinMet = descriptionLength >= TOUR_DESCRIPTION_MIN_CHARS
  const guideBioLength = String(profile?.bio || "").trim().length
  const guideBioMinMet = guideBioLength >= GUIDE_BIO_MIN_CHARS
  const stopCount = highlights.filter((h) => h.trim().length > 0).length
  const stopMinMet = stopCount >= MIN_STOPS_FOR_PUBLISH
  const futureScheduleCount = countFutureSchedules(schedules)
  const futureScheduleMinMet = futureScheduleCount >= MIN_FUTURE_SCHEDULES_FOR_PUBLISH
  const parsedMaxGroupSize = Number.parseInt(maxGroupSize || "", 10)
  const resolvedMaxGroupSize =
    Number.isFinite(parsedMaxGroupSize) && parsedMaxGroupSize > 0 ? parsedMaxGroupSize : 10
  const parsedMinimumAttendees = Number.parseInt(minimumAttendees || "", 10)
  const resolvedMinimumAttendees =
    Number.isFinite(parsedMinimumAttendees) && parsedMinimumAttendees > 0
      ? parsedMinimumAttendees
      : 1
  const minimumAttendeesValid = resolvedMinimumAttendees <= resolvedMaxGroupSize

  const publishBlockers = useMemo(() => {
    const blockers: string[] = []
    if (!title.trim()) blockers.push("Title is required")
    if (!city.trim()) blockers.push("City is required")
    if (!description.trim()) blockers.push("Description is required")
    if (images.length < 1) blockers.push("At least 1 photo is required")
    if (schedules.length < 1) blockers.push("At least 1 schedule is required")
    if (!meetingPoint.trim()) blockers.push("Meeting point is required")
    if (!descriptionMinMet) blockers.push(DESCRIPTION_MIN_MESSAGE)
    if (!guideBioMinMet) blockers.push(GUIDE_BIO_MIN_MESSAGE)
    if (!stopMinMet) blockers.push(MIN_STOPS_MESSAGE)
    if (!minimumAttendeesValid)
      blockers.push("Minimum attendees cannot be greater than maximum group size")
    return blockers
  }, [
    title,
    city,
    description,
    meetingPoint,
    images.length,
    schedules.length,
    descriptionMinMet,
    guideBioMinMet,
    stopMinMet,
    minimumAttendeesValid,
  ])

  const blockersRef = useRef<HTMLDivElement>(null)

  const validateStep = async (step: number): Promise<boolean> => {
    setError(null)
    setImagesError(null)

    const fields = stepFieldMap[step]
    if (fields && fields.length > 0) {
      const ok = await trigger(fields)
      if (!ok) {
        setError("Please fix the highlighted fields before continuing.")
        return false
      }
    }

    if (step === 2) {
      const nonEmpty = getValues("highlights").filter((h) => h.trim().length > 0).length
      if (nonEmpty < 1) {
        setError("Add at least one highlight / stop before continuing.")
        return false
      }
    }

    if (step === 3) {
      if (images.length < 1) {
        setImagesError("Add at least one photo before continuing.")
        return false
      }
    }

    if (step === 4) {
      const currentSchedules = getValues("schedules")
      if (currentSchedules.length < 1) {
        setError("Add at least one schedule before continuing.")
        return false
      }
      const upcoming = countFutureSchedules(currentSchedules)
      if (upcoming < MIN_FUTURE_SCHEDULES_FOR_PUBLISH) {
        setError(MIN_FUTURE_SCHEDULES_MESSAGE)
        return false
      }
    }

    return true
  }

  const goToStep = async (target: number) => {
    if (target < currentStep) {
      setCurrentStep(target)
      return
    }
    for (let step = currentStep; step < target; step += 1) {
      const ok = await validateStep(step)
      if (!ok) return
    }
    setCurrentStep(target)
  }

  const handleSubmit = async (status: "draft" | "published") => {
    try {
      setError(null)
      setIsSubmitting(true)

      const values = getValues()

      if (status === "published") {
        const zodValid = await trigger()
        if (!zodValid) {
          setError("Please fix the highlighted fields before publishing.")
          return
        }
        if (publishBlockers.length > 0) {
          setError("Complete all required fields before publishing.")
          blockersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
          return
        }
      } else if (!values.title.trim()) {
        const ok = await trigger(["title"])
        if (!ok) {
          setError("Add a title before saving the draft.")
          setCurrentStep(1)
          return
        }
      }

      const safeHighlights = values.highlights.filter((h) => h.trim())
      const safeDuration = values.duration ? parseFloat(values.duration) * 60 : 90
      const safeMaxCapacity = values.maxGroupSize ? parseInt(values.maxGroupSize, 10) : 10
      const safeMinimumAttendees = resolvedMinimumAttendees

      // Step 1: Prune removed existing photos first (keeps under the 10-image cap)
      const existingUrls = images.filter((img) => !img.file).map((img) => img.url)
      const prePatchResponse = await fetch(`/api/tours/${tourId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: existingUrls }),
      })
      if (!prePatchResponse.ok) {
        throw new Error("Failed to update photos list before uploading new ones")
      }

      // Step 2: Upload new files sequentially
      const finalPhotos = [...images]
      let imagesUploadedCount = 0
      const imageUploadErrors: string[] = []
      for (let i = 0; i < finalPhotos.length; i++) {
        const image = finalPhotos[i]
        if (image.file) {
          try {
            const imageFormData = new FormData()
            imageFormData.append("file", image.file)
            const uploadResponse = await fetch(`/api/tours/${tourId}/upload-image`, {
              method: "POST",
              body: imageFormData,
            })
            if (!uploadResponse.ok) {
              const uploadError = await uploadResponse
                .json()
                .catch(() => ({ error: "Upload failed" }))
              imageUploadErrors.push(
                `${image.file?.name || `Image ${i + 1}`}: ${uploadError.error || "Upload failed"}`,
              )
              continue
            }
            const data = await uploadResponse.json()
            finalPhotos[i] = { url: data.url }
            imagesUploadedCount++
          } catch (err) {
            console.error(`[v0] Error uploading image ${i + 1}:`, err)
            imageUploadErrors.push(
              `${image.file?.name || `Image ${i + 1}`}: unexpected upload error`,
            )
          }
        } else {
          imagesUploadedCount++
        }
      }
      if (imageUploadErrors.length > 0) {
        console.warn("[v0] Image upload errors:", imageUploadErrors)
      }
      if (status === "published" && imagesUploadedCount === 0) {
        setError("Cannot publish: at least 1 photo is required")
        return
      }

      const photoUrls = finalPhotos.map((img) => img.url).filter(Boolean)

      // Step 3: Final patch with metadata + reconciled photos
      const response = await fetch(`/api/tours/${tourId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          city: values.city,
          description: values.description,
          highlights: safeHighlights,
          duration_minutes: safeDuration,
          max_capacity: safeMaxCapacity,
          minimum_attendees: safeMinimumAttendees,
          languages: values.languages.length > 0 ? values.languages : ["English"],
          categories: values.categories,
          meeting_point: values.meetingPoint,
          meeting_point_details: values.meetingPointDetails,
          what_to_expect: values.whatToExpect,
          what_to_bring: values.whatToBring,
          accessibility_info: values.accessibility_info,
          seo_keywords: seoKeywords,
          status,
          images: photoUrls,
        }),
      })

      if (!response.ok) {
        const contentType = response.headers.get("content-type")
        let errorData
        if (contentType?.includes("application/json")) {
          errorData = await response.json()
        } else {
          const text = await response.text()
          console.error("[v0] API returned non-JSON:", text)
          errorData = { error: `Server error: ${response.status}` }
        }
        throw new Error(errorData.error || "Failed to update tour")
      }

      // Step 4: Schedule diff sync — delete removed, update modified, create new
      for (const id of deletedScheduleIds) {
        await fetch(`/api/schedules?id=${id}`, { method: "DELETE" })
      }

      const modifiedSchedules = values.schedules.filter((s) => {
        if (isNewScheduleId(s.id)) return false
        const original = originalSchedules.find((os) => os.id === s.id)
        if (!original) return false
        return (
          s.startDate !== original.startDate ||
          s.time !== original.time ||
          s.capacity !== original.capacity ||
          s.language !== original.language
        )
      })

      for (const s of modifiedSchedules) {
        await fetch(`/api/schedules`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: s.id,
            start_time: new Date(`${s.startDate}T${s.time}`).toISOString(),
            capacity: s.capacity,
            language: s.language,
          }),
        })
      }

      const newSchedules = values.schedules.filter((s) => isNewScheduleId(s.id))
      if (newSchedules.length > 0) {
        const schedulesToCreate = newSchedules
          .filter((s) => s.startDate && s.time)
          .map((schedule) => ({
            start_time: new Date(`${schedule.startDate}T${schedule.time}`).toISOString(),
            capacity: schedule.capacity,
            language: schedule.language,
          }))
        if (schedulesToCreate.length > 0) {
          await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tour_id: tourId, schedules: schedulesToCreate }),
          })
        }
      }

      router.push("/dashboard/tours")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <LoadingSpinner label="Loading tour..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="mb-4 rounded-xl border bg-background">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link href="/dashboard/tours">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold truncate">Edit Tour</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Update your tour details
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 bg-transparent w-full sm:w-auto"
                onClick={() => handleSubmit("draft")}
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Save Draft</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 bg-transparent w-full sm:w-auto"
                onClick={() => goToStep(6)}
              >
                <Eye className="h-4 w-4" />
                <span className="hidden md:inline">Preview</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!planLoading && isFreePlan && (
          <Alert className="mb-6 bg-primary/10 border-primary/30">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary ml-2">
              <strong>Free plan:</strong> 1 published tour (drafts unlimited) + up to 7 guests per tour.{" "}
              <Link href="/dashboard/upgrade" className="underline font-medium">
                Upgrade to Pro
              </Link>{" "}
              for unlimited tours and larger groups.
            </AlertDescription>
          </Alert>
        )}

        {/* Tour QR card (edit-only) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-5 w-5" />
              Tour Review QR
            </CardTitle>
            <CardDescription>
              Use this permanent QR for this tour. Guests can scan and review when an
              attendance-backed session is open.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tourQrLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 animate-spin" />
                Loading review QR...
              </div>
            ) : null}

            {!tourQrLoading && tourQrError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{tourQrError}</AlertDescription>
              </Alert>
            ) : null}

            {!tourQrLoading && !tourQrError && tourQrUrl ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="rounded-xl border p-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tourQrUrl)}`}
                    alt="Tour review QR code"
                    className="h-44 w-44"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="break-all rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {tourQrUrl}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2 bg-transparent" onClick={handleCopyTourQr}>
                      <Copy className="h-4 w-4" />
                      {tourQrCopied ? "Copied" : "Copy Link"}
                    </Button>
                    <Button variant="outline" asChild className="gap-2 bg-transparent">
                      <a href={tourQrUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open QR Page
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Horizontal stepper */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start gap-0.5 sm:gap-2">
            {steps.map((step, i) => {
              const isActive = currentStep === step.number
              const isCompleted = currentStep > step.number
              const isLast = i === steps.length - 1
              return (
                <div
                  key={step.number}
                  className={`flex items-start gap-0.5 sm:gap-2 ${!isLast ? "flex-1" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => goToStep(step.number)}
                    className="group flex flex-col items-center gap-1.5 sm:gap-2 shrink-0"
                  >
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors border-2 shrink-0 ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : isCompleted
                            ? "bg-secondary text-white border-secondary"
                            : "bg-background text-muted-foreground border-border group-hover:border-muted-foreground/50"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <div className="hidden sm:flex sm:flex-col sm:items-center text-center min-w-[72px]">
                      <span
                        className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
                          isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.title}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                        {step.description}
                      </span>
                    </div>
                  </button>
                  {!isLast && (
                    <div
                      className={`h-0.5 flex-1 mt-4 sm:mt-5 transition-colors ${
                        isCompleted ? "bg-secondary" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-center sm:hidden">
            <p className="text-sm font-medium">{steps[currentStep - 1]?.title}</p>
            <p className="text-xs text-muted-foreground">
              {steps[currentStep - 1]?.description}
            </p>
          </div>
        </div>

        {/* Main Form */}
        <div>
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Tell us the essential details about your tour</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Tour Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Historic Old Town Walking Tour"
                    aria-invalid={!!errors.title}
                    {...register("title")}
                  />
                  <FieldError message={errors.title?.message} />
                  <p className="text-xs text-muted-foreground">
                    Choose a catchy title that describes your tour
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Controller
                    name="city"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger aria-invalid={!!errors.city}>
                          <SelectValue
                            placeholder={
                              availableCities.length === 0 ? "Loading cities…" : "Select a city"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCities.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>
                              {c.name}, {c.country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={errors.city?.message} />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration *</Label>
                    <Controller
                      name="duration"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger aria-invalid={!!errors.duration}>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 hour</SelectItem>
                            <SelectItem value="1.5">1.5 hours</SelectItem>
                            <SelectItem value="2">2 hours</SelectItem>
                            <SelectItem value="2.5">2.5 hours</SelectItem>
                            <SelectItem value="3">3 hours</SelectItem>
                            <SelectItem value="3.5">3.5 hours</SelectItem>
                            <SelectItem value="4">4 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={errors.duration?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxGroupSize">Maximum Group Size *</Label>
                    <Controller
                      name="maxGroupSize"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger aria-invalid={!!errors.maxGroupSize}>
                            <SelectValue placeholder="Select group size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">4 people</SelectItem>
                            <SelectItem value="5">5 people</SelectItem>
                            <SelectItem value="6">6 people</SelectItem>
                            <SelectItem value="7">7 people</SelectItem>
                            {canUseLargeGroups && (
                              <>
                                <SelectItem value="8">8 people</SelectItem>
                                <SelectItem value="10">10 people</SelectItem>
                                <SelectItem value="15">15 people</SelectItem>
                                <SelectItem value="20">20 people</SelectItem>
                                <SelectItem value="25">25 people</SelectItem>
                                <SelectItem value="30">30 people</SelectItem>
                                <SelectItem value="50">50 people</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={errors.maxGroupSize?.message} />
                    {!planLoading && isFreePlan && (
                      <p className="text-xs text-muted-foreground">
                        Free plan limited to 7 guests
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minimumAttendees">Minimum Attendees *</Label>
                    <Input
                      id="minimumAttendees"
                      type="number"
                      min="1"
                      max={String(Math.max(1, resolvedMaxGroupSize))}
                      aria-invalid={!!errors.minimumAttendees}
                      {...register("minimumAttendees")}
                    />
                    <FieldError message={errors.minimumAttendees?.message} />
                    <p className="text-xs text-muted-foreground">
                      Shown publicly to guests before booking.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Languages Offered *</Label>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {languages.map((lang) => (
                      <Badge
                        key={lang}
                        variant={selectedLanguages.includes(lang) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 text-xs sm:text-sm"
                        onClick={() => toggleLanguage(lang)}
                      >
                        {lang}
                      </Badge>
                    ))}
                  </div>
                  <FieldError message={errors.languages?.message as string | undefined} />
                </div>

                <div className="space-y-2">
                  <Label>Categories *</Label>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant={selectedCategories.includes(cat) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 text-xs sm:text-sm"
                        onClick={() => toggleCategory(cat)}
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                  <FieldError message={errors.categories?.message as string | undefined} />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button onClick={() => goToStep(2)} className="w-full sm:w-auto">
                    Continue to Description
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Description */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Tour Description</CardTitle>
                <CardDescription>
                  Help travelers understand what makes your tour special
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your tour in detail. What will travelers see and experience?"
                    className="min-h-[150px]"
                    aria-invalid={!!errors.description}
                    {...register("description")}
                  />
                  <p
                    className={`text-xs ${descriptionMinMet ? "text-green-600" : "text-muted-foreground"}`}
                  >{`${descriptionLength}/${TOUR_DESCRIPTION_MIN_CHARS} characters`}</p>
                  <FieldError message={errors.description?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoKeywords">SEO Keywords (optional)</Label>
                  <Input
                    id="seoKeywords"
                    placeholder="e.g., paris walking tour, hidden gems paris, local guide paris"
                    {...register("seoKeywords")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated keywords. Focus on specific traveler intent and city phrases.
                  </p>
                </div>

                <Alert className="border-border bg-muted/40">
                  <AlertDescription className="space-y-2 text-sm">
                    <p className="font-medium text-foreground">Publish quality checks</p>
                    <p className={descriptionMinMet ? "text-green-600" : "text-muted-foreground"}>
                      Description: {descriptionLength}/{TOUR_DESCRIPTION_MIN_CHARS} characters
                    </p>
                    <p className={guideBioMinMet ? "text-green-600" : "text-muted-foreground"}>
                      Guide bio: {guideBioLength}/{GUIDE_BIO_MIN_CHARS} characters
                    </p>
                    <p className={stopMinMet ? "text-green-600" : "text-muted-foreground"}>
                      Stops: {stopCount}/{MIN_STOPS_FOR_PUBLISH}
                    </p>
                    <p className={futureScheduleMinMet ? "text-green-600" : "text-muted-foreground"}>
                      Upcoming dates: {futureScheduleCount}/{MIN_FUTURE_SCHEDULES_FOR_PUBLISH}
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Label>Highlights / Stops (what you will see) *</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        List the key attractions, landmarks, or experiences on your tour
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addHighlight}
                      className="gap-1 bg-transparent w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Add Stop
                    </Button>
                  </div>
                  {highlights.map((highlight, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={
                          index === 0
                            ? "e.g., The historic cathedral with stunning Gothic architecture"
                            : index === 1
                              ? "e.g., Local artisan market with handmade crafts"
                              : `Stop ${index + 1}`
                        }
                        value={highlight}
                        onChange={(e) => updateHighlight(index, e.target.value)}
                      />
                      {highlights.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeHighlight(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="whatToExpect">What to Expect</Label>
                  <Textarea
                    id="whatToExpect"
                    placeholder="What should travelers expect during the tour?"
                    className="min-h-[100px]"
                    {...register("whatToExpect")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatToBring">
                    Guide recommendations (what to bring / wear)
                  </Label>
                  <Textarea
                    id="whatToBring"
                    placeholder="e.g., Comfortable walking shoes, water bottle, camera, sun protection, umbrella for rain"
                    {...register("whatToBring")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Help guests prepare for the tour experience
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessibility_info">Accessibility Information</Label>
                  <Textarea
                    id="accessibility_info"
                    placeholder="Is this tour wheelchair accessible? Are there many stairs?"
                    {...register("accessibility_info")}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => goToStep(1)}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>
                  <Button onClick={() => goToStep(3)} className="w-full sm:w-auto">
                    Continue to Photos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Photos */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Tour Photos ({images.length}/{TOUR_IMAGE_POLICY.maxImagesPerTour})
                </CardTitle>
                <CardDescription>Add 1-6 high-quality photos of your tour</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">Drag and drop your photos here</h3>
                      <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                      <input
                        type="file"
                        multiple
                        accept={TOUR_IMAGE_POLICY.acceptedMimeTypes.join(",")}
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={images.length >= TOUR_IMAGE_POLICY.maxImagesPerTour}
                      />
                      <p className="text-xs text-muted-foreground mt-4">
                        JPG, PNG or WebP. Max {TOUR_IMAGE_POLICY.maxImagesPerTour - images.length}{" "}
                        photos remaining. Recommended:{" "}
                        {TOUR_IMAGE_POLICY.minRecommendedWidth}x
                        {TOUR_IMAGE_POLICY.minRecommendedHeight}px.
                      </p>
                    </div>
                  </label>
                </div>
                {imagesError && <FieldError message={imagesError} />}

                <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Image quality checklist</p>
                  <p className="mt-1">
                    Images are auto-compressed to WebP (longest side{" "}
                    {TOUR_IMAGE_POLICY.maxDimensionPx}px).
                  </p>
                  <p className="mt-1">
                    Target size per image: {formatBytes(TOUR_IMAGE_POLICY.targetBytesMin)} -{" "}
                    {formatBytes(TOUR_IMAGE_POLICY.targetBytesMax)}.
                  </p>
                  {compressionMedianBytes && (
                    <p className="mt-1">
                      Current median compressed size: {formatBytes(compressionMedianBytes)}.
                    </p>
                  )}
                </div>

                {photoWarnings.length > 0 && (
                  <Alert className="border-amber-500/40 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/15 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {photoWarnings[0]}
                      {photoWarnings.length > 1
                        ? ` (+${photoWarnings.length - 1} more warning${photoWarnings.length > 2 ? "s" : ""})`
                        : ""}
                    </AlertDescription>
                  </Alert>
                )}

                {images.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-4">Uploaded Photos</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      {images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img.url || "/placeholder.svg"}
                            alt={`Photo ${index + 1}`}
                            className="aspect-[4/3] object-cover rounded-lg w-full"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removePhoto(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded">
                            {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => goToStep(2)}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => goToStep(4)}
                    disabled={images.length === 0}
                    className="w-full sm:w-auto"
                  >
                    Continue to Schedules
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Schedules */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Tour Schedules</CardTitle>
                <CardDescription>Add available dates and times for your tour</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!planLoading && isFreePlan && (
                  <Alert className="bg-primary/10 border-primary/30">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-primary ml-2">
                      Free plan: max capacity is 7 guests per tour. Upgrade to Pro to increase
                      group sizes.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert
                  className={
                    futureScheduleMinMet
                      ? "border-green-200 bg-green-50"
                      : "border-amber-500/40 bg-amber-50"
                  }
                >
                  {futureScheduleMinMet ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  <AlertDescription
                    className={futureScheduleMinMet ? "text-green-700" : "text-amber-900"}
                  >
                    Upcoming dates: {futureScheduleCount}/{MIN_FUTURE_SCHEDULES_FOR_PUBLISH}.{" "}
                    {futureScheduleMinMet
                      ? "You have enough upcoming dates to publish."
                      : MIN_FUTURE_SCHEDULES_MESSAGE}
                  </AlertDescription>
                </Alert>

                <Tabs defaultValue={selectedLanguages[0] || "English"}>
                  <TabsList
                    className="w-full gap-1 overflow-x-auto flex"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min((selectedLanguages.length > 0 ? selectedLanguages : ["English"]).length, 6)}, minmax(0, 1fr))`,
                    }}
                  >
                    {(selectedLanguages.length > 0 ? selectedLanguages : ["English"]).map(
                      (lang) => (
                        <TabsTrigger
                          key={lang}
                          value={lang}
                          className="text-xs sm:text-sm truncate shrink-0"
                        >
                          {lang}
                        </TabsTrigger>
                      ),
                    )}
                  </TabsList>

                  {(selectedLanguages.length > 0 ? selectedLanguages : ["English"]).map((lang) => (
                    <TabsContent key={lang} value={lang} className="space-y-4 mt-6">
                      <div className="mb-8 border rounded-xl shadow-sm bg-card overflow-hidden">
                        <div className="bg-primary/5 px-4 py-3 border-b flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">
                            Generate repeating schedules for {lang}
                          </span>
                        </div>
                        <div className="p-4">
                          <RecurringScheduleBuilder
                            tourLanguages={[lang]}
                            onGenerate={(newSchedules) => {
                              const overrides = newSchedules.map((s) => ({
                                ...s,
                                language: lang,
                              }))
                              handleRecurringSchedules(overrides)
                            }}
                            existingSchedules={schedules.filter((s) => s.language === lang)}
                            defaultCapacity={defaultCapacity}
                            maxCapacity={isFreePlan ? 7 : 50}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                          <h4 className="font-medium">{lang} - Available Times</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addSchedule(lang)}
                            className="gap-1 bg-transparent w-full sm:w-auto"
                          >
                            <Plus className="h-4 w-4" />
                            Add Time Slot
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {schedules
                            .map((schedule, index) => ({ schedule, index }))
                            .filter(({ schedule }) => schedule.language === lang)
                            .map(({ schedule, index }) => {
                              const rowError = (
                                errors.schedules as
                                  | Record<number, Record<string, { message?: string }>>
                                  | undefined
                              )?.[index]
                              const dateError = rowError?.startDate?.message
                              const timeError = rowError?.time?.message
                              const capacityError = rowError?.capacity?.message
                              return (
                                <div
                                  key={schedule.id}
                                  className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-start p-3 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none"
                                >
                                  <div className="flex-1">
                                    <Label className="text-xs">Date</Label>
                                    <Input
                                      type="date"
                                      value={schedule.startDate}
                                      aria-invalid={!!dateError}
                                      onChange={(e) =>
                                        updateSchedule(schedule.id, "startDate", e.target.value)
                                      }
                                    />
                                    <FieldError message={dateError} />
                                  </div>
                                  <div className="flex-1">
                                    <Label className="text-xs">Time</Label>
                                    <Input
                                      type="time"
                                      value={schedule.time}
                                      aria-invalid={!!timeError}
                                      onChange={(e) =>
                                        updateSchedule(schedule.id, "time", e.target.value)
                                      }
                                    />
                                    <FieldError message={timeError} />
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <Label className="text-xs">Capacity</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={schedule.capacity}
                                        aria-invalid={!!capacityError}
                                        onChange={(e) =>
                                          updateSchedule(
                                            schedule.id,
                                            "capacity",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                      <FieldError message={capacityError} />
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeSchedule(schedule.id)}
                                      className="mt-5"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                        </div>

                        {schedules.filter((s) => s.language === lang).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No times added yet
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>

                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 flex gap-3">
                  <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-primary">Schedule Tips</h4>
                    <ul className="text-sm text-primary mt-1 space-y-1">
                      <li>Add multiple time slots to offer flexibility</li>
                      <li>Set realistic capacity for your tours</li>
                      <li>Add schedules for different languages if offered</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => goToStep(3)}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => goToStep(5)}
                    disabled={schedules.length === 0}
                    className="w-full sm:w-auto"
                  >
                    Continue to Meeting Point
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Meeting Point */}
          {currentStep === 5 && (
            <Card>
              <CardHeader>
                <CardTitle>Meeting Point</CardTitle>
                <CardDescription>Where will you meet your tour group?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="meetingPoint">Meeting Point Address *</Label>
                  <Controller
                    name="meetingPoint"
                    control={control}
                    render={({ field }) => (
                      <PlacesAutocompleteInput
                        id="meetingPoint"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="e.g., In front of Notre-Dame Cathedral"
                      />
                    )}
                  />
                  <FieldError message={errors.meetingPoint?.message} />
                  <p className="text-xs text-muted-foreground">
                    Start typing to search for a location
                  </p>
                </div>

                {meetingPoint && (
                  <>
                    <GoogleMapEmbed address={meetingPoint} height={260} />
                    <a
                      href={getGoogleMapsUrl(meetingPoint)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="outline" className="w-full gap-2 bg-transparent">
                        <ExternalLink className="h-4 w-4" />
                        Open in Google Maps
                      </Button>
                    </a>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="meetingPointDetails">Additional Details</Label>
                  <Textarea
                    id="meetingPointDetails"
                    placeholder="How can travelers find you? What will you be wearing or holding?"
                    className="min-h-[100px]"
                    {...register("meetingPointDetails")}
                  />
                </div>

                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 flex gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-primary">Meeting Point Tips</h4>
                    <ul className="text-sm text-primary mt-1 space-y-1">
                      <li>Choose a location that is easy to find</li>
                      <li>Avoid crowded areas where it is hard to spot a group</li>
                      <li>Use a recognizable landmark as reference</li>
                      <li>Mention what you will be wearing or holding</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => goToStep(4)}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>
                  <Button onClick={() => goToStep(6)} className="w-full sm:w-auto">
                    Continue to Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 6: Preview */}
          {currentStep === 6 && (
            <Card>
              <CardHeader>
                <CardTitle>Preview Your Tour</CardTitle>
                <CardDescription>This is how your tour will appear to travelers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <h3 className="font-semibold mb-4">Tour Details</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Title</p>
                        <p className="font-medium">{title || "(Not set)"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">City</p>
                        <p className="font-medium">{city || "(Not set)"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium">{duration} hours</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Max Group Size</p>
                        <p className="font-medium">{maxGroupSize} people</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Minimum Attendees</p>
                        <p className="font-medium">{resolvedMinimumAttendees} people</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Languages</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(selectedLanguages.length > 0 ? selectedLanguages : ["English"]).map(
                            (lang) => (
                              <Badge key={lang}>{lang}</Badge>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Photos ({images.length})</h3>
                    {images.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {images.map((img, i) => (
                          <img
                            key={i}
                            src={img.url || "/placeholder.svg"}
                            alt={`Preview ${i + 1}`}
                            className="aspect-[4/3] object-cover rounded-lg w-full"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No photos uploaded</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {description || "(Not set)"}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Highlights/Stops</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {highlights.filter((h) => h.trim()).length > 0 ? (
                      highlights
                        .filter((h) => h.trim())
                        .map((h, i) => (
                          <li key={i} className="flex gap-2">
                            <span>•</span>
                            <span>{h}</span>
                          </li>
                        ))
                    ) : (
                      <li>No highlights added</li>
                    )}
                  </ul>
                </div>

                <Separator />

                <div ref={blockersRef}>
                  {publishBlockers.length === 0 ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700">
                        Your tour is ready to publish!
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-destructive/30 bg-destructive/5">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <AlertDescription>
                        <p className="font-medium text-destructive mb-1">
                          Complete the following before publishing:
                        </p>
                        <ul className="space-y-0.5 text-sm text-destructive/90">
                          {publishBlockers.map((b) => (
                            <li key={b}>• {b}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => goToStep(5)}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => handleSubmit("draft")}
                      disabled={isSubmitting}
                      className="bg-transparent w-full sm:w-auto"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isSubmitting ? "Saving..." : "Save as Draft"}
                    </Button>
                    <Button
                      onClick={() => handleSubmit("published")}
                      disabled={isSubmitting}
                      className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Publishing..." : "Publish Tour"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
