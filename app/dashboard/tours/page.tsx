"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  MapPin,
  Plus,
  Search,
  MoreVertical,
  Star,
  Users,
  Eye,
  Edit,
  Trash2,
  Clock,
  Globe,
  Crown,
  AlertTriangle,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type GuideTier, getTierLimits, formatTourLimit, formatCapacity } from "@/lib/guide-tiers"
import { useAuth } from "@/lib/supabase/auth-context"
import { useUserStore } from "@/store/user-store"
import { LoadingSpinner } from "@/components/loading-spinner"

export default function ToursPage() {
  const router = useRouter()
  const { user, profile: authProfile, isLoading: authLoading } = useAuth()
  const { profile, planType, planLoading, fetchPlan } = useUserStore()
  const [tours, setTours] = useState<any[]>([])
  const [filteredTours, setFilteredTours] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")

  const guideTier = planType as GuideTier

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (authProfile && authProfile.role !== "guide") {
      router.push("/")
    }
  }, [authLoading, user, authProfile, router])
  
  useEffect(() => {
    if (user && profile?.role === 'guide') {
      fetchPlan()
    }
  }, [user, profile?.role])
  useEffect(() => {
    const fetchTours = async () => {
      try {
        setIsLoading(true)

        const response = await fetch("/api/tours")
        if (response.ok) {
          const data = await response.json()
          const nowMs = Date.now()
          const processedTours = data.map((tour: any) => {
            const reviews = tour.reviews || []
            const reviewCount = reviews.length
            const avgRating = reviewCount > 0 
              ? Number((reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / reviewCount).toFixed(1))
              : 0
            const hasUpcomingDates = Array.isArray(tour.tour_schedules)
              ? tour.tour_schedules.some((schedule: any) => {
                  const startMs = new Date(String(schedule?.start_time || "")).getTime()
                  return Number.isFinite(startMs) && startMs > nowMs
                })
              : false
            return {
              ...tour,
              average_rating: avgRating,
              reviews: reviewCount, // This fulfills the expectation of TourCard
              has_upcoming_dates: hasUpcomingDates,
            }
          })
          setTours(processedTours)
        }
      } catch (error) {
        console.error("[v0] Error fetching tours:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (user) {
      fetchTours()
    }
  }, [user])

  useEffect(() => {
    let filtered = tours

    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.city.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else if (sortBy === "popular") {
      filtered.sort((a, b) => (b.total_bookings || 0) - (a.total_bookings || 0))
    } else if (sortBy === "rating") {
      filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
    }

    setFilteredTours(filtered)
  }, [tours, searchQuery, sortBy])
  
  const tierLimits = getTierLimits(guideTier)

  const activeTours = filteredTours.filter((t) => t.status === "published" || t.published_at)
  const draftTours = filteredTours.filter((t) => t.status === "draft" || !t.published_at)

  const totalBookings = Math.max(0, filteredTours.reduce((acc, t) => {
    const bookings = Number(t.total_bookings) || 0
    return acc + (isNaN(bookings) ? 0 : bookings)
  }, 0))
  
  const totalViews = Math.max(0, filteredTours.reduce((acc, t) => {
    const views = Number(t.views) || 0
    return acc + (isNaN(views) ? 0 : views)
  }, 0))
  
  const avgRating = filteredTours.length > 0
    ? Math.max(0, filteredTours
        .filter((t) => (t.average_rating || 0) > 0)
        .reduce((acc, t, _, arr) => {
          const rating = Number(t.average_rating) || 0
          return acc + (isNaN(rating) ? 0 : rating / arr.length)
        }, 0))
    : 0

  const canCreateTour = guideTier === "pro" || activeTours.length < tierLimits.maxTours

  const handleCreateTour = () => {
    if (!canCreateTour) {
      // setShowUpgradeDialog(true)
    }
  }

  const handleDeleteTour = async (tourId: string) => {
    if (!confirm("Are you sure you want to delete this tour?")) return

    try {
      const response = await fetch(`/api/tours/${tourId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setTours(tours.filter((t) => t.id !== tourId))
      }
    } catch (error) {
      console.error("[v0] Error deleting tour:", error)
    }
  }

  if (authLoading || planLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <LoadingSpinner label="Loading tours..." />
      </div>
    )
  }

  if (!user || authProfile?.role !== "guide") {
    return null
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 lg:p-8">
          <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">My Tours</h1>
              <p className="text-sm text-muted-foreground">Manage your walking tours</p>
            </div>
            {canCreateTour ? (
              <Button asChild>
                <Link href="/dashboard/tours/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tour
                </Link>
              </Button>
            ) : (
              <Button onClick={handleCreateTour}>
                <Lock className="w-4 h-4 mr-2" />
                Create Tour
              </Button>
            )}
          </section>

          {guideTier === "free" && activeTours.length >= tierLimits.maxTours && (
            <Card className="mb-6 border-primary/30 bg-primary/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-primary">Tour Limit Reached</h3>
                    <p className="text-sm text-primary mt-1">
                      You have reached your limit of {formatTourLimit(tierLimits.maxTours)} on the Free plan. Upgrade to
                      Pro for unlimited tours and higher guest capacity.
                    </p>
                  </div>
                  <Link href="/dashboard/upgrade">
                    <Button size="sm" className="bg-primary hover:bg-primary">
                      <Crown className="w-4 h-4 mr-1" />
                      Upgrade
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${guideTier === "pro" ? "bg-gradient-to-r from-primary to-secondary" : "bg-muted"}`}
                  >
                    {guideTier === "pro" ? (
                      <Crown className="w-6 h-6 text-white" />
                    ) : (
                      <MapPin className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{guideTier === "pro" ? "Pro Plan" : "Free Plan"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {guideTier === "pro" ? (
                        "Unlimited tours and capacity"
                      ) : (
                        <>
                          {formatTourLimit(tierLimits.maxTours)} | {formatCapacity(tierLimits.maxCapacityPerTour)} max
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{activeTours.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {guideTier === "pro" ? "Active Tours" : `of ${tierLimits.maxTours} tours`}
                    </p>
                  </div>
                  {guideTier === "free" && (
                    <Link href="/dashboard/upgrade">
                      <Button variant="outline" className="gap-2 bg-transparent">
                        <Crown className="w-4 h-4" />
                        Upgrade
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredTours.length}</p>
                    <p className="text-sm text-muted-foreground">Total Tours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isNaN(totalBookings) ? 0 : totalBookings}</p>
                    <p className="text-sm text-muted-foreground">Total Bookings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isNaN(avgRating) ? "0.0" : avgRating.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Avg. Rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isNaN(totalViews) ? 0 : (totalViews ?? 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Views</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tours..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tours Tabs */}
          <Tabs defaultValue="active" className="space-y-6">
            <TabsList>
              <TabsTrigger value="active">Active ({activeTours.length})</TabsTrigger>
              <TabsTrigger value="drafts">Drafts ({draftTours.length})</TabsTrigger>
              <TabsTrigger value="all">All ({filteredTours.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} guideTier={guideTier} onDelete={handleDeleteTour} />
              ))}
            </TabsContent>

            <TabsContent value="drafts" className="space-y-4">
              {draftTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} guideTier={guideTier} onDelete={handleDeleteTour} />
              ))}
              {draftTours.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No draft tours</h3>
                    <p className="text-muted-foreground mb-4">All your tours are published!</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              {filteredTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} guideTier={guideTier} onDelete={handleDeleteTour} />
              ))}
            </TabsContent>
          </Tabs>
    </main>
  )
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function TourCard({
  tour,
  guideTier,
  onDelete,
}: { tour: any; guideTier: GuideTier; onDelete: (tourId: string) => void }) {
  const tierLimits = getTierLimits(guideTier)
  const isCapacityLimited = guideTier === "free" && tour.max_capacity <= tierLimits.maxCapacityPerTour

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Image */}
          <div className="relative w-full md:w-48 h-48 md:h-auto flex-shrink-0">
            <Image 
              src={tour.photos?.[0] || tour.images?.[0] || tour.image || "/placeholder.svg"} 
              alt={tour.title} 
              fill 
              className="object-cover" 
            />
            {tour.featured && (
              <Badge className="absolute top-2 left-2 bg-primary">
                <Star className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-lg">{tour.title}</h3>
                  <Badge variant={tour.status === "published" || tour.published_at ? "default" : "secondary"}>
                    {tour.status === "published" || tour.published_at ? "Published" : "Draft"}
                  </Badge>
                  {isCapacityLimited && (
                    <Badge variant="outline" className="text-primary border-primary/30">
                      <Users className="w-3 h-3 mr-1" />
                      {tour.max_capacity} max
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {tour.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {tour.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {tour.languages.join(", ")}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Star className="w-4 h-4 text-primary fill-amber-500" />
                      {tour.average_rating > 0 ? tour.average_rating : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reviews</p>
                    <p className="font-semibold">{tour.reviews}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bookings</p>
                    <p className="font-semibold">{tour.total_bookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Views</p>
                    <p className="font-semibold">{(tour.views ?? 0).toLocaleString()}</p>
                  </div>
                </div>

                {(tour.status === "published" || tour.published_at) && !tour.has_upcoming_dates && (
                  <div className="mt-4 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-100">
                    ⚠️ Your tour has no upcoming dates — add availability so travelers can book.
                  </div>
                )}
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/tours/${tour.id}`} className="flex items-center">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Tour
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(tour.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Tour
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
