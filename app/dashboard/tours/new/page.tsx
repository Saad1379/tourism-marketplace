"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Upload, Plus, Trash2, MapPin, Save, Eye, CheckCircle2, AlertCircle, Clock, Users, Star, GripVertical, ExternalLink } from "lucide-react"
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

interface ScheduleRow {
  id: string
  language: string
  time: string
  capacity: number
  recurrence: 'once' | 'weekly' | 'daily'
  startDate: string
  endDate?: string
  daysOfWeek?: number[] // 0-6, where 0 is Sunday
}

interface TourImageUploadItem {
  url: string
  file?: File
  stats?: TourImageCompressionStats
}

const MAX_SCHEDULES_PER_TOUR_FREE = 1; // Declare MAX_SCHEDULES_PER_TOUR_FREE variable

export default function NewTourPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const planType = useUserStore((s) => s.planType)
  const planLoading = useUserStore((s) => s.planLoading)
  const [currentStep, setCurrentStep] = useState(1)
  const [images, setImages] = useState<TourImageUploadItem[]>([])
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([])
  const [highlights, setHighlights] = useState<string[]>([""])
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    city: "",
    description: "",
    seoKeywords: "",
    duration: "",
    maxGroupSize: "",
    minimumAttendees: "1",
    meetingPoint: "",
    meetingPointDetails: "",
    whatToExpect: "",
    whatToBring: "",
    accessibility_info: "",
  })
  const [tourStatus, setTourStatus] = useState("draft") // Declare tourStatus state
  const [availableCities, setAvailableCities] = useState<{ slug: string; name: string; country: string }[]>([])

  // Fetch available cities from DB
  useEffect(() => {
    fetch("/api/cities")
      .then((r) => r.json())
      .then((json) => { if (json.cities) setAvailableCities(json.cities) })
      .catch(() => {}) // silently fail; cities just won't populate
  }, [])

  // Load form state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("tour_creation_form")
    if (savedState) {
      try {
        const { formData: savedFormData, highlights: savedHighlights, selectedLanguages: savedLangs, schedules: savedSchedules, currentStep: savedStep } = JSON.parse(savedState)
        setFormData((prev) => ({
          ...prev,
          ...savedFormData,
          seoKeywords: savedFormData?.seoKeywords || "",
          minimumAttendees:
            typeof savedFormData?.minimumAttendees === "string" && savedFormData.minimumAttendees.trim()
              ? savedFormData.minimumAttendees
              : prev.minimumAttendees,
        }))
        setHighlights(savedHighlights)
        setSelectedLanguages(savedLangs)
        setSchedules(savedSchedules)
        setCurrentStep(savedStep || 1)
      } catch {
        // Ignore malformed local draft payloads.
      }
    }
  }, [])

  // Save form state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = { formData, highlights, selectedLanguages, schedules, currentStep }
    localStorage.setItem("tour_creation_form", JSON.stringify(stateToSave))
  }, [formData, highlights, selectedLanguages, schedules, currentStep])

  // Clear draft function
  const clearDraft = () => {
    if (confirm("Are you sure you want to delete this draft? This cannot be undone.")) {
      localStorage.removeItem("tour_creation_form")
      setFormData({
        title: "",
        city: "",
        description: "",
        seoKeywords: "",
        duration: "",
        maxGroupSize: "",
        minimumAttendees: "1",
        meetingPoint: "",
        meetingPointDetails: "",
        whatToExpect: "",
        whatToBring: "",
        accessibility_info: "",
      })
      setHighlights([""])
      setSelectedLanguages([])
      setSchedules([])
      setCurrentStep(1)
      setError(null)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addHighlight = () => {
    setHighlights([...highlights, ""])
  }

  const removeHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index))
  }

  const updateHighlight = (index: number, value: string) => {
    const updated = [...highlights]
    updated[index] = value
    setHighlights(updated)
  }

  // Free plan limits
  const MAX_TOURS_FREE = 1
  const effectiveTier = planLoading ? profile?.guide_tier ?? "free" : planType
  const isFreePlan = effectiveTier === "free"
  const canUseLargeGroups = !planLoading && !isFreePlan
  const defaultCapacity = !planLoading && isFreePlan ? 7 : 10

  const addSchedule = (lang: string) => {
    const newSchedule: ScheduleRow = {
      id: `schedule_${Date.now()}`,
      language: lang,
      time: "10:00",
      capacity: defaultCapacity,
      recurrence: 'once',
      startDate: new Date().toISOString().split('T')[0],
    }
    setSchedules([...schedules, newSchedule])
  }

  const handleRecurringSchedules = (newSchedules: any[]) => {
    setSchedules((prev) => {
      const updated = [...prev, ...newSchedules]
      return updated
    })
  }

  const updateSchedule = (id: string, field: keyof ScheduleRow, value: any) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  const removeSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
  }

  const toggleDayOfWeek = (id: string, day: number) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              daysOfWeek: s.daysOfWeek?.includes(day)
                ? s.daysOfWeek.filter((d) => d !== day)
                : [...(s.daysOfWeek || []), day],
            }
          : s
      )
    )
  }

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]))
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
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

        console.info("[v0] Tour image compression", {
          file: stats.originalName,
          originalBytes: stats.originalBytes,
          compressedBytes: stats.compressedBytes,
          width: stats.width,
          height: stats.height,
          quality: stats.quality,
        })
      } catch (compressionError) {
        const message = compressionError instanceof Error ? compressionError.message : "Image processing failed."
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

  const movePhoto = (fromIndex: number, toIndex: number) => {
    const newImages = [...images]
    const [moved] = newImages.splice(fromIndex, 1)
    newImages.splice(toIndex, 0, moved)
    setImages(newImages)
  }

  // Google Maps link generator
  const getGoogleMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }

  const seoKeywords = useMemo(() => normalizeSeoKeywords(formData.seoKeywords), [formData.seoKeywords])
  const descriptionLength = String(formData.description || "").trim().length
  const descriptionMinMet = descriptionLength >= TOUR_DESCRIPTION_MIN_CHARS
  const guideBioLength = String(profile?.bio || "").trim().length
  const guideBioMinMet = guideBioLength >= GUIDE_BIO_MIN_CHARS
  const stopCount = highlights.filter((h) => h.trim().length > 0).length
  const stopMinMet = stopCount >= MIN_STOPS_FOR_PUBLISH
  const futureScheduleCount = countFutureSchedules(schedules)
  const futureScheduleMinMet = futureScheduleCount >= MIN_FUTURE_SCHEDULES_FOR_PUBLISH
  const parsedMaxGroupSize = Number.parseInt(formData.maxGroupSize || "", 10)
  const resolvedMaxGroupSize = Number.isFinite(parsedMaxGroupSize) && parsedMaxGroupSize > 0 ? parsedMaxGroupSize : 10
  const parsedMinimumAttendees = Number.parseInt(formData.minimumAttendees || "", 10)
  const resolvedMinimumAttendees =
    Number.isFinite(parsedMinimumAttendees) && parsedMinimumAttendees > 0 ? parsedMinimumAttendees : 1
  const minimumAttendeesValid = resolvedMinimumAttendees <= resolvedMaxGroupSize

  // Validation
  const publishBlockers = useMemo(() => {
    const blockers: string[] = []
    if (!formData.title.trim()) blockers.push("Title is required")
    if (!formData.city.trim()) blockers.push("City is required")
    if (!formData.description.trim()) blockers.push("Description is required")
    if (images.length < 1) blockers.push("At least 1 photo is required")
    if (schedules.length < 1) blockers.push("At least 1 schedule is required")
    if (!formData.meetingPoint.trim()) blockers.push("Meeting point is required")
    if (!descriptionMinMet) blockers.push(DESCRIPTION_MIN_MESSAGE)
    if (!guideBioMinMet) blockers.push(GUIDE_BIO_MIN_MESSAGE)
    if (!stopMinMet) blockers.push(MIN_STOPS_MESSAGE)
    if (!futureScheduleMinMet) blockers.push(MIN_FUTURE_SCHEDULES_MESSAGE)
    if (!minimumAttendeesValid) blockers.push("Minimum attendees cannot be greater than maximum group size")
    return blockers
  }, [
    descriptionMinMet,
    formData.city,
    formData.description,
    formData.meetingPoint,
    formData.title,
    futureScheduleMinMet,
    guideBioMinMet,
    images.length,
    minimumAttendeesValid,
    schedules.length,
    stopMinMet,
  ])

  const blockersRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (status: "draft" | "published") => {
    try {
      setError(null)
      setIsSubmitting(true)

      if (!descriptionMinMet) {
        setError(DESCRIPTION_MIN_MESSAGE)
        return
      }

      if (!minimumAttendeesValid) {
        setError(`Minimum attendees cannot be greater than maximum group size (${resolvedMaxGroupSize})`)
        return
      }

      if (status === "published") {
        if (publishBlockers.length > 0) {
          setError("Complete all required fields before publishing.")
          blockersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
          return
        }
      }

      const safeHighlights = highlights.filter((h) => h.trim())
      const safeDuration = formData.duration ? parseFloat(formData.duration) * 60 : 90
      const safeMaxCapacity = formData.maxGroupSize ? parseInt(formData.maxGroupSize) : 10
      const safeMinimumAttendees = resolvedMinimumAttendees

      // Step 1: Create tour WITHOUT images (metadata only)
      const response = await fetch("/api/tours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          city: formData.city,
          description: formData.description,
          highlights: safeHighlights,
          duration_minutes: safeDuration,
          max_capacity: safeMaxCapacity,
          minimum_attendees: safeMinimumAttendees,
          languages: selectedLanguages.length > 0 ? selectedLanguages : ["English"],
          categories: selectedCategories,
          meeting_point: formData.meetingPoint,
          meeting_point_details: formData.meetingPointDetails,
          what_to_expect: formData.whatToExpect,
          what_to_bring: formData.whatToBring,
          accessibility_info: formData.accessibility_info,
          seo_keywords: seoKeywords,
          status: "draft", // Always create as draft first
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
          
          // Skip if no file (shouldn't happen, but safety check)
          if (!image.file) {
            console.warn("[v0] Image missing file at index", i)
            continue
          }

          try {
            const imageFormData = new FormData()
            imageFormData.append("file", image.file)

            const uploadResponse = await fetch(`/api/tours/${newTour.id}/upload-image`, {
              method: "POST",
              body: imageFormData,
            })

            if (!uploadResponse.ok) {
              const uploadError = await uploadResponse.json().catch(() => ({ error: "Upload failed" }))
              console.error(`[v0] Failed to upload image ${i + 1}:`, uploadError)
              imageUploadErrors.push(
                `${image.file?.name || `Image ${i + 1}`}: ${uploadError.error || "Upload failed"}`,
              )
              // Continue to next image instead of failing completely
              continue
            }

            imagesUploadedCount++
          } catch (imageErr) {
            console.error(`[v0] Error uploading image ${i + 1}:`, imageErr)
            imageUploadErrors.push(`${image.file?.name || `Image ${i + 1}`}: unexpected upload error`)
            // Continue to next image
            continue
          }
        }

        // Warn if some images failed
        if (imagesUploadedCount < images.length) {
          console.warn(`[v0] Only ${imagesUploadedCount}/${images.length} images uploaded successfully`)
        }
        if (imageUploadErrors.length > 0) {
          console.warn("[v0] Image upload errors:", imageUploadErrors)
        }
      }

      // Step 3: Create schedules in bulk and verify count
      let schedulesCreatedCount = 0
      if (schedules.length > 0) {
        const schedulesToCreate = schedules
          .filter(s => s.startDate && s.time)
          .map(schedule => ({
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

          const scheduleContentType = scheduleResponse.headers.get("content-type")
          if (!scheduleResponse.ok) {
            let scheduleError
            if (scheduleContentType?.includes("application/json")) {
              scheduleError = await scheduleResponse.json()
            } else {
              const text = await scheduleResponse.text()
              console.error("[v0] Schedule API returned non-JSON:", text)
              scheduleError = { error: `Schedule creation failed: ${scheduleResponse.status}` }
            }
            console.error("[v0] Failed to create schedules:", scheduleError)

            // If publishing and schedules failed, block and show error
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

      // Step 4: If publishing, verify photo count and schedule count before publishing
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
          const publishError = await publishResponse.json().catch(() => ({ error: "Publishing failed" }))
          setError(publishError.error || "Failed to publish tour")
          return
        }

      }

      router.push("/dashboard/tours")
      clearSavedForm()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Clear saved form after successful submission
  const clearSavedForm = () => {
    localStorage.removeItem("tour_creation_form")
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
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Fill in the details to publish your tour</p>
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
                onClick={() => setCurrentStep(6)}
              >
                <Eye className="h-4 w-4" />
                <span className="hidden md:inline">Preview</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1 sm:gap-2 bg-transparent text-destructive hover:text-destructive hidden md:flex w-full sm:w-auto"
                onClick={clearDraft}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden lg:inline">Clear</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
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
              <strong>Free plan:</strong> 1 tour maximum + up to 7 guests per tour. <Link href="/dashboard/upgrade" className="underline font-medium">Upgrade to Pro</Link> for unlimited tours and larger groups.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid lg:grid-cols-4 gap-4 lg:gap-8 min-w-0">
          {/* Progress Sidebar */}
          <div className="lg:col-span-1">
            {/* Mobile: Horizontal scroll */}
            <div className="lg:hidden overflow-x-auto pb-2 -mx-4 px-4">
              <div className="flex gap-2 min-w-max">
                {steps.map((step) => (
                  <button
                    key={step.number}
                    onClick={() => setCurrentStep(step.number)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      currentStep === step.number
                        ? "bg-primary/10 border border-primary"
                        : currentStep > step.number
                          ? "bg-secondary/10 border border-secondary/30"
                          : "bg-muted"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                        currentStep === step.number
                          ? "bg-primary text-primary-foreground"
                          : currentStep > step.number
                            ? "bg-secondary text-white"
                            : "bg-background text-muted-foreground"
                      }`}
                    >
                      {currentStep > step.number ? <CheckCircle2 className="h-4 w-4" /> : step.number}
                    </div>
                    <span className="text-sm font-medium">{step.title}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Desktop: Vertical sidebar */}
            <Card className="hidden lg:block sticky top-24 max-h-[calc(100vh-140px)] overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Progress</CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto">
                <div className="space-y-3 pr-1">
                  {steps.map((step) => (
                    <button
                      key={step.number}
                      onClick={() => setCurrentStep(step.number)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                        currentStep === step.number
                          ? "bg-primary/10 border border-primary"
                          : currentStep > step.number
                            ? "bg-secondary/10 border border-secondary/30"
                            : "hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                          currentStep === step.number
                            ? "bg-primary text-primary-foreground"
                            : currentStep > step.number
                              ? "bg-secondary text-white"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {currentStep > step.number ? <CheckCircle2 className="h-5 w-5" /> : step.number}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{step.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-3">
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
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Choose a catchy title that describes your tour</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Select onValueChange={(value) => handleInputChange("city", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={availableCities.length === 0 ? "Loading cities…" : "Select a city"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCities.map((c) => (
                          <SelectItem key={c.slug} value={c.slug}>
                            {c.name}, {c.country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration *</Label>
                      <Select onValueChange={(value) => handleInputChange("duration", value)}>
                        <SelectTrigger>
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
                    </div>

                    <div className="space-y-2">
                    <Label htmlFor="maxGroupSize">Maximum Group Size *</Label>
                    <Select onValueChange={(value) => handleInputChange("maxGroupSize", value)}>
                      <SelectTrigger>
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
                    {!planLoading && isFreePlan && (
                      <p className="text-xs text-muted-foreground">Free plan limited to 7 guests</p>
                    )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minimumAttendees">Minimum Attendees *</Label>
                      <Input
                        id="minimumAttendees"
                        type="number"
                        min="1"
                        max={String(Math.max(1, resolvedMaxGroupSize))}
                        value={formData.minimumAttendees}
                        onChange={(event) => handleInputChange("minimumAttendees", event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Shown publicly to guests before booking.</p>
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
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    <Button onClick={() => setCurrentStep(2)} className="w-full sm:w-auto">Continue to Description</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Description */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tour Description</CardTitle>
                  <CardDescription>Help travelers understand what makes your tour special</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your tour in detail. What will travelers see and experience?"
                      className="min-h-[150px]"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                    />
                    <p
                      className={`text-xs ${descriptionMinMet ? "text-green-600" : "text-muted-foreground"}`}
                    >{`${descriptionLength}/${TOUR_DESCRIPTION_MIN_CHARS} characters`}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seoKeywords">SEO Keywords (optional)</Label>
                    <Input
                      id="seoKeywords"
                      placeholder="e.g., paris walking tour, hidden gems paris, local guide paris"
                      value={formData.seoKeywords}
                      onChange={(e) => handleInputChange("seoKeywords", e.target.value)}
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
                        <p className="text-xs text-muted-foreground mt-1">List the key attractions, landmarks, or experiences on your tour</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={addHighlight} className="gap-1 bg-transparent w-full sm:w-auto">
                        <Plus className="h-4 w-4" />
                        Add Stop
                      </Button>
                    </div>
                    {highlights.map((highlight, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={index === 0 ? "e.g., The historic cathedral with stunning Gothic architecture" : index === 1 ? "e.g., Local artisan market with handmade crafts" : `Stop ${index + 1}`}
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
                      value={formData.whatToExpect}
                      onChange={(e) => handleInputChange("whatToExpect", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatToBring">Guide recommendations (what to bring / wear)</Label>
                    <Textarea
                      id="whatToBring"
                      placeholder="e.g., Comfortable walking shoes, water bottle, camera, sun protection, umbrella for rain"
                      value={formData.whatToBring}
                      onChange={(e) => handleInputChange("whatToBring", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Help guests prepare for the tour experience</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessibility_info">Accessibility Information</Label>
                    <Textarea
                      id="accessibility_info"
                      placeholder="Is this tour wheelchair accessible? Are there many stairs?"
                      value={formData.accessibility_info}
                      onChange={(e) => handleInputChange("accessibility_info", e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <Button variant="outline" onClick={() => setCurrentStep(1)} className="w-full sm:w-auto">
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(3)} className="w-full sm:w-auto">Continue to Photos</Button>
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
                          JPG, PNG or WebP. Max {TOUR_IMAGE_POLICY.maxImagesPerTour - images.length} photos remaining.
                          Recommended: {TOUR_IMAGE_POLICY.minRecommendedWidth}x{TOUR_IMAGE_POLICY.minRecommendedHeight}px.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Image quality checklist</p>
                    <p className="mt-1">Images are auto-compressed to WebP (longest side {TOUR_IMAGE_POLICY.maxDimensionPx}px).</p>
                    <p className="mt-1">
                      Target size per image: {formatBytes(TOUR_IMAGE_POLICY.targetBytesMin)} - {formatBytes(TOUR_IMAGE_POLICY.targetBytesMax)}.
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
                        {photoWarnings.length > 1 ? ` (+${photoWarnings.length - 1} more warning${photoWarnings.length > 2 ? "s" : ""})` : ""}
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
                    <Button variant="outline" onClick={() => setCurrentStep(2)} className="w-full sm:w-auto">
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(4)} disabled={images.length === 0} className="w-full sm:w-auto">
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
                        Free plan: max capacity is 7 guests per tour. Upgrade to Pro to increase group sizes.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Tabs defaultValue={selectedLanguages[0] || "English"}>
                    <TabsList
                      className="w-full gap-1 overflow-x-auto flex"
                      style={{ gridTemplateColumns: `repeat(${Math.min((selectedLanguages.length > 0 ? selectedLanguages : ["English"]).length, 6)}, minmax(0, 1fr))` }}
                    >
                      {(selectedLanguages.length > 0 ? selectedLanguages : ["English"]).map((lang) => (
                        <TabsTrigger key={lang} value={lang} className="text-xs sm:text-sm truncate flex-shrink-0">
                          {lang}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {(selectedLanguages.length > 0 ? selectedLanguages : ["English"]).map((lang) => (
                      <TabsContent key={lang} value={lang} className="space-y-4 mt-6">
                        <div className="mb-8 border rounded-xl shadow-sm bg-card overflow-hidden">
                          <div className="bg-primary/5 px-4 py-3 border-b flex items-center gap-2">
                             <Clock className="w-4 h-4 text-primary" />
                             <span className="font-semibold text-sm">Generate repeating schedules for {lang}</span>
                          </div>
                          <div className="p-4">
                            <RecurringScheduleBuilder
                              tourLanguages={[lang]}
                              onGenerate={(newSchedules) => {
                                 const overrides = newSchedules.map(s => ({...s, language: lang}))
                                 handleRecurringSchedules(overrides)
                              }}
                              existingSchedules={schedules.filter(s => s.language === lang)}
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
                              .filter((s) => s.language === lang)
                              .map((schedule) => (
                                <div key={schedule.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-end p-3 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none">
                                  <div className="flex-1">
                                    <Label className="text-xs">Date</Label>
                                    <Input
                                      type="date"
                                      value={schedule.startDate}
                                      onChange={(e) => updateSchedule(schedule.id, "startDate", e.target.value)}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Label className="text-xs">Time</Label>
                                    <Input
                                      type="time"
                                      value={schedule.time}
                                      onChange={(e) => updateSchedule(schedule.id, "time", e.target.value)}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <Label className="text-xs">Capacity</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={schedule.capacity}
                                        onChange={(e) => updateSchedule(schedule.id, "capacity", Number(e.target.value))}
                                      />
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
                              ))}
                          </div>

                          {schedules.filter((s) => s.language === lang).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No times added yet</p>
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
                    <Button variant="outline" onClick={() => setCurrentStep(3)} className="w-full sm:w-auto">
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(5)} disabled={schedules.length === 0} className="w-full sm:w-auto">
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
                    <PlacesAutocompleteInput
                      id="meetingPoint"
                      value={formData.meetingPoint}
                      onChange={(value) => handleInputChange("meetingPoint", value)}
                      placeholder="e.g., In front of Notre-Dame Cathedral"
                    />
                    <p className="text-xs text-muted-foreground">Start typing to search for a location</p>
                  </div>

                  {formData.meetingPoint && (
                    <>
                      <GoogleMapEmbed address={formData.meetingPoint} height={260} />
                      <a
                        href={getGoogleMapsUrl(formData.meetingPoint)}
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
                      value={formData.meetingPointDetails}
                      onChange={(e) => handleInputChange("meetingPointDetails", e.target.value)}
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
                    <Button variant="outline" onClick={() => setCurrentStep(4)} className="w-full sm:w-auto">
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(6)} className="w-full sm:w-auto">Continue to Preview</Button>
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
                          <p className="font-medium">{formData.title || "(Not set)"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">City</p>
                          <p className="font-medium">{formData.city || "(Not set)"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium">{formData.duration} hours</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Max Group Size</p>
                          <p className="font-medium">{formData.maxGroupSize} people</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Minimum Attendees</p>
                          <p className="font-medium">{resolvedMinimumAttendees} people</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Languages</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(selectedLanguages.length > 0 ? selectedLanguages : ["English"]).map((lang) => (
                              <Badge key={lang}>{lang}</Badge>
                            ))}
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
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{formData.description || "(Not set)"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Highlights/Stops</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {highlights.filter((h) => h.trim()).length > 0 ? (
                        highlights.filter((h) => h.trim()).map((h, i) => (
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
                        <AlertDescription className="text-green-700">Your tour is ready to publish!</AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-destructive/30 bg-destructive/5">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <AlertDescription>
                          <p className="font-medium text-destructive mb-1">Complete the following before publishing:</p>
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
                    <Button variant="outline" onClick={() => setCurrentStep(5)} className="w-full sm:w-auto">
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
    </div>
  )
}
