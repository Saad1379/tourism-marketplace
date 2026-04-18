"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import Image from "next/image"
import Link from "next/link"
import {
  MapPin,
  Calendar,
  Star,
  MessageCircle,
  Filter,
  Search,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ReviewSubmissionDialog } from "@/components/review-submission-dialog"

export default function BookingsPage() {
  const { session, user, profile, isLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("date")
  const [bookings, setBookings] = useState<any[]>([])
  const [confirmingBooking, setConfirmingBooking] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedCancelBooking, setSelectedCancelBooking] = useState<any>(null)
  const [messagingGuideId, setMessagingGuideId] = useState<string | null>(null)
  const [reviewingBooking, setReviewingBooking] = useState<any>(null)
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login?redirect=/bookings")
    }
  }, [isLoading, session, router])

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user || !session) return

      try {
        setDataLoading(true)
        const headers = { Authorization: `Bearer ${session.access_token}` }
        const res = await fetch("/api/bookings?role=tourist", { headers })

        if (!res.ok) throw new Error("Failed to fetch bookings")

        const data = await res.json()
        
        const normalized = (data || []).map((b: any) => {
          const tour = b.tour_schedules?.tours
          const startTime = b.tour_schedules?.start_time
          const attendance = b.attendance?.[0] || null

          return {
            id: b.id,
            status: b.status,
            created_at: b.created_at,
            adults: b.adults,
            children: b.children,
            participants: b.total_guests,
            tour: {
              id: tour?.id,
              title: tour?.title,
              city: tour?.city,
              country: tour?.country,
              meeting_point: tour?.meeting_point,
              duration_minutes: tour?.duration_minutes,
              images: tour?.images || [],
              photos: tour?.photos || [],
            },
            guide_id: tour?.guide_id,
            guide: tour?.guide?.full_name || "Guide",
            guideAvatar: tour?.guide?.avatar_url || null,
            touristName: b.tourist?.full_name || "Tourist",
            touristAvatar: b.tourist?.avatar_url || null,
            start_time: startTime || null,
            date: startTime ? new Date(startTime).toLocaleDateString() : null,
            time: startTime ? new Date(startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
            duration: tour?.duration_minutes ? `${tour.duration_minutes} min` : null,
            meetingPoint: tour?.meeting_point,
            attendance,
            attended: attendance?.attended || false,
            canConfirmAttendance: b.status === "completed" && !attendance?.confirmed_by_tourist,
            reviewed: (b.reviews && b.reviews.length > 0) || false,
          }
        })

        setBookings(normalized)
      } catch (error) {
        console.error("[v0] Error fetching bookings:", error)
        setBookings([])
        toast({ title: "Error", description: "Failed to load bookings", variant: "destructive" })
      } finally {
        setDataLoading(false)
      }
    }

    fetchBookings()
  }, [user, session, toast])

  const handleConfirmAttendance = async (bookingId: string, attended: boolean) => {
    try {
      const headers = { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }
      const res = await fetch("/api/attendance/confirm", {
        method: "POST",
        headers,
        body: JSON.stringify({
          booking_id: bookingId,
          attended,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to confirm attendance")
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                attended: true,
                canConfirmAttendance: false,
                attendance: {
                  ...b.attendance,
                  attended,
                  confirmed_by_tourist: true,
                },
              }
            : b,
        ),
      )
      toast({ title: "Thanks!", description: "Your attendance was confirmed." })
      setConfirmingBooking(null)
    } catch (error) {
      console.error("[v0] Attendance confirmation failed:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to confirm attendance",
        variant: "destructive",
      })
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!bookingId) return

    setCancellingBookingId(bookingId)
    try {
      const headers = { Authorization: `Bearer ${session?.access_token}` }
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to cancel booking")
      }

      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b)))

      setCancelDialogOpen(false)
      setSelectedCancelBooking(null)

      toast({ title: "Success", description: "Booking cancelled successfully" })
    } catch (error) {
      console.error("[v0] Error cancelling booking:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel booking",
        variant: "destructive",
      })
    } finally {
      setCancellingBookingId(null)
    }
  }

  const handleMessageGuide = async (booking: any) => {
    const guideId = booking.guide_id
    const tourId = booking.tour?.id

    if (!guideId || !user?.id) {
      toast({ title: "Error", description: "Unable to message guide - missing data", variant: "destructive" })
      return
    }

    setMessagingGuideId(guideId)

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guide_id: guideId,
          tourist_id: user.id,
          tour_id: tourId,
        }),
      })

      if (!res.ok) throw new Error("Failed to create conversation")
      const conversation = await res.json()

      router.push(`/messages?conversation_id=${conversation.id}`)
    } catch (error) {
      console.error("[v0] Error creating conversation:", error)
      toast({ title: "Error", description: "Failed to open messages", variant: "destructive" })
    } finally {
      setMessagingGuideId(null)
    }
  }

  const handleSubmitReview = async (booking: any, rating: number, title: string, content: string) => {
    if (!booking || !user) return

    setSubmittingReview(true)
    try {
      const headers = { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({
          tour_id: booking.tour?.id,
          booking_id: booking.id,
          guide_id: booking.guide_id,
          rating,
          title,
          content,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to submit review")
      }

      toast({ title: "Success", description: "Thank you for your review!" })
      setReviewingBooking(null)
      
      // Mark booking as reviewed
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, reviewed: true } : b)))
    } catch (error) {
      console.error("[v0] Error submitting review:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review",
        variant: "destructive",
      })
    } finally {
      setSubmittingReview(false)
    }
  }

  const getStatusBadge = (booking: any) => {
    if (booking.status === "confirmed") {
      return <Badge className="bg-secondary/10 text-secondary hover:bg-secondary/10">Confirmed</Badge>
    }
    if (booking.status === "pending") {
      return <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Pending</Badge>
    }
    if (booking.status === "cancelled") {
      return <Badge variant="destructive">Cancelled</Badge>
    }
    if (booking.status === "completed") {
      return <Badge variant="secondary">Completed</Badge>
    }
    return null
  }

  const normalizeText = (value: unknown) => String(value || "").toLowerCase()

  const matchesSearch = (booking: any) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true

    return [
      booking.tour?.title,
      booking.tour?.city,
      booking.tour?.country,
      booking.guide,
      booking.meetingPoint,
      booking.date,
    ]
      .map(normalizeText)
      .some((value) => value.includes(query))
  }

  const sortBookings = (items: any[]) => {
    return [...items].sort((a, b) => {
      if (sortBy === "city") {
        return normalizeText(a.tour?.city).localeCompare(normalizeText(b.tour?.city))
      }
      if (sortBy === "guide") {
        return normalizeText(a.guide).localeCompare(normalizeText(b.guide))
      }

      const aTime = a.start_time ? new Date(a.start_time).getTime() : new Date(a.created_at || 0).getTime()
      const bTime = b.start_time ? new Date(b.start_time).getTime() : new Date(b.created_at || 0).getTime()
      return bTime - aTime
    })
  }

  const filteredBookings = bookings.filter(matchesSearch)
  const upcomingBookings = sortBookings(filteredBookings.filter((b) => b.status === "confirmed" || b.status === "pending"))
  const pastBookings = sortBookings(filteredBookings.filter((b) => b.status === "completed"))
  const cancelledBookings = sortBookings(filteredBookings.filter((b) => b.status === "cancelled"))

  if (isLoading || dataLoading) {
    return (
      <div className="landing-template flex min-h-screen items-center justify-center bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="landing-template min-h-screen bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
      <Navbar variant="landingTemplate" />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 pt-24 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-5 shadow-[var(--landing-shadow-sm)]">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[color:var(--landing-ink)]">My Bookings</h1>
          <p className="mt-1 text-sm text-[color:var(--landing-muted)]">
            Manage upcoming reservations and keep track of your past tours.
          </p>
        </div>
        {pastBookings.some((b) => b.canConfirmAttendance) && (
          <Card className="dashboard-card mb-6 border-primary/30 bg-primary/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-primary">Confirm Your Tour Attendance</h3>
                  <p className="text-sm text-primary mt-1">
                    You have tours waiting for attendance confirmation. Help your guides by confirming if you attended.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bookings..."
              className="pl-10 border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="dashboard-pill-btn gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Sort by
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy("date")}>Date</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("city")}>City</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("guide")}>Guide</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="mb-8 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-1">
            <TabsTrigger value="upcoming" className="gap-2">
              Upcoming
              <Badge variant="secondary" className="ml-1">
                {upcomingBookings.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              Past
              <Badge variant="secondary" className="ml-1">
                {pastBookings.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-2">
              Cancelled
              <Badge variant="secondary" className="ml-1">
                {cancelledBookings.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingBookings.length > 0 ? (
              <div className="space-y-6">
                {upcomingBookings.map((booking) => (
                  <Card key={booking.id} className="dashboard-card overflow-hidden">
                    <div className="flex flex-col lg:flex-row">
                      <div className="lg:w-72 h-48 lg:h-auto relative shrink-0">
                        <Image
                          src={booking.tour?.photos?.[0] || "/placeholder.svg"}
                          alt={booking.tour?.title || "Tour"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <CardContent className="flex-1 p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">{getStatusBadge(booking)}</div>
                            <h2 className="text-xl font-semibold mb-2">{booking.tour?.title || "Tour"}</h2>
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                              <MapPin className="h-4 w-4" />
                              <span>{booking.tour?.city || "Unknown"}</span>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4 mb-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10">
                                  <AvatarImage 
                                    src={(profile?.role === "guide" ? booking.touristAvatar : booking.guideAvatar) || undefined} 
                                    alt={profile?.role === "guide" ? booking.touristName : booking.guide} 
                                  />
                                  <AvatarFallback>
                                    {(profile?.role === "guide" ? booking.touristName : booking.guide)
                                      ?.split(" ")
                                      .map((n: string) => n[0])
                                      .slice(0, 2)
                                      .join("")
                                      .toUpperCase() || "B"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm text-muted-foreground">
                                    {profile?.role === "guide" ? "Guest" : "Your Guide"}
                                  </p>
                                  <p className="font-medium">
                                    {profile?.role === "guide" ? booking.touristName : booking.guide}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Calendar className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Date & Time</p>
                                  <p className="font-medium">
                                    {booking.date} at {booking.time}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Clock className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Duration</p>
                                  <p className="font-medium">{booking.duration}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Participants</p>
                                  <p className="font-medium">
                                    {booking.participants} {booking.participants === 1 ? "person" : "people"}
                                    {booking.adults && booking.children
                                      ? ` (${booking.adults} adult${booking.adults === 1 ? "" : "s"}, ${booking.children} child${booking.children === 1 ? "" : "ren"})`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm font-medium flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                Meeting Point
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">{booking.meetingPoint}</p>
                            </div>
                          </div>

                          <div className="flex flex-row lg:flex-col gap-2 lg:items-end shrink-0">
                            <Button
                              variant="outline"
                              className="gap-2 bg-transparent"
                              onClick={() => handleMessageGuide(booking)}
                              disabled={!booking.guide_id || messagingGuideId === booking.guide_id}
                            >
                              {messagingGuideId === booking.guide_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MessageCircle className="h-4 w-4" />
                              )}
                              Message Guide
                            </Button>
                            <Dialog
                              open={cancelDialogOpen && selectedCancelBooking?.id === booking.id}
                              onOpenChange={setCancelDialogOpen}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="text-destructive bg-transparent"
                                  onClick={() => {
                                    setSelectedCancelBooking(booking)
                                    setCancelDialogOpen(true)
                                  }}
                                >
                                  Cancel Booking
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Cancel Booking</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to cancel your booking for{" "}
                                    {selectedCancelBooking?.tour?.title || "this tour"}?
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                                    <Image
                                      src={selectedCancelBooking?.tour?.images?.[0] || "/placeholder.svg"}
                                      alt={selectedCancelBooking?.tour?.title || "Tour"}
                                      width={80}
                                      height={60}
                                      className="rounded-lg object-cover"
                                    />
                                    <div>
                                      <p className="font-medium">{selectedCancelBooking?.tour?.title || "Tour"}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {selectedCancelBooking?.date || "—"} at {selectedCancelBooking?.time || "—"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                                    Keep Booking
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() =>
                                      selectedCancelBooking?.id && handleCancelBooking(selectedCancelBooking.id)
                                    }
                                    disabled={cancellingBookingId === selectedCancelBooking?.id}
                                  >
                                    {cancellingBookingId === selectedCancelBooking?.id && (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    )}
                                    Cancel Booking
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="dashboard-card">
                <CardContent className="py-16 text-center">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-medium mb-2">No upcoming bookings</h3>
                  <p className="text-muted-foreground mb-6">You do not have any tours scheduled. Start exploring!</p>
                  <Link href="/tours">
                    <Button size="lg">Find Tours</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past">
            <div className="space-y-4">
              {pastBookings.map((booking) => (
                <Card
                  key={booking.id}
                  className={`dashboard-card ${booking.canConfirmAttendance ? "border-primary/30" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-40 h-28 rounded-lg overflow-hidden shrink-0 relative">
                        <Image
                          src={booking.tour?.photos?.[0] || booking.tour?.images?.[0] || "/placeholder.svg"}
                          alt={booking.tour?.title || "Tour"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{booking.tour?.title || "Tour"}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              <span>{booking.tour?.city || "Unknown"}</span>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{booking.date}</span>
                            </div>
                          </div>
                          {getStatusBadge(booking)}
                        </div>

                        <div className="flex items-center gap-3 mt-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage 
                              src={(profile?.role === "guide" ? booking.touristAvatar : booking.guideAvatar) || undefined} 
                              alt={profile?.role === "guide" ? booking.touristName : booking.guide} 
                            />
                            <AvatarFallback>
                              {(profile?.role === "guide" ? booking.touristName : booking.guide)
                                ?.split(" ")
                                .map((n: string) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase() || "B"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {profile?.role === "guide" ? "Guest: " : "with "}
                            {profile?.role === "guide" ? booking.touristName : booking.guide}
                          </span>
                          {booking.totalPaid && (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span className="text-sm text-muted-foreground">Tip: ${booking.totalPaid}</span>
                            </>
                          )}
                        </div>

                        {booking.rating && (
                          <div className="flex items-center gap-2 mt-3">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < booking.rating! ? "fill-chart-3 text-chart-3" : "text-muted-foreground/30"}`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-muted-foreground">Your rating</span>
                          </div>
                        )}

                        {booking.attended && (
                          <div className="flex items-center gap-2 mt-3 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-secondary" />
                            <span className="text-secondary">You confirmed attendance</span>
                          </div>
                        )}
                      </div>

                      <div className="flex md:flex-col gap-2 justify-end shrink-0">
                        {!booking.reviewed && booking.status === "completed" && (
                          <ReviewSubmissionDialog
                            booking={booking}
                            onSubmit={(rating, title, content) => handleSubmitReview(booking, rating, title, content)}
                            isSubmitting={submittingReview}
                          />
                        )}
                        {booking.canConfirmAttendance && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button className="gap-2" onClick={() => setConfirmingBooking(booking)}>
                                <CheckCircle2 className="h-4 w-4" />
                                Confirm Attendance
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Confirm Your Attendance</DialogTitle>
                                <DialogDescription>
                                  Did you attend the {booking.tour?.title || "Tour"} on {booking.date}?
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                                  <Image
                                    src={booking.tour?.images?.[0] || "/placeholder.svg"}
                                    alt={booking.tour?.title || "Tour"}
                                    width={80}
                                    height={60}
                                    className="rounded-lg object-cover"
                                  />
                                  <div>
                                    <p className="font-medium">{booking.tour?.title || "Tour"}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {booking.date} at {booking.time}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Guide: {booking.guide}</p>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter className="flex-col sm:flex-row gap-2">
                                <Button
                                  variant="outline"
                                  className="gap-2 flex-1 bg-transparent"
                                  onClick={() => handleConfirmAttendance(booking.id, false)}
                                >
                                  <XCircle className="h-4 w-4" />I Did Not Attend
                                </Button>
                                <Button
                                  className="gap-2 flex-1"
                                  onClick={() => handleConfirmAttendance(booking.id, true)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Yes, I Attended
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pastBookings.length === 0 && (
                <Card className="dashboard-card">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No past bookings yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cancelled">
            {cancelledBookings.length > 0 ? (
              <div className="space-y-4">
                {cancelledBookings.map((booking) => (
                  <Card key={booking.id} className="dashboard-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{booking.tour?.title || "Tour"}</h3>
                          <p className="text-sm text-muted-foreground mt-1">Cancelled on {booking.date}</p>
                        </div>
                        <Badge variant="destructive">Cancelled</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="dashboard-card">
                <CardContent className="py-16 text-center">
                  <XCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-medium mb-2">No cancelled bookings</h3>
                  <p className="text-muted-foreground">You have not cancelled any bookings.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Footer variant="landingTemplate" />
    </div>
  )
}
