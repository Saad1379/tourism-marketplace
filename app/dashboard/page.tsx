"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import Link from "next/link"
import { Calendar, Users, Zap, Map, Star, Plus, BarChart3, Car } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/loading-spinner"
import { StatCard } from "@/components/shared/stat-card"
import { BookingCard } from "@/components/shared/booking-card"
import { EmptyState } from "@/components/shared/empty-state"

import { isSeller } from "@/lib/marketplace/roles"

export default function SellerDashboard() {
  const router = useRouter()
  const { user, session, profile, isLoading } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [tours, setTours] = useState<any[]>([])
  const [cars, setCars] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [credits, setCredits] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tourCreationAttempted, setTourCreationAttempted] = useState(false)

  useEffect(() => {
    if (!isLoading && !session) router.push("/login")
  }, [isLoading, session, router])

  useEffect(() => {
    if (!isLoading && profile && !isSeller(profile.role)) router.push("/")
  }, [isLoading, profile, router])

  // Create pending tour from localStorage (non-blocking)
  useEffect(() => {
    const createPendingTour = async () => {
      if (!user || !session || tourCreationAttempted) return
      const pendingTour = localStorage.getItem("pendingTour")
      if (!pendingTour) return
      setTourCreationAttempted(true)
      try {
        const tourData = JSON.parse(pendingTour)
        const response = await fetch("/api/tours/create-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(tourData),
        })
        if (response.ok) {
          localStorage.removeItem("pendingTour")
          const toursRes = await fetch("/api/tours?role=seller", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          if (toursRes.ok) {
            const data = await toursRes.json()
            setTours(Array.isArray(data) ? data : [])
          }
        }
      } catch {
        // silent fail — tour can be created manually
      }
    }
    const timer = setTimeout(createPendingTour, 1000)
    return () => clearTimeout(timer)
  }, [user, session, tourCreationAttempted])

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || !session) return
      try {
        setDataLoading(true)
        const headers = { Authorization: `Bearer ${session.access_token}` }
        const [bookingsRes, toursRes, creditsRes, reviewsRes, carsRes] = await Promise.all([
          fetch("/api/bookings?role=seller", { headers }),
          fetch("/api/tours?role=seller", { headers }),
          fetch("/api/credits", { headers }),
          fetch("/api/reviews", { headers }),
          fetch("/api/cars?include_own=true", { headers }),
        ])

        if (bookingsRes.ok) {
          const data = await bookingsRes.json()
          const formatted = (Array.isArray(data) ? data : []).map((b: any) => ({
            id: b.id,
            tour: { title: b.tour_schedules?.tours?.title || "Tour", city: b.tour_schedules?.tours?.city || "—" },
            start_time: b.tour_schedules?.start_time || null,
            date: b.tour_schedules?.start_time ? new Date(b.tour_schedules.start_time).toLocaleDateString() : "—",
            time: b.tour_schedules?.start_time
              ? new Date(b.tour_schedules.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—",
            guests: (b.adults ?? 0) + (b.children ?? 0),
            adults: b.adults ?? 0,
            children: b.children ?? 0,
            status: b.status || "confirmed",
          }))
          setBookings(formatted)
        }
        if (toursRes.ok) {
          const data = await toursRes.json()
          setTours(Array.isArray(data) ? data : [])
        }
        if (creditsRes.ok) {
          const data = await creditsRes.json()
          setCredits(data)
        }
        if (carsRes.ok) {
          const data = await carsRes.json()
          setCars(Array.isArray(data) ? data : [])
        }
        if (reviewsRes.ok) {
          const data = await reviewsRes.json()
          setReviews(Array.isArray(data) ? data.slice(0, 5) : [])
        }
      } catch (err) {
        setError("Failed to load dashboard data")
        console.error(err)
      } finally {
        setDataLoading(false)
      }
    }
    if (user && session) fetchDashboardData()
  }, [user, session])

  if (isLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session || !profile || !isSeller(profile.role)) return null

  const publishedTours = tours.filter((t: any) => t.status === "published").length
  const draftTours = tours.filter((t: any) => t.status === "draft").length
  const publishedCars = cars.filter((c: any) => c.status === "published").length
  const draftCars = cars.filter((c: any) => c.status === "draft").length
  
  const now = Date.now()
  const upcomingBookings = bookings.filter((booking: any) => {
    const timestamp = booking.start_time ? new Date(booking.start_time).getTime() : 0
    return (booking.status === "confirmed" || booking.status === "pending") && timestamp > now
  })
  const totalGuests = bookings.reduce((sum: number, b: any) => sum + b.guests, 0)
  const visibleBookings = upcomingBookings.slice(0, 3)

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI Stats */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-4">At a glance</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Active Tours"     value={publishedTours}          icon={Map}      variant="primary" />
          <StatCard label="Active Cars"      value={publishedCars}           icon={Car}      variant="secondary" />
          <StatCard label="Drafts (Total)"   value={draftTours + draftCars}  icon={Plus}     variant="accent" />
          <StatCard label="Total Guests"     value={totalGuests}             icon={Users}    variant="primary" />
          <StatCard label="Credits Balance"  value={credits?.balance ?? 0}  icon={Zap}      variant="primary" />
        </div>
      </section>

      {/* Quick actions */}
      <section className="flex flex-wrap gap-3">
        <Link href="/dashboard/tours/new">
          <Button variant="outline" size="sm" className="dashboard-pill-btn rounded-lg gap-2 bg-transparent">
            <Plus className="w-3.5 h-3.5" />
            New Tour
          </Button>
        </Link>
        <Link href="/dashboard/bookings">
          <Button variant="outline" size="sm" className="dashboard-pill-btn rounded-lg gap-2 bg-transparent">
            <Calendar className="w-3.5 h-3.5" />
            All Bookings
          </Button>
        </Link>
        <Link href="/dashboard/analytics">
          <Button variant="outline" size="sm" className="dashboard-pill-btn rounded-lg gap-2 bg-transparent">
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </Button>
        </Link>
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Upcoming Bookings */}
        <Card className="dashboard-card lg:col-span-2 rounded-2xl">
          <CardHeader className="pb-0 border-b border-border/40">
            <div className="flex items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Upcoming Bookings</CardTitle>
                <CardDescription className="text-xs mt-0.5">Your next scheduled tours</CardDescription>
              </div>
              <Link href="/dashboard/bookings">
                <Button variant="ghost" size="sm" className="dashboard-pill-btn h-7 rounded-lg bg-transparent text-xs">
                  View all
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {visibleBookings.length > 0 ? (
              <div className="space-y-3">
                {visibleBookings.map((booking: any) => (
                  <BookingCard
                    key={booking.id}
                    tour={booking.tour}
                    date={booking.date}
                    time={booking.time}
                    guests={booking.guests}
                    adults={booking.adults}
                    children={booking.children}
                    status={booking.status}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Calendar}
                title="No upcoming bookings"
                description="When travelers book your tours they'll appear here."
                action={{ label: "Create a Tour", href: "/dashboard/tours" }}
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Reviews */}
        <Card className="dashboard-card rounded-2xl">
          <CardHeader className="pb-0 border-b border-border/40">
            <div className="flex items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Recent Reviews</CardTitle>
                <CardDescription className="text-xs mt-0.5">Feedback from your guests</CardDescription>
              </div>
              <Link href="/dashboard/reviews">
                <Button variant="ghost" size="sm" className="dashboard-pill-btn h-7 rounded-lg bg-transparent text-xs">
                  View all
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {reviews.length > 0 ? (
              <div className="space-y-2">
                {reviews.map((review: any) => (
                  <div key={review.id} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-medium text-sm truncate leading-tight">
                        {review.tourist?.full_name || "Anonymous"}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < review.rating ? "fill-chart-3 text-chart-3" : "fill-muted-foreground/20 text-muted-foreground/20"}`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {review.title || review.content?.slice(0, 80)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Star}
                title="No reviews yet"
                description="Guest reviews will appear here after your tours."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
