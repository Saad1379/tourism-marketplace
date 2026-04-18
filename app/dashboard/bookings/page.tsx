"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import {
  Calendar,
  Users,
  Search,
  Eye,
  CheckCircle,
  Download,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LoadingSpinner } from "@/components/loading-spinner"

type BookingDTO = {
  id: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  adults: number
  children: number
  guests: number
  tour: {
    id: string
    title: string
    city: string
    country: string
    meeting_point: string
    duration_minutes: number
    image_url: string
  }
  schedule: {
    id: string
    start_time: string | null
    start_time_iso: string | null
  }
  tourist: {
    full_name: string
    avatar_url: string | null
    email: string
  }
  attendance: {
    attended: boolean
    confirmed_by_guide: boolean
    confirmed_by_tourist: boolean
  } | null
  created_at: string | null
  booked_at: string
  guide_id: string
}

export default function BookingsPage() {
  const { session, user, profile, isLoading } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [tourFilter, setTourFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")
  const [bookings, setBookings] = useState<BookingDTO[]>([])
  const [selectedBooking, setSelectedBooking] = useState<BookingDTO | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [attendanceLoading, setAttendanceLoading] = useState<string | null>(null)
  const attendanceInFlightRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isLoading) {
      if (!session) router.push("/login")
      if (profile && profile.role !== "guide") router.push("/")
    }
  }, [isLoading, session, profile, router])

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user || !session) return

      try {
        setDataLoading(true)
        const res = await fetch("/api/bookings")

        if (!res.ok) {
          console.error('Bookings API error:', res.status, res.statusText)
          setBookings([])
          return
        }

        const data = await res.json()
        const normalized: BookingDTO[] = (Array.isArray(data) ? data : []).map((b: any) => {
          const tour = b.tour_schedules?.tours
          const schedule = b.tour_schedules
          const attendance = b.attendance?.[0] ?? null

          // Resolve avatar securely
          let avatarUrl = b.tourist?.avatar_url ?? null
          if (avatarUrl && !avatarUrl.startsWith("http") && !avatarUrl.startsWith("/")) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
            avatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${avatarUrl}`
          }

          return {
            id: b.id,
            status: b.status,
            adults: b.adults ?? 0,
            children: b.children ?? 0,
            guests: b.total_guests ?? (b.adults ?? 0) + (b.children ?? 0),
            tour: {
              id: tour?.id ?? "",
              title: tour?.title ?? "Tour",
              city: tour?.city ?? "Unknown",
              country: tour?.country ?? "",
              meeting_point: tour?.meeting_point ?? "TBD",
              duration_minutes: tour?.duration_minutes ?? 0,
              image_url: tour?.photos?.[0] ?? tour?.images?.[0] ?? "/placeholder.svg",
            },
            schedule: {
              id: schedule?.id ?? "",
              start_time: schedule?.start_time ? new Date(schedule.start_time).toLocaleString() : null,
              start_time_iso: schedule?.start_time ?? null,
            },
            tourist: {
              full_name: b.tourist?.full_name ?? "Guest",
              avatar_url: avatarUrl,
              email: b.tourist?.email ?? "",
            },
            attendance: attendance
              ? {
                  attended: attendance.attended,
                  confirmed_by_guide: attendance.confirmed_by_guide,
                  confirmed_by_tourist: attendance.confirmed_by_tourist,
                }
              : null,
            created_at: b.created_at ?? null,
            booked_at: b.created_at ? new Date(b.created_at).toLocaleDateString() : "—",
            guide_id: tour?.guide_id ?? "",
          }
        })

        setBookings(normalized)
      } catch (error) {
        console.error("[v0] Error fetching bookings:", error)
        setBookings([])
      } finally {
        setDataLoading(false)
      }
    }

    fetchBookings()
  }, [user, session])

  const handleMarkAttendance = async (booking: BookingDTO) => {
    if (!session) return
    if (attendanceInFlightRef.current.has(booking.id)) return

    try {
      attendanceInFlightRef.current.add(booking.id)
      setAttendanceLoading(booking.id)
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id: booking.id,
          adults_attended: booking.adults ?? 0,
          children_attended: booking.children ?? 0,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to mark attendance")
      }

      setBookings((prev) =>
        prev.map((item) =>
          item.id === booking.id
            ? {
                ...item,
                status: "completed" as const,
                attendance: {
                  attended: true,
                  confirmed_by_guide: true,
                  confirmed_by_tourist: false,
                },
              }
            : item,
        ),
      )
    } catch (error) {
      console.error("[v0] Attendance update failed:", error)
    } finally {
      attendanceInFlightRef.current.delete(booking.id)
      setAttendanceLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-secondary text-white">Confirmed</Badge>
      case "pending":
        return <Badge className="bg-primary text-white">Pending</Badge>
      case "completed":
        return <Badge variant="secondary">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner label="Loading bookings..." />
      </div>
    )
  }

  const searchTerm = searchQuery.trim().toLowerCase()
  const uniqueTours = Array.from(
    new Map(
      bookings
        .filter((booking) => booking.tour?.id)
        .map((booking) => [booking.tour.id, { id: booking.tour.id, title: booking.tour.title }]),
    ).values(),
  )

  const matchesFilters = (booking: BookingDTO) => {
    const matchesSearch =
      !searchTerm ||
      booking.tour.title.toLowerCase().includes(searchTerm) ||
      booking.tour.city.toLowerCase().includes(searchTerm) ||
      booking.tourist.full_name.toLowerCase().includes(searchTerm) ||
      booking.tourist.email.toLowerCase().includes(searchTerm)

    const matchesStatus = statusFilter === "all" || booking.status === statusFilter
    const matchesTour = tourFilter === "all" || booking.tour.id === tourFilter
    const matchesDate =
      !dateFilter ||
      (booking.schedule.start_time_iso
        ? (() => {
            const dt = new Date(booking.schedule.start_time_iso)
            if (Number.isNaN(dt.getTime())) return false
            const month = String(dt.getMonth() + 1).padStart(2, "0")
            const day = String(dt.getDate()).padStart(2, "0")
            const localDate = `${dt.getFullYear()}-${month}-${day}`
            return localDate === dateFilter
          })()
        : false)

    return matchesSearch && matchesStatus && matchesTour && matchesDate
  }

  const filteredBookings = bookings.filter(matchesFilters)
  const upcomingBookings = filteredBookings.filter((b) => b.status === "confirmed" || b.status === "pending")
  const pastBookings = filteredBookings.filter((b) => b.status === "completed")
  const cancelledBookings = filteredBookings.filter((b) => b.status === "cancelled")

  const now = new Date()
  const thisMonthCount = bookings.filter((booking) => {
    if (!booking.created_at) return false
    const createdAt = new Date(booking.created_at)
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth()
  }).length

  const completedCount = bookings.filter((b) => b.status === "completed").length
  const nonCancelledCount = bookings.filter((b) => b.status !== "cancelled").length
  const completionRate = nonCancelledCount > 0 ? Math.round((completedCount / nonCancelledCount) * 100) : 0

  const averageGroup =
    bookings.length > 0 ? (bookings.reduce((sum, booking) => sum + booking.guests, 0) / bookings.length).toFixed(1) : "0.0"

  const stats = [
    { label: "Total Bookings", value: bookings.length.toString(), subtext: "All time" },
    {
      label: "This Month",
      value: thisMonthCount.toString(),
      subtext: "Created bookings",
    },
    { label: "Completion Rate", value: `${completionRate}%`, subtext: "Completed vs active" },
    { label: "Average Group", value: averageGroup, subtext: "Guests per booking" },
  ]

  return (
    <main className="p-4 lg:p-6 space-y-6">
          <section className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Bookings</h1>
              <p className="text-sm text-muted-foreground">Manage your tour bookings</p>
            </div>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm font-medium">{stat.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[170px]"
                aria-label="Filter bookings by date"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tourFilter} onValueChange={setTourFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tour" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tours</SelectItem>
                  {uniqueTours.map((tour) => (
                    <SelectItem key={tour.id} value={tour.id}>
                      {tour.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dateFilter ? (
                <Button variant="outline" onClick={() => setDateFilter("")}>
                  Clear Date
                </Button>
              ) : null}
            </div>
          </div>

          {/* Bookings Tabs */}
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {upcomingBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                        >
                          <Image
                            src={booking.tour.image_url}
                            alt={booking.tour.title}
                            width={80}
                            height={60}
                            className="rounded-lg object-cover w-full sm:w-20 h-32 sm:h-14"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{booking.tour.title}</p>
                              {getStatusBadge(booking.status)}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {booking.schedule.start_time || "Date TBD"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {booking.guests} guests
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={booking.tourist.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback>{booking.tourist.full_name[0]}</AvatarFallback>
                              </Avatar>
                              <div className="hidden lg:block">
                                <p className="text-sm font-medium">{booking.tourist.full_name}</p>
                              </div>
                            </div>
                            {booking.status === "confirmed" && !booking.attendance?.confirmed_by_guide && (
                              <Button
                                size="sm"
                                className="gap-2"
                                onClick={() => handleMarkAttendance(booking)}
                                disabled={attendanceLoading === booking.id}
                              >
                                {attendanceLoading === booking.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                                Mark Attendance
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(booking)} aria-label="View booking details">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Booking Details</DialogTitle>
                                  <DialogDescription>Booking ID: {booking.id}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                  <div className="flex items-center gap-3">
                                    <Image
                                      src={booking.tour.image_url}
                                      alt={booking.tour.title}
                                      width={80}
                                      height={60}
                                      className="rounded-lg object-cover"
                                    />
                                    <div>
                                      <p className="font-medium">{booking.tour.title}</p>
                                      {getStatusBadge(booking.status)}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Date & Time</p>
                                      <p className="font-medium">{booking.schedule.start_time || "Date TBD"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Group Size</p>
                                      <p className="font-medium">{booking.guests} guests</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Booked On</p>
                                      <p className="font-medium">{booking.booked_at}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Tip</p>
                                      <p className="font-medium">Off-platform</p>
                                    </div>
                                </div>
                                  <div className="border-t pt-4">
                                    <p className="text-muted-foreground text-sm mb-2">Guest Information</p>
                                    <div className="flex items-center gap-3">
                                      <Avatar>
                                        <AvatarImage src={booking.tourist.avatar_url || "/placeholder.svg"} />
                                        <AvatarFallback>{booking.tourist.full_name[0]}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium">{booking.tourist.full_name}</p>
                                      </div>
                                    </div>
                                    {booking.status === "confirmed" && !booking.attendance?.confirmed_by_guide && (
                                      <div className="mt-4 flex justify-end">
                                        <Button
                                          onClick={() => handleMarkAttendance(booking)}
                                          disabled={attendanceLoading === booking.id}
                                        >
                                          {attendanceLoading === booking.id ? "Marking..." : "Mark as Attended"}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      ))}
                    {upcomingBookings.length === 0 && (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No upcoming bookings match the current filters.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="past" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {pastBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                        >
                          <Image
                            src={booking.tour.image_url}
                            alt={booking.tour.title}
                            width={80}
                            height={60}
                            className="rounded-lg object-cover w-full sm:w-20 h-32 sm:h-14"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{booking.tour.title}</p>
                              {getStatusBadge(booking.status)}
                              {booking.attendance?.attended === true && (
                                <Badge variant="outline" className="ml-2">
                                  <CheckCircle className="w-3 h-3 mr-1 text-secondary" />
                                  Attended
                                </Badge>
                              )}
                              {booking.attendance?.attended === false && (
                                <Badge variant="outline" className="ml-2 text-destructive">
                                  No Show
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {booking.schedule.start_time || "Date TBD"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {booking.guests} guests
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={booking.tourist.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback>{booking.tourist.full_name[0]}</AvatarFallback>
                              </Avatar>
                              <div className="hidden lg:block">
                                <p className="text-sm font-medium">{booking.tourist.full_name}</p>
                                <p className="text-sm text-muted-foreground">Off-platform</p>
                              </div>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(booking)} aria-label="View booking details">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Booking Details</DialogTitle>
                                  <DialogDescription>Booking ID: {booking.id}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                  <div className="flex items-center gap-3">
                                    <Image
                                      src={booking.tour.image_url}
                                      alt={booking.tour.title}
                                      width={80}
                                      height={60}
                                      className="rounded-lg object-cover"
                                    />
                                    <div>
                                      <p className="font-medium">{booking.tour.title}</p>
                                      {getStatusBadge(booking.status)}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Date & Time</p>
                                      <p className="font-medium">{booking.schedule.start_time || "Date TBD"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Group Size</p>
                                      <p className="font-medium">{booking.guests} guests</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Booked On</p>
                                      <p className="font-medium">{booking.booked_at}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Tip Received</p>
                                      <p className="font-medium">Off-platform</p>
                                    </div>
                                  </div>
                                  {booking.attendance && (
                                    <div className="border-t pt-4">
                                      <p className="text-muted-foreground text-sm mb-3">Attendance</p>
                                      <div className="p-3 rounded-lg text-center">
                                        {booking.attendance.attended ? (
                                          <div className="flex items-center justify-center gap-2 text-secondary">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="font-medium">Attended</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-center gap-2 text-destructive">
                                            <span className="font-medium">No Show</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  <div className="border-t pt-4">
                                    <p className="text-muted-foreground text-sm mb-2">Guest Information</p>
                                    <div className="flex items-center gap-3">
                                      <Avatar>
                                        <AvatarImage src={booking.tourist.avatar_url || "/placeholder.svg"} />
                                        <AvatarFallback>{booking.tourist.full_name[0]}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium">{booking.tourist.full_name}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      ))}
                    {pastBookings.length === 0 && (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No past bookings match the current filters.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cancelled" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {cancelledBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-muted/50 transition-colors opacity-60"
                        >
                          <Image
                            src={booking.tour.image_url}
                            alt={booking.tour.title}
                            width={80}
                            height={60}
                            className="rounded-lg object-cover w-full sm:w-20 h-32 sm:h-14 grayscale"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{booking.tour.title}</p>
                              {getStatusBadge(booking.status)}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {booking.schedule.start_time || "Date TBD"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {booking.guests} guests
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={booking.tourist.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback>{booking.tourist.full_name[0]}</AvatarFallback>
                              </Avatar>
                              <div className="hidden lg:block">
                                <p className="text-sm font-medium">{booking.tourist.full_name}</p>
                                <p className="text-xs text-muted-foreground">Cancelled</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    {cancelledBookings.length === 0 && (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No cancelled bookings match the current filters.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

    </main>
  )
}
