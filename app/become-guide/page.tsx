"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Star,
  Shield,
  Heart,
  Mail,
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { isSeller } from "@/lib/marketplace/roles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { trackFunnelEvent } from "@/lib/analytics/ga"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/supabase/auth-context"
import { formatAuthError, getStorageUrl } from "@/lib/utils"

const benefits = [
  {
    icon: DollarSign,
    title: "Earn Tips",
    description: "Keep 100% of the tips you receive from grateful travelers",
  },
  {
    icon: Clock,
    title: "Flexible Schedule",
    description: "Set your own hours and work when it suits you",
  },
  {
    icon: Users,
    title: "Meet People",
    description: "Connect with travelers from around the world",
  },
  {
    icon: Star,
    title: "Build Reputation",
    description: "Grow your profile with reviews and ratings",
  },
]

type GuidePlanCard = {
  name: "Free" | "Pro"
  badge: string
  summary: string
  cta: string
  features: string[]
}

type GuidePlanApiResponse = {
  plans?: GuidePlanCard[]
}

type GuideStory = {
  id: string
  name: string
  city: string
  avatar: string | null
  quote: string
  tours: number
  rating: number
  reviewCount: number
}

type GuideStoriesApiResponse = {
  guides?: GuideStory[]
}

type LandingStatsResponse = {
  activeGuides: number
  activeCities: number
  completedBookings: number
  totalReviews: number
}

type QuickApplyForm = {
  firstName: string
  lastName: string
  email: string
  city: string
  primaryLanguage: string
  providerType: string
}

type EarningsPlan = "Free" | "Pro"

type EarningsCalculatorForm = {
  plan: EarningsPlan
  guestsPerTour: number
  avgTip: number
  toursPerWeek: number
}

const fallbackGuidePlans: GuidePlanCard[] = [
  {
    name: "Free",
    badge: "Free Forever",
    summary: "Free forever with your first tour, limited weekly schedules, and capped group size.",
    cta: "Start for Free",
    features: [
      "Up to 1 published tour",
      "Up to 5 schedules per week",
      "Up to 7 travelers per tour",
      "Guide profile, bookings, and messaging",
    ],
  },
  {
    name: "Pro",
    badge: "Scale Faster",
    summary: "Pro removes Free-plan caps so you can scale tours and scheduling without hard limits.",
    cta: "Upgrade to Pro Anytime",
    features: [
      "Everything in Free",
      "No cap on published tours",
      "No cap on schedules per week",
      "No cap on travelers per tour",
      "Priority support for active guides",
    ],
  },
]

const steps = [
  { id: 1, title: "Personal Info" },
  { id: 2, title: "About You" },
  { id: 3, title: "Verification" },
]

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

const cities = [
  "Paris",
  "Rome",
  "Barcelona",
  "London",
  "Amsterdam",
  "Prague",
  "Berlin",
  "Lisbon",
  "Vienna",
  "Athens",
  "Dublin",
  "Florence",
  "Madrid",
  "Budapest",
  "Copenhagen",
]

const providerTypes = [
  { value: "local_expert", label: "Local expert" },
  { value: "licensed_guide", label: "Licensed guide" },
  { value: "tour_company", label: "Tour company" },
  { value: "new_host", label: "First-time host" },
]

const fallbackLandingStats: LandingStatsResponse = {
  activeGuides: 500,
  activeCities: 150,
  completedBookings: 50000,
  totalReviews: 1200,
}

const FREE_PLAN_LIMITS = {
  maxGuestsPerTour: 7,
  maxToursPerWeek: 5,
}

const PRO_CALCULATOR_LIMITS = {
  maxGuestsPerTour: 20,
  maxToursPerWeek: 14,
}

const fallbackGuideStories: GuideStory[] = [
  {
    id: "fallback-pierre",
    name: "Pierre Gendrin",
    city: "Paris",
    avatar: null,
    quote: "Small groups changed everything for me. Guests ask better questions, engagement is higher, and tips are more consistent.",
    tours: 120,
    rating: 5,
    reviewCount: 12,
  },
  {
    id: "fallback-charles",
    name: "Charles Afeavo",
    city: "Paris",
    avatar: null,
    quote: "Touricho keeps operations simple. I publish availability, focus on quality tours, and get direct feedback after every walk.",
    tours: 80,
    rating: 5,
    reviewCount: 10,
  },
]

function formatMetricValue(value: number) {
  return `${new Intl.NumberFormat("en-US").format(Math.max(0, value))}+`
}

function formatEur(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value))
}

function getPlanDecisionCopy(planName: GuidePlanCard["name"]) {
  if (planName === "Free") {
    return {
      bestFor: "Best for: new sellers validating their first service",
      upgradeWhen: "Upgrade when: your calendar or group caps start limiting bookings",
    }
  }

  return {
    bestFor: "Best for: active sellers running multiple services per week",
    upgradeWhen: "Upgrade when: you need scale without operational limits",
  }
}

export default function BecomeGuidePage() {
  const [showForm, setShowForm] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quickApplyError, setQuickApplyError] = useState<string | null>(null)
  const [guidePlans, setGuidePlans] = useState<GuidePlanCard[]>(fallbackGuidePlans)
  const [guideStories, setGuideStories] = useState<GuideStory[]>([])
  const [landingStats, setLandingStats] = useState<LandingStatsResponse>(fallbackLandingStats)
  const [quickApplyForm, setQuickApplyForm] = useState<QuickApplyForm>({
    firstName: "",
    lastName: "",
    email: "",
    city: "",
    primaryLanguage: "English",
    providerType: "local_expert",
  })
  const [earningsForm, setEarningsForm] = useState<EarningsCalculatorForm>({
    plan: "Free",
    guestsPerTour: 5,
    avgTip: 10,
    toursPerWeek: 2,
  })
  const [formData, setFormData] = useState({
    // Step 1
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    // Step 2
    city: "",
    languages: [] as string[],
    bio: "",
    experience: "",
    // Step 3
    agreeTerms: false,
    agreePrivacy: false,
    idVerification: false,
  })
  const [isPreAuthenticated, setIsPreAuthenticated] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const { profile: authProfile, session: authSession } = useAuth()
  const hasTrackedQuickViewRef = useRef(false)
  const hasTrackedFullStartRef = useRef(false)
  const hasTrackedSubmitSuccessRef = useRef(false)

  const updateEarningsNumber = (field: "guestsPerTour" | "avgTip" | "toursPerWeek", value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return

    setEarningsForm((prev) => {
      const guestsMax = prev.plan === "Free" ? FREE_PLAN_LIMITS.maxGuestsPerTour : PRO_CALCULATOR_LIMITS.maxGuestsPerTour
      const toursMax = prev.plan === "Free" ? FREE_PLAN_LIMITS.maxToursPerWeek : PRO_CALCULATOR_LIMITS.maxToursPerWeek

      if (field === "guestsPerTour") {
        return { ...prev, guestsPerTour: Math.min(guestsMax, Math.max(1, Math.round(parsed))) }
      }
      if (field === "toursPerWeek") {
        return { ...prev, toursPerWeek: Math.min(toursMax, Math.max(1, Math.round(parsed))) }
      }
      return { ...prev, avgTip: Math.max(1, Math.round(parsed)) }
    })
  }

  // We now rely exclusively on the global Auth Context since users must verify email first
  // and will be fully authenticated when reaching this page.
  useEffect(() => {
    if (authSession) {
      setSession(authSession)
      setIsPreAuthenticated(true)
      setQuickApplyForm((prev) => ({
        ...prev,
        email: prev.email || authSession.user.email || "",
      }))
      
      if (authProfile) {
        setFormData(prev => ({
          ...prev,
          firstName: authProfile.full_name?.split(" ")[0] || prev.firstName,
          lastName: authProfile.full_name?.split(" ").slice(1).join(" ") || prev.lastName,
          email: authProfile.email || authSession.user.email || prev.email,
          phone: authProfile.phone || prev.phone,
          city: authProfile.city || prev.city,
          languages: authProfile.languages || prev.languages,
          bio: authProfile.bio || prev.bio,
        }))
        setQuickApplyForm((prev) => ({
          ...prev,
          firstName: authProfile.full_name?.split(" ")[0] || prev.firstName,
          lastName: authProfile.full_name?.split(" ").slice(1).join(" ") || prev.lastName,
          email: authProfile.email || authSession.user.email || prev.email,
          city: authProfile.city || prev.city,
          primaryLanguage: Array.isArray(authProfile.languages) && authProfile.languages.length > 0
            ? authProfile.languages[0]
            : prev.primaryLanguage,
        }))
        
        // If they already clicked "Become Seller" (returning user), show them the form immediately
        if (isSeller(authProfile.role) && !authProfile.onboarding_completed) {
          setShowForm(true)
        }
      }
    }
  }, [authSession, authProfile])

  useEffect(() => {
    let isMounted = true

    async function loadGuidePlans() {
      try {
        const response = await fetch("/api/public/guide-plans", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as GuidePlanApiResponse

        if (isMounted && Array.isArray(data.plans) && data.plans.length > 0) {
          setGuidePlans(data.plans)
        }
      } catch (fetchError) {
        console.error("[v0] Failed to load guide plans:", fetchError)
      }
    }

    void loadGuidePlans()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadGuideStories() {
      try {
        const response = await fetch("/api/public/guide-stories", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as GuideStoriesApiResponse

        if (isMounted && Array.isArray(data.guides)) {
          setGuideStories(data.guides)
        }
      } catch (fetchError) {
        console.error("[v0] Failed to load guide stories:", fetchError)
      }
    }

    void loadGuideStories()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadLandingStats() {
      try {
        const response = await fetch("/api/landing/stats", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as Partial<LandingStatsResponse>
        if (!isMounted) return

        setLandingStats({
          activeGuides: Number.isFinite(data.activeGuides) ? Math.max(0, Number(data.activeGuides)) : fallbackLandingStats.activeGuides,
          activeCities: Number.isFinite(data.activeCities) ? Math.max(0, Number(data.activeCities)) : fallbackLandingStats.activeCities,
          completedBookings: Number.isFinite(data.completedBookings)
            ? Math.max(0, Number(data.completedBookings))
            : fallbackLandingStats.completedBookings,
          totalReviews: Number.isFinite(data.totalReviews) ? Math.max(0, Number(data.totalReviews)) : fallbackLandingStats.totalReviews,
        })
      } catch (statsError) {
        console.error("[v0] Failed to load landing stats:", statsError)
      }
    }

    void loadLandingStats()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (showForm || hasTrackedQuickViewRef.current) return
    hasTrackedQuickViewRef.current = true
    trackFunnelEvent("guide_apply_quick_view", {
      city_selected: quickApplyForm.city || null,
      is_authenticated: Boolean(authSession),
      step: "quick_apply",
    })
  }, [authSession, quickApplyForm.city, showForm])

  useEffect(() => {
    if (!showForm || hasTrackedFullStartRef.current) return
    hasTrackedFullStartRef.current = true
    trackFunnelEvent("guide_apply_full_start", {
      city_selected: formData.city || quickApplyForm.city || null,
      is_authenticated: Boolean(authSession),
      step: 1,
    })
  }, [authSession, formData.city, quickApplyForm.city, showForm])

  useEffect(() => {
    if (!applicationSubmitted || hasTrackedSubmitSuccessRef.current) return
    hasTrackedSubmitSuccessRef.current = true
    trackFunnelEvent("guide_apply_submit_success", {
      city_selected: formData.city || quickApplyForm.city || null,
      is_authenticated: Boolean(authSession),
      step: 3,
    })
  }, [applicationSubmitted, authSession, formData.city, quickApplyForm.city])

  const visibleGuideStories = useMemo(
    () => (guideStories.length > 0 ? guideStories : fallbackGuideStories),
    [guideStories],
  )

  const proofMetrics = useMemo(
    () => [
      {
        label: "Active sellers",
        value: formatMetricValue(landingStats.activeGuides),
        hint: "sellers currently listing services",
      },
      {
        label: "Active cities",
        value: formatMetricValue(landingStats.activeCities),
        hint: "cities where guests can book",
      },
      {
        label: "Completed bookings",
        value: formatMetricValue(landingStats.completedBookings),
        hint: "bookings completed on Touricho",
      },
      {
        label: "Traveler reviews",
        value: formatMetricValue(landingStats.totalReviews),
        hint: "verified ratings and feedback",
      },
    ],
    [landingStats],
  )

  const calculatorLimits = useMemo(() => {
    if (earningsForm.plan === "Free") {
      return {
        guestsMax: FREE_PLAN_LIMITS.maxGuestsPerTour,
        toursMax: FREE_PLAN_LIMITS.maxToursPerWeek,
      }
    }
    return {
      guestsMax: PRO_CALCULATOR_LIMITS.maxGuestsPerTour,
      toursMax: PRO_CALCULATOR_LIMITS.maxToursPerWeek,
    }
  }, [earningsForm.plan])

  useEffect(() => {
    setEarningsForm((prev) => {
      const nextGuests = Math.min(prev.guestsPerTour, calculatorLimits.guestsMax)
      const nextTours = Math.min(prev.toursPerWeek, calculatorLimits.toursMax)
      if (nextGuests === prev.guestsPerTour && nextTours === prev.toursPerWeek) {
        return prev
      }
      return {
        ...prev,
        guestsPerTour: nextGuests,
        toursPerWeek: nextTours,
      }
    })
  }, [calculatorLimits.guestsMax, calculatorLimits.toursMax])

  const earningsProjection = useMemo(() => {
    const isFree = earningsForm.plan === "Free"
    const effectiveGuestsPerTour = isFree
      ? Math.min(earningsForm.guestsPerTour, FREE_PLAN_LIMITS.maxGuestsPerTour)
      : earningsForm.guestsPerTour
    const effectiveToursPerWeek = isFree
      ? Math.min(earningsForm.toursPerWeek, FREE_PLAN_LIMITS.maxToursPerWeek)
      : earningsForm.toursPerWeek

    const perTour = effectiveGuestsPerTour * earningsForm.avgTip
    const perWeek = perTour * effectiveToursPerWeek
    const perMonth = perWeek * 4

    const notes: string[] = []
    if (isFree && earningsForm.guestsPerTour > FREE_PLAN_LIMITS.maxGuestsPerTour) {
      notes.push(`Free plan caps guests per tour at ${FREE_PLAN_LIMITS.maxGuestsPerTour}.`)
    }
    if (isFree && earningsForm.toursPerWeek > FREE_PLAN_LIMITS.maxToursPerWeek) {
      notes.push(`Free plan caps schedules at ${FREE_PLAN_LIMITS.maxToursPerWeek} tours per week.`)
    }

    return {
      perTour,
      perWeek,
      perMonth,
      effectiveGuestsPerTour,
      effectiveToursPerWeek,
      notes,
    }
  }, [earningsForm])

  const dispatchGuideAssistantOpen = (source: string) => {
    trackFunnelEvent("guide_apply_assistant_open", {
      source,
      city_selected: formData.city || quickApplyForm.city || null,
      is_authenticated: Boolean(authSession),
      step: showForm ? currentStep : "quick_apply",
    })

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("touricho:assistant-open", {
          detail: {
            mode: "guest",
            source,
            prompt: "I am applying to become a seller. What is the fastest way to get approved?",
          },
        }),
      )
    }
  }

  const updateQuickApplyForm = (field: keyof QuickApplyForm, value: string) => {
    setQuickApplyForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleQuickApplySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuickApplyError(null)

    const normalized = {
      firstName: quickApplyForm.firstName.trim(),
      lastName: quickApplyForm.lastName.trim(),
      email: quickApplyForm.email.trim(),
      city: quickApplyForm.city.trim(),
      primaryLanguage: quickApplyForm.primaryLanguage.trim(),
      providerType: quickApplyForm.providerType,
    }

    if (!normalized.firstName || !normalized.lastName || !normalized.email || !normalized.city || !normalized.primaryLanguage) {
      setQuickApplyError("Please complete all quick-apply fields.")
      return
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)
    if (!emailValid) {
      setQuickApplyError("Please enter a valid email address.")
      return
    }

    setFormData((prev) => ({
      ...prev,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      email: normalized.email,
      city: normalized.city,
      languages: prev.languages.length > 0 ? prev.languages : [normalized.primaryLanguage],
      experience:
        prev.experience.trim().length > 0
          ? prev.experience
          : `Provider type: ${providerTypes.find((item) => item.value === normalized.providerType)?.label || "Local expert"}.`,
    }))

    trackFunnelEvent("guide_apply_quick_submit", {
      city_selected: normalized.city,
      is_authenticated: Boolean(authSession),
      step: "quick_apply",
      provider_type: normalized.providerType,
    })

    setShowForm(true)
    setCurrentStep(1)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const updateFormData = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleLanguage = (language: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter((l) => l !== language)
        : [...prev.languages, language],
    }))
  }

  const validateStep = (step: number): boolean => {
    setError(null)

    if (step === 1) {
      const trimmed = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
      }

      if (!trimmed.firstName || !trimmed.lastName || !trimmed.email || !trimmed.phone) {
        setError("Please fill in all required fields")
        return false
      }

      if (!isPreAuthenticated) {
        if (formData.password.length < 8) {
          setError("Password must be at least 8 characters long")
          return false
        }

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-=[\]{};':"\\|,.<>/?`~]).{8,}$/
        if (!strongPasswordRegex.test(formData.password)) {
          setError("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.")
          return false
        }
      }

      setFormData((prev) => ({ ...prev, ...trimmed }))
    }

    if (step === 2) {
      if (!formData.city) {
        setError("Please select your city")
        return false
      }

      if (formData.languages.length === 0) {
        setError("Please select at least one language")
        return false
      }

      const trimmedBio = formData.bio.trim()
      if (!trimmedBio) {
        setError("Please write a bio about yourself")
        return false
      }

      setFormData((prev) => ({ ...prev, bio: trimmedBio }))
    }

    if (step === 3) {
      if (!formData.agreeTerms || !formData.agreePrivacy || !formData.idVerification) {
        setError("Please accept all required agreements")
        return false
      }
    }

    return true
  }

  const handleNext = async () => {
    if (currentStep < 3) {
      if (!validateStep(currentStep)) return
      trackFunnelEvent("guide_apply_step_continue", {
        city_selected: formData.city || quickApplyForm.city || null,
        is_authenticated: Boolean(authSession),
        step: currentStep,
        next_step: currentStep + 1,
      })
      setCurrentStep(currentStep + 1)
    } else {
      if (!validateStep(3)) return
      setIsLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        const activeSession = authSession || session
        
        if (!activeSession) {
           setError("You must be logged in to complete this setup.")
           setIsLoading(false)
           return
        }

        setIsLoading(true)
        
        try {
          // 1. UPDATE PROFILE TABLE with pending approval status
          const updatePromise = supabase
            .from("profiles")
            .update({
              full_name: `${formData.firstName} ${formData.lastName}`,
              phone: formData.phone,
              city: formData.city,
              languages: formData.languages,
              bio: formData.bio,
              role: "guide",
              roles: ["tourist", "guide"],
              onboarding_completed: true,
              guide_approval_status: "pending",
            })
            .eq("id", activeSession.user.id)

          // Race against a longer timeout
          const { error: profileError } = await Promise.race([
            updatePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Database timeout (20s)")), 20000))
          ]) as any

          if (profileError) {
             throw new Error(`Profile update failed: ${profileError.message}`)
          }

          // 2. PROVISION BUSINESS RECORDS
          await supabase.from("guide_plans").upsert({ guide_id: activeSession.user.id, plan_type: "free" }, { onConflict: 'guide_id' })
          await supabase.from("guide_credits").upsert({ guide_id: activeSession.user.id, balance: 0 }, { onConflict: 'guide_id' })

          // 3. CREATE ADMIN NOTIFICATION
          await fetch("/api/admin/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "guide_application",
              title: "New Guide Application",
              message: `${formData.firstName} ${formData.lastName} (${formData.email}) has submitted a guide application for ${formData.city}.`,
              data: {
                guide_id: activeSession.user.id,
                full_name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                city: formData.city,
              },
            }),
          })

          // 4. SIGN OUT — guide cannot access dashboard until approved
          await supabase.auth.signOut()

          // 5. SHOW SUCCESS STATE
          setApplicationSubmitted(true)

        } catch (err: any) {
           setError(`Submission failed: ${err.message}`)
           setIsLoading(false)
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred during registration"
        setError(formatAuthError(errorMessage))
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const progress = (currentStep / 3) * 100
  const scrollToQuickApply = () => {
    document.getElementById("quick-apply-card")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (!showForm) {
    return (
      <div className="public-template-page landing-template flex min-h-screen flex-col">
        <Navbar variant="landingTemplate" />

        <main className="public-template-main flex-1">
          <section className="public-hero-section py-16 md:py-24">
            <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:px-8">
              <div>
                <h1 className="public-template-heading text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                  Share Your City, <span className="text-primary">Earn Your Way</span>
                </h1>
                <p className="public-template-copy mt-6 max-w-2xl text-lg leading-relaxed">
                  Join passionate locals on Touricho. Lead free walking tours, host smaller groups, and keep 100% of
                  traveler tips.
                </p>
                <p className="mt-3 text-sm font-semibold text-primary">Start in 60 seconds. No upfront subscription required.</p>
                <p className="mt-2 text-sm text-[color:var(--landing-muted)]">
                  Next step after quick apply: complete profile details, submit for review, and publish after approval.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="landing-btn-coral"
                    onClick={() => {
                      document.getElementById("quick-apply-card")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                  >
                    Start in 60 Seconds <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]"
                    onClick={() => dispatchGuideAssistantOpen("hero")}
                  >
                    Need Help First?
                  </Button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Shield className="h-4 w-4 text-primary" />
                      Verification-first onboarding
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Identity and profile checks before first published service.</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Heart className="h-4 w-4 text-primary" />
                      Keep 100% of tips
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">No platform cut on guest tips received after services.</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4">
                  <p className="text-sm font-semibold text-foreground">Need help becoming a seller?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Get a fast answer now via assistant. If needed, we route you to human follow-up.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="landing-btn-coral" onClick={() => dispatchGuideAssistantOpen("hero_support")}>
                      Open Seller Assistant
                    </Button>
                    <Button size="sm" variant="outline" className="bg-transparent" asChild>
                      <Link href="mailto:support@touricho.com">Email Support</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <Card id="quick-apply-card" className="public-shell-card">
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-xl font-semibold text-foreground">Quick Apply</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Complete this to unlock your full application setup.</p>
                  <form className="mt-5 space-y-4" onSubmit={handleQuickApplySubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="qa-first-name">First name</Label>
                        <Input
                          id="qa-first-name"
                          value={quickApplyForm.firstName}
                          onChange={(event) => updateQuickApplyForm("firstName", event.target.value)}
                          className="mt-1.5"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="qa-last-name">Last name</Label>
                        <Input
                          id="qa-last-name"
                          value={quickApplyForm.lastName}
                          onChange={(event) => updateQuickApplyForm("lastName", event.target.value)}
                          className="mt-1.5"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="qa-email">Email</Label>
                      <Input
                        id="qa-email"
                        type="email"
                        value={quickApplyForm.email}
                        onChange={(event) => updateQuickApplyForm("email", event.target.value)}
                        className="mt-1.5"
                        required
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>City</Label>
                        <Select value={quickApplyForm.city} onValueChange={(value) => updateQuickApplyForm("city", value)}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select city" />
                          </SelectTrigger>
                          <SelectContent>
                            {cities.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Primary language</Label>
                        <Select
                          value={quickApplyForm.primaryLanguage}
                          onValueChange={(value) => updateQuickApplyForm("primaryLanguage", value)}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {languages.map((lang) => (
                              <SelectItem key={lang} value={lang}>
                                {lang}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Provider type</Label>
                      <Select
                        value={quickApplyForm.providerType}
                        onValueChange={(value) => updateQuickApplyForm("providerType", value)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select provider type" />
                        </SelectTrigger>
                        <SelectContent>
                          {providerTypes.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {quickApplyError ? (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{quickApplyError}</p>
                    ) : null}

                    <Button type="submit" className="landing-btn-coral w-full">
                      Continue to Full Application <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <p className="text-xs text-muted-foreground">Takes about 60 seconds. Full details can be completed next.</p>
                  </form>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="public-section-soft py-8 md:py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {proofMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">Active sellers</p>
                    <p className="mt-1 text-2xl font-bold text-[color:var(--landing-ink)]">{metric.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="public-section-soft py-12 md:py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="public-shell-card p-6 sm:p-8">
                <h2 className="public-template-heading text-2xl font-bold tracking-tight">Conservative earnings calculator</h2>
                <p className="public-template-copy mt-3 text-sm leading-7">
                  These numbers are illustrative, not guaranteed. Actual tips depend on route quality, group size,
                  seasonality, and guest satisfaction. Free plan limits are applied automatically.
                </p>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-foreground">Your assumptions</h3>
                    <div className="mt-4 grid gap-5">
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>Plan</Label>
                          <span className="text-xs font-semibold text-primary">{earningsForm.plan}</span>
                        </div>
                        <Select
                          value={earningsForm.plan}
                          onValueChange={(value) => setEarningsForm((prev) => ({ ...prev, plan: value as EarningsPlan }))}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Free">Free</SelectItem>
                            <SelectItem value="Pro">Pro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="calc-guests">Guests per tour</Label>
                          <span className="text-xs font-semibold text-foreground">{earningsForm.guestsPerTour}</span>
                        </div>
                        <Input
                          id="calc-guests"
                          type="range"
                          min={1}
                          max={calculatorLimits.guestsMax}
                          step={1}
                          value={earningsForm.guestsPerTour}
                          onChange={(event) => updateEarningsNumber("guestsPerTour", event.target.value)}
                          className="mt-2 h-2 cursor-pointer p-0 accent-primary"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {earningsForm.plan === "Free"
                            ? `Free plan max: ${FREE_PLAN_LIMITS.maxGuestsPerTour} guests`
                            : `Pro calculator max: ${PRO_CALCULATOR_LIMITS.maxGuestsPerTour} guests`}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="calc-tip">Average tip per guest (€)</Label>
                          <span className="text-xs font-semibold text-foreground">€{earningsForm.avgTip}</span>
                        </div>
                        <Input
                          id="calc-tip"
                          type="range"
                          min={1}
                          max={50}
                          step={1}
                          value={earningsForm.avgTip}
                          onChange={(event) => updateEarningsNumber("avgTip", event.target.value)}
                          className="mt-2 h-2 cursor-pointer p-0 accent-primary"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Tip range slider: €1 to €50</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="calc-tours">Tours per week</Label>
                          <span className="text-xs font-semibold text-foreground">{earningsForm.toursPerWeek}</span>
                        </div>
                        <Input
                          id="calc-tours"
                          type="range"
                          min={1}
                          max={calculatorLimits.toursMax}
                          step={1}
                          value={earningsForm.toursPerWeek}
                          onChange={(event) => updateEarningsNumber("toursPerWeek", event.target.value)}
                          className="mt-2 h-2 cursor-pointer p-0 accent-primary"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {earningsForm.plan === "Free"
                            ? `Free plan max: ${FREE_PLAN_LIMITS.maxToursPerWeek} tours/week`
                            : `Pro calculator max: ${PRO_CALCULATOR_LIMITS.maxToursPerWeek} tours/week`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">Per tour</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{formatEur(earningsProjection.perTour)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {earningsProjection.effectiveGuestsPerTour} guests × {formatEur(earningsForm.avgTip)} average tip
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">Per week</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{formatEur(earningsProjection.perWeek)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Based on {earningsProjection.effectiveToursPerWeek} tour{earningsProjection.effectiveToursPerWeek === 1 ? "" : "s"} per week
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--landing-muted)]">Estimated 4-week month</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{formatEur(earningsProjection.perMonth)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">For planning only. Actuals vary by demand and reviews.</p>
                    </div>
                  </div>
                </div>

                {earningsProjection.notes.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4">
                    <p className="text-sm font-semibold text-foreground">Free plan limits applied</p>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {earningsProjection.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-medium text-primary">
                      Pro removes these caps so your weekly earning potential can scale.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="public-section py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="public-template-heading text-3xl font-bold tracking-tight">Hear From Our Sellers</h2>
                <p className="public-template-copy mt-4 text-lg">Trusted feedback from sellers already running services.</p>
              </div>
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {visibleGuideStories.map((guide) => (
                  <Card key={guide.id} className="landing-card">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {guide.avatar ? (
                          <Image
                            src={getStorageUrl(guide.avatar, "avatars")}
                            alt={guide.name}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                            {guide.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="mb-4 text-muted-foreground italic">"{guide.quote}"</p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{guide.name}</p>
                              <p className="text-sm text-muted-foreground">Seller in {guide.city}</p>
                            </div>
                            <div className="text-right text-sm">
                              <div className="flex items-center justify-end gap-1">
                                <Star className="h-4 w-4 fill-chart-3 text-chart-3" />
                                <span className="font-semibold">{guide.rating.toFixed(1)}</span>
                              </div>
                              <p className="text-muted-foreground">{guide.reviewCount} reviews</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section className="public-section py-16 md:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="public-template-heading text-3xl font-bold tracking-tight">Why Become a Seller?</h2>
                <p className="public-template-copy mt-4 text-lg">
                  Join our community of passionate storytellers and local experts
                </p>
              </div>
              <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                {benefits.map((benefit) => (
                  <Card key={benefit.title} className="landing-card text-center">
                    <CardContent className="pt-6">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                        <benefit.icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-foreground">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Plan Comparison */}
          <section className="public-section-soft py-16 md:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="public-template-heading text-3xl font-bold tracking-tight">Free and Pro for Every Stage</h2>
                <p className="public-template-copy mt-4 text-lg">
                  Begin with Free, grow with Pro when you need more reach. No lock-in, no pressure.
                </p>
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {guidePlans.map((plan) => (
                    <Card key={plan.name} className="public-shell-card">
                      <CardContent className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {plan.badge}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{plan.summary}</p>
                      <ul className="mt-6 space-y-3">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 space-y-1 rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-3">
                        <p className="text-xs font-semibold text-foreground">{getPlanDecisionCopy(plan.name).bestFor}</p>
                        <p className="text-xs text-muted-foreground">{getPlanDecisionCopy(plan.name).upgradeWhen}</p>
                      </div>
                      <Button className={plan.name === "Pro" ? "mt-6 w-full border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]" : "landing-btn-coral mt-6 w-full"} variant={plan.name === "Pro" ? "outline" : "default"} onClick={scrollToQuickApply}>
                        {plan.cta}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section id="how-it-works" className="public-section-soft py-16 md:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="public-template-heading text-3xl font-bold tracking-tight">How It Works</h2>
                <p className="public-template-copy mt-4 text-lg">Get started in just a few simple steps</p>
              </div>
              <div className="mt-12 grid gap-8 md:grid-cols-3">
                <div className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    1
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">Create Your Profile</h3>
                  <p className="text-muted-foreground">
                    Sign up and tell us about yourself, your experience, and the languages you speak.
                  </p>
                </div>
                <div className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    2
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">Design Your Tours</h3>
                  <p className="text-muted-foreground">
                    Create unique walking tours showcasing the best of your city. Set your schedule and meeting points.
                  </p>
                </div>
                <div className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    3
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">Start Earning</h3>
                  <p className="text-muted-foreground">
                    Accept bookings, lead tours, and receive tips directly from happy travelers.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="public-section-soft py-16 md:py-24">
            <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
              <h2 className="public-template-heading text-3xl font-bold tracking-tight">
                Ready to Start Your Journey?
              </h2>
              <p className="public-template-copy mt-4 text-lg">
                Join our community of sellers and start sharing your city with the world.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" className="landing-btn-coral" onClick={scrollToQuickApply}>
                  Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent" onClick={() => dispatchGuideAssistantOpen("bottom_cta")}>
                  Need Help First?
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Assistant gives fast guidance now, with human follow-up if needed.
              </p>
              <Button size="sm" variant="link" className="mt-2" asChild>
                <Link href="mailto:support@touricho.com">support@touricho.com</Link>
              </Button>
            </div>
          </section>
        </main>

        <Footer variant="landingTemplate" />
      </div>
    )
  }

  // Success state after application submission
  if (applicationSubmitted) {
    return (
      <div className="public-template-page landing-template flex min-h-screen flex-col">
        <Navbar variant="landingTemplate" />
        <main className="public-section-soft flex flex-1 items-center justify-center py-12">
          <div className="mx-auto max-w-lg px-4 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-secondary/15">
              <CheckCircle className="h-10 w-10 text-secondary" />
            </div>
            <h1 className="public-template-heading text-3xl font-bold">Thank You for Your Interest!</h1>
            <p className="public-template-copy mt-4 text-lg">
              We have received your seller application and our team is currently reviewing it.
            </p>
            <div className="public-shell-card mt-6 space-y-3 p-6 text-left">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  You will receive an email at <span className="font-medium text-foreground">{formData.email}</span> once your application has been reviewed.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  For security purposes, you will not be able to log in until your application is approved.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Review typically takes 1–3 business days. We appreciate your patience!
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="landing-btn-coral mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Back to Homepage
            </Link>
          </div>
        </main>
        <Footer variant="landingTemplate" />
      </div>
    )
  }

  return (
    <div className="public-template-page landing-template flex min-h-screen flex-col">
      <Navbar variant="landingTemplate" />

      <main className="public-section-soft flex-1 py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          {/* Progress Header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Become a Seller</h1>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="mt-4 flex justify-between">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 text-sm ${
                    step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      step.id < currentStep
                        ? "bg-primary text-primary-foreground"
                        : step.id === currentStep
                          ? "border-2 border-primary text-primary"
                          : "border border-muted-foreground text-muted-foreground"
                    }`}
                  >
                    {step.id < currentStep ? <Check className="h-3 w-3" /> : step.id}
                  </div>
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <Card className="public-shell-card">
            <CardContent className="p-6 sm:p-8">
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Personal Information</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Tell us about yourself</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => updateFormData("lastName", e.target.value)}
                        className="mt-1.5"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      className="mt-1.5"
                      required
                      disabled={isPreAuthenticated}
                    />
                    {isPreAuthenticated && (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        Connected as {formData.email}
                      </p>
                    )}
                  </div>
                  {!isPreAuthenticated && (
                    <div>
                      <Label htmlFor="password">Create Password <span className="text-destructive">*</span></Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => updateFormData("password", e.target.value)}
                        className="mt-1.5"
                        required
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Must be at least 8 characters</p>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateFormData("phone", e.target.value)}
                      className="mt-1.5"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 2: About You */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">About You</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Share your background and what makes you a great seller
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="city">City Where You'll Operate <span className="text-destructive">*</span></Label>
                    <Select value={formData.city} onValueChange={(value) => updateFormData("city", value)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select your city" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Languages You Speak <span className="text-destructive">*</span></Label>
                    <p className="mt-1 text-xs text-muted-foreground">Select at least one language</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {languages.map((lang) => (
                        <Button
                          key={lang}
                          type="button"
                          variant={formData.languages.includes(lang) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleLanguage(lang)}
                        >
                          {lang}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => updateFormData("bio", e.target.value)}
                      placeholder="Tell travelers about yourself, your background, and why you love your city..."
                      className="mt-1.5 min-h-[120px]"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience">Experience</Label>
                    <Textarea
                      id="experience"
                      value={formData.experience}
                      onChange={(e) => updateFormData("experience", e.target.value)}
                      placeholder="Describe any relevant experience you have (professional guiding, hospitality, teaching, etc.)"
                      className="mt-1.5 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Verification */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Verification & Agreement</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Almost there! Review and accept our terms to complete your application
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h3 className="mb-3 font-semibold text-foreground">Application Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium text-foreground">
                          {formData.firstName} {formData.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">City</span>
                        <span className="font-medium text-foreground">{formData.city || "Not selected"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Languages</span>
                        <span className="font-medium text-foreground">
                          {formData.languages.length > 0 ? formData.languages.join(", ") : "None selected"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Shield className="h-4 w-4 text-primary" />
                      Verification review before your first published service
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Our team reviews profile quality and identity checks to protect guest trust and improve booking conversion.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="agreeTerms"
                        checked={formData.agreeTerms}
                        onCheckedChange={(checked) => updateFormData("agreeTerms", checked)}
                        required
                      />
                      <label htmlFor="agreeTerms" className="text-sm text-muted-foreground cursor-pointer">
                        I agree to Touricho's{" "}
                        <Link href="/terms" className="text-primary hover:underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/guide-agreement" className="text-primary hover:underline">
                          Guide Agreement
                        </Link>{" "}
                        <span className="text-destructive">*</span>
                      </label>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="agreePrivacy"
                        checked={formData.agreePrivacy}
                        onCheckedChange={(checked) => updateFormData("agreePrivacy", checked)}
                        required
                      />
                      <label htmlFor="agreePrivacy" className="text-sm text-muted-foreground cursor-pointer">
                        I agree to the{" "}
                        <Link href="/privacy" className="text-primary hover:underline">
                          Privacy Policy
                        </Link>{" "}
                        and consent to the processing of my personal data{" "}
                        <span className="text-destructive">*</span>
                      </label>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="idVerification"
                        checked={formData.idVerification}
                        onCheckedChange={(checked) => updateFormData("idVerification", checked)}
                        required
                      />
                      <label htmlFor="idVerification" className="text-sm text-muted-foreground cursor-pointer">
                        I understand that ID verification may be required before my first tour can be published{" "}
                        <span className="text-destructive">*</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-4">
                <p className="text-sm font-semibold text-foreground">Need help becoming a guide?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask the assistant now for fast guidance. If needed, we will route you to human support.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="landing-btn-coral" onClick={() => dispatchGuideAssistantOpen("form_footer")}>
                    Open Guide Assistant
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="bg-transparent" asChild>
                    <Link href="mailto:support@touricho.com">Email Support</Link>
                  </Button>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="mt-8 flex justify-between">
                <Button variant="outline" onClick={handleBack} disabled={currentStep === 1 || isLoading}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext} disabled={isLoading}>
                  {isLoading ? "Creating account..." : currentStep === 3 ? "Submit Application" : "Continue"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/15 dark:text-destructive">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer variant="landingTemplate" />
    </div>
  )
}
