"use client"

/**
 * Tour creation wizard.
 *
 * State strategy:
 *   - react-hook-form owns form state; zod validates. Step-level checks use
 *     `trigger([...fields])` when advancing.
 *   - "Save as Draft" is the only way to persist work; it POSTs the tour to
 *     the server with status='draft' regardless of validation state. Once
 *     saved, the draft lives on the server — reopen it via the tours list.
 *   - No client-side auto-save. Opening "Create Tour" always yields a fresh
 *     form. Drafts belong on the server, not in localStorage.
 */

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
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
import { RecurringScheduleBuilder } from "@/components/recurring-schedule-builder"
import { useUserStore } from "@/store/user-store"
import { PlacesAutocompleteInput } from "@/components/places-autocomplete-input"
import { GoogleMapEmbed } from "@/components/google-map-embed"
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

export default function NewTourPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const planType = useUserStore((s) => s.planType)
  const planLoading = useUserStore((s) => s.planLoading)

  const [currentStep, setCurrentStep] = useState(1)
  const [images, setImages] = useState<TourImageUploadItem[]>([])
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagesError, setImagesError] = useState<string | null>(null)
  const [availableCities, setAvailableCities] = useState<
    { slug: string; name: string; country: string }[]
  >([])

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

  // No draft restore/persist: "Create Tour" always shows a fresh form. Drafts
  // live on the server once the user clicks Save as Draft.

  const resetForm = () => {
    reset(defaultFormValues)
    setImages([])
    setCurrentStep(1)
    setError(null)
    setImagesError(null)
  }

  // Highlights helpers (array<string>)
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

  // Free plan limits
  const effectiveTier = planLoading ? profile?.guide_tier ?? "free" : planType
  const isFreePlan = effectiveTier === "free"
  const canUseLargeGroups = !planLoading && !isFreePlan
  const defaultCapacity = !planLoading && isFreePlan ? 7 : 10

  // Schedule helpers
  const addSchedule = (lang: string) => {
    const newSchedule: ScheduleRow = {
      id: `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      language: lang,
      time: "",
      capacity: defaultCapacity,
      recurrence: "once",
      startDate: "",
    }
    setValue("schedules", [...schedules, newSchedule], { shouldDirty: true, shouldValidate: true })
  }

  const handleRecurringSchedules = (newSchedules: any[]) => {
    // The RecurringScheduleBuilder emits rows without a `recurrence` field and
    // with extra keys (start_time, isNew). Normalise to the ScheduleRow shape
    // the zod schema expects, otherwise validation fails silently.
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

  // Photo helpers
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

    if (nextImages.length > 0) {
      setImages((prev) => [...prev, ...nextImages])
    }

    if (warnings.length > 0) {
      setPhotoWarnings(warnings)
    }

    e.target.value = ""
  }

  const removePhoto = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const getGoogleMapsUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  // Derived publish-quality signals
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
    // if (!descriptionMinMet) blockers.push(DESCRIPTION_MIN_MESSAGE)
    // if (!guideBioMinMet) blockers.push(GUIDE_BIO_MIN_MESSAGE)
    // if (!stopMinMet) blockers.push(MIN_STOPS_MESSAGE)
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

  // Advance to next step only if current step passes validation.
  const goToStep = async (target: number) => {
    // Moving backwards is always allowed.
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
        form.setError("highlights", { message: "Add at least one highlight / stop before continuing." })
        return false
      } else {
        form.clearErrors("highlights")
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
      // const upcoming = countFutureSchedules(currentSchedules)
      // if (upcoming < MIN_FUTURE_SCHEDULES_FOR_PUBLISH) {
      //   setError(MIN_FUTURE_SCHEDULES_MESSAGE)
      //   return false
      // }
    }

    return true
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
      }
      // Drafts save in any state — no validation. The API accepts missing
      // fields and the DB is configured to store partial drafts.

      const safeHighlights = values.highlights.filter((h) => h.trim())
      const safeDuration = values.duration ? parseFloat(values.duration) * 60 : undefined
      const parsedMax = values.maxGroupSize ? parseInt(values.maxGroupSize, 10) : NaN
      const safeMaxCapacity = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : undefined
      const safeMinimumAttendees = resolvedMinimumAttendees

      // Step 1: Create tour WITHOUT images (metadata only)
      const response = await fetch("/api/tours", {
        method: "POST",
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
          status: "draft",
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
        throw new Error(errorData.error || "Failed to create tour")
      }

      const newTour = await response.json()

      // Step 2: Upload images sequentially to separate endpoint
      let imagesUploadedCount = 0
      const imageUploadErrors: string[] = []
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i]
          if (!image.file) continue
          try {
            const imageFormData = new FormData()
            imageFormData.append("file", image.file)
            const uploadResponse = await fetch(`/api/tours/${newTour.id}/upload-image`, {
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
            imagesUploadedCount++
          } catch (imageErr) {
            console.error(`[v0] Error uploading image ${i + 1}:`, imageErr)
            imageUploadErrors.push(
              `${image.file?.name || `Image ${i + 1}`}: unexpected upload error`,
            )
            continue
          }
        }
      }

      // Step 3: Create schedules in bulk
      let schedulesCreatedCount = 0
      if (values.schedules.length > 0) {
        const schedulesToCreate = values.schedules
          .filter((s) => s.startDate && s.time)
          .map((schedule) => ({
            start_time: new Date(`${schedule.startDate}T${schedule.time}`).toISOString(),
            capacity: schedule.capacity,
            language: schedule.language,
          }))
        if (schedulesToCreate.length > 0) {
          const scheduleResponse = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tour_id: newTour.id,
              schedules: schedulesToCreate,
            }),
          })
          if (!scheduleResponse.ok) {
            const scheduleError = await scheduleResponse
              .json()
              .catch(() => ({ error: "Schedule creation failed" }))
            console.error("[v0] Failed to create schedules:", scheduleError)
            if (status === "published") {
              setError(`Failed to create schedules: ${scheduleError.error || "Unknown error"}`)
              return
            }
          } else {
            const scheduleData = await scheduleResponse.json()
            schedulesCreatedCount = scheduleData.insertedCount || schedulesToCreate.length
          }
        }
      }

      // Step 4: If publishing, verify counts and publish
      if (status === "published") {
        if (imagesUploadedCount === 0) {
          setError("Cannot publish: at least 1 photo is required")
          return
        }
        if (schedulesCreatedCount === 0) {
          setError("Cannot publish: at least 1 schedule is required")
          return
        }
        const publishResponse = await fetch("/api/tours/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tour_id: newTour.id }),
        })
        if (!publishResponse.ok) {
          const publishError = await publishResponse
            .json()
            .catch(() => ({ error: "Publishing failed" }))
          setError(publishError.error || "Failed to publish tour")
          return
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
                <h1 className="text-base sm:text-xl font-bold truncate">Create New Tour</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Fill in the details to publish your tour
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
              <Button
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-2 bg-transparent text-destructive hover:text-destructive hidden md:flex w-full sm:w-auto"
                onClick={() => {
                  if (confirm("Clear all entered fields?")) resetForm()
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden lg:inline">Clear</span>
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
          {/* Mobile-only label for active step */}
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
                      <p className="font-medium text-foreground">Publish quality recommendations</p>
                      <p className={descriptionMinMet ? "text-green-600" : "text-muted-foreground"}>
                        Description (recommended): {descriptionLength}/{TOUR_DESCRIPTION_MIN_CHARS} characters
                      </p>
                      <p className={guideBioMinMet ? "text-green-600" : "text-muted-foreground"}>
                        Guide bio (recommended): {guideBioLength}/{GUIDE_BIO_MIN_CHARS} characters
                      </p>
                      <p className={stopMinMet ? "text-green-600" : "text-muted-foreground"}>
                        Stops (recommended): {stopCount}/{MIN_STOPS_FOR_PUBLISH}
                      </p>
                      <p className={futureScheduleMinMet ? "text-green-600" : "text-muted-foreground"}>
                        Upcoming dates (recommended): {futureScheduleCount}/{MIN_FUTURE_SCHEDULES_FOR_PUBLISH}
                      </p>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <Label>Highlights / Stops (what you will see) *</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Add at least one stop to proceed. 4 or more are recommended for better quality.
                        </p>
                        <FieldError message={errors.highlights?.message as string | undefined} />
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
                        ? "Recommended number of upcoming dates met."
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
                            className="text-xs sm:text-sm truncate flex-shrink-0"
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
                                const overrides = newSchedules.map((s) => ({ ...s, language: lang }))
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
