"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import Image from "next/image"
import Link from "next/link"
import { getMessagesUrl } from "@/lib/utils/messaging"
import { buildTourPathFromRecord } from "@/lib/tour-url"
import {
  MapPin,
  Calendar,
  Star,
  Heart,
  MessageCircle,
  Settings,
  Camera,
  Award,
  Globe,
  TrendingUp,
  Bell,
  Trash2,
  Car,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { LoadingSpinner } from "@/components/loading-spinner"

const achievements = [
  { name: "First Tour", description: "Completed your first walking tour", icon: Award, earned: true },
  { name: "Explorer", description: "Visited 5 different cities", icon: Globe, earned: true },
  { name: "Reviewer", description: "Left 5 tour reviews", icon: Star, earned: true },
  { name: "Adventurer", description: "Complete 10 tours", icon: TrendingUp, earned: true },
  { name: "Reliable Traveler", description: "Confirmed attendance for 10 tours", icon: Award, earned: true },
  { name: "Globetrotter", description: "Visit 10 different cities", icon: MapPin, earned: false, progress: 60 },
]

export default function ProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, session, profile, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [bookings, setBookings] = useState<any[]>([])
  const [carBookings, setCarBookings] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [wishlist, setWishlist] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState({
    citiesVisited: 0,
    reviewsWritten: 0,
  })

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab")
    if (tabFromQuery && ["overview", "bookings", "wishlist", "notifications", "achievements"].includes(tabFromQuery)) {
      setActiveTab(tabFromQuery)
    }
  }, [searchParams])

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login")
      return
    }

    if (!isLoading && !profile) {
      console.log("[v0] No profile found, redirecting to login")
      router.push("/login")
      return
    }
  }, [isLoading, session, profile, router])

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!session || !user) return

      try {
        setDataLoading(true)
        const headers = {
          Authorization: `Bearer ${session.access_token}`,
        }

        const [bookingsRes, notificationsRes, wishlistRes, carBookingsRes] = await Promise.all([
          fetch("/api/bookings?role=tourist", { headers }),
          fetch("/api/notifications", { headers }),
          fetch("/api/wishlists", { headers }),
          fetch("/api/bookings?role=buyer", { headers }),
        ])

        if (bookingsRes.ok) {
          const data = await bookingsRes.json()
          const bookingsArray = Array.isArray(data) ? data : []
          // Tour bookings: those with tour_schedules attached
          const tourOnly = bookingsArray.filter((b: any) =>
            b.resource_type === "tour" || (!b.resource_type && b.tour_schedules),
          )
          setBookings(tourOnly)

          // Car bookings: resource_type === 'car'
          const carOnly = bookingsArray.filter((b: any) => b.resource_type === "car")
          setCarBookings(carOnly)

          // Calculate stats from real tour data
          const cities = new Set(tourOnly.map((b: any) => b.tour_schedules?.tours?.city).filter(Boolean))
          const reviews = tourOnly.filter((b: any) => b.reviews && b.reviews.length > 0)
          setStats({
            citiesVisited: cities.size,
            reviewsWritten: reviews.length,
          })
        }

        if (notificationsRes.ok) {
          const data = await notificationsRes.json()
          setNotifications(Array.isArray(data) ? data : [])
        }

        if (wishlistRes.ok) {
          const data = await wishlistRes.json()
          setWishlist(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error("[v0] Error fetching profile data:", err)
      } finally {
        setDataLoading(false)
      }
    }

    if (!isLoading && session && user) {
      fetchProfileData()
    }
  }, [isLoading, session, user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      if (res.ok) {
        window.location.reload()
      }
    } catch (err) {
      console.error("Upload error:", err)
    } finally {
      setUploading(false)
    }
  }

  const removeFromWishlist = async (id: string) => {
    if (!session) return

    const previousWishlist = wishlist
    setWishlist((prev) => prev.filter((item) => item.id !== id))

    try {
      const res = await fetch("/api/wishlists", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wishlistId: id }),
      })

      if (!res.ok) {
        throw new Error("Failed to remove wishlist item")
      }
    } catch (error) {
      console.error("[v0] Error removing wishlist item:", error)
      setWishlist(previousWishlist)
    }
  }

  const markAllAsRead = async () => {
    if (!session) return

    const previousNotifications = notifications
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAll: true }),
      })

      if (!res.ok) {
        throw new Error("Failed to mark notifications as read")
      }
    } catch (error) {
      console.error("[v0] Error marking all notifications as read:", error)
      setNotifications(previousNotifications)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "tour_update":
        return <Calendar className="h-5 w-5 text-primary" />
      case "message":
        return <MessageCircle className="h-5 w-5 text-primary" />
      default:
        return <Bell className="h-5 w-5 text-primary" />
    }
  }

  if (isLoading || dataLoading) {
    return (
      <div className="landing-template min-h-screen flex items-center justify-center bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session || !profile) {
    return null
  }

  const safeUpcomingBookings = Array.isArray(bookings)
    ? bookings.filter((b) => {
        const startTime = b.tour_schedules?.start_time
        return startTime && new Date(startTime) > new Date() && b.status === "confirmed"
      })
    : []
  const safePastBookings = Array.isArray(bookings)
    ? bookings.filter((b) => {
        const startTime = b.tour_schedules?.start_time
        return startTime && new Date(startTime) <= new Date() && b.status === "confirmed"
      })
    : []
  // Car bookings — active/upcoming
  const safeCarBookings = Array.isArray(carBookings)
    ? carBookings.filter((b) => ["confirmed", "upcoming", "pending"].includes(b.status))
    : []
  const safeWishlist = Array.isArray(wishlist) ? wishlist : []
  const safeNotifications = Array.isArray(notifications) ? notifications : []
  const unreadCount = safeNotifications.filter((n) => !n.is_read).length

  const markAsRead = async (id: string) => {
    if (!session) return

    const previousNotifications = notifications
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: id }),
      })

      if (!res.ok) {
        throw new Error("Failed to update notification")
      }
    } catch (error) {
      console.error("[v0] Error updating notification:", error)
      setNotifications(previousNotifications)
    }
  }

  return (
    <div className="landing-template min-h-screen bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
      <Navbar variant="landingTemplate" />

      {/* Profile Header - Using REAL user data from Supabase */}
      <div className="border-b border-[color:var(--landing-border)] bg-[radial-gradient(circle_at_12%_8%,rgba(224,92,58,0.18),transparent_58%),linear-gradient(180deg,var(--landing-bg-soft),var(--landing-bg))] py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
            <div className="relative flex-shrink-0">
              <div className="w-24 md:w-32 h-24 md:h-32 rounded-full overflow-hidden border-4 border-background shadow-lg inline-flex">
                <Image
                  src={profile.avatar_url || "/placeholder.svg"}
                  alt={profile.full_name || "User"}
                  width={128}
                  height={128}
                  priority
                  className="object-cover w-full h-full"
                />
              </div>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="flex-1">
                  <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight break-words">{profile.full_name || "User"}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground mt-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">Member since {new Date(profile.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <Link href="/profile/settings" className="flex-1 md:flex-none">
                    <Button variant="outline" className="dashboard-pill-btn gap-2 bg-transparent w-full md:w-auto">
                      <Settings className="h-4 w-4" />
                      <span className="hidden sm:inline">Edit Profile</span>
                      <span className="sm:hidden">Edit</span>
                    </Button>
                  </Link>
                </div>
              </div>

              <p className="text-muted-foreground max-w-2xl mb-8">{profile.bio || "Welcome to your profile!"}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center md:text-left">
                  <div className="text-2xl md:text-3xl font-bold text-primary">{profile.tourist_total_bookings || 0}</div>
                  <div className="text-xs md:text-sm text-muted-foreground mt-1">Tours Completed</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-2xl md:text-3xl font-bold text-primary">{stats.citiesVisited}</div>
                  <div className="text-xs md:text-sm text-muted-foreground mt-1">Cities Visited</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-2xl md:text-3xl font-bold text-primary">{stats.reviewsWritten}</div>
                  <div className="text-xs md:text-sm text-muted-foreground mt-1">Reviews Written</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-2xl md:text-3xl font-bold text-primary">{profile.tourist_confirmed_attendances || 0}</div>
                  <div className="text-xs md:text-sm text-muted-foreground mt-1">Confirmed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 grid w-full max-w-4xl grid-cols-2 sm:grid-cols-5 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="bookings" className="text-xs sm:text-sm">Bookings</TabsTrigger>
            <TabsTrigger value="wishlist" className="text-xs sm:text-sm">Wishlist</TabsTrigger>
            <TabsTrigger value="notifications" className="relative text-xs sm:text-sm">
              <span className="hidden sm:inline">Notifications</span>
              <span className="sm:hidden">Alerts</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="achievements" className="text-xs sm:text-sm">Badges</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Upcoming Tours */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="dashboard-card">
                  <CardHeader className="pb-4">
                    <CardTitle>Upcoming Tours</CardTitle>
                    <CardDescription>Your scheduled walking tours</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {safeUpcomingBookings.length > 0 ? (
                      <div className="space-y-4">
                        {safeUpcomingBookings.map((booking) => {
                          const tour = booking.tour_schedules?.tours
                          const guide = tour?.guide
                          const images = tour?.images || tour?.photos || []
                          const image = images[0] || "/placeholder.svg"
                          const startTime = new Date(booking.tour_schedules?.start_time)

                          return (
                            <div key={booking.id} className="flex flex-col md:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
                              <div className="w-full md:w-32 h-24 rounded-lg overflow-hidden shrink-0">
                                <Image
                                  src={image}
                                  alt={tour?.title || "Tour"}
                                  width={128}
                                  height={96}
                                  className="object-cover w-full h-full"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold break-words">{tour?.title || "Tour"}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  <span>{tour?.city || "City"}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                                    <Image
                                      src={guide?.avatar_url || "/placeholder.svg"}
                                      alt={guide?.full_name || "Guide"}
                                      width={24}
                                      height={24}
                                      className="object-cover w-full h-full"
                                    />
                                  </div>
                                  <span className="text-sm truncate">with {guide?.full_name || "Guide"}</span>
                                </div>
                                <div className="flex items-center gap-4 mt-3 flex-wrap">
                                  <Badge variant="secondary" className="text-xs sm:text-sm">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {startTime.toLocaleDateString()} at {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex flex-row md:flex-col gap-2 justify-end">
                                <Link href={getMessagesUrl(profile)} className="flex-1 md:flex-none">
                                  <Button variant="outline" size="sm" className="gap-1 bg-transparent w-full">
                                    <MessageCircle className="h-4 w-4" />
                                    <span className="hidden sm:inline">Message</span>
                                  </Button>
                                </Link>
                                <Link href="/bookings" className="flex-1 md:flex-none">
                                  <Button variant="outline" size="sm" className="text-destructive bg-transparent w-full">
                                    <span className="hidden sm:inline">Cancel</span>
                                    <span className="sm:hidden">Cancel</span>
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium mb-2">No upcoming tours</h3>
                        <p className="text-muted-foreground mb-4 text-sm">Start exploring and book your next adventure!</p>
                        <Link href="/tours">
                          <Button>Browse Tours</Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Tours */}
                <Card className="dashboard-card">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle>Recent Tours</CardTitle>
                        <CardDescription>Tours you have completed</CardDescription>
                      </div>
                      <Link href="/bookings">
                        <Button variant="link" className="text-primary p-0 h-auto">
                          View All
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {safePastBookings.length > 0 ? (
                      <div className="space-y-4">
                        {safePastBookings.slice(0, 3).map((booking) => {
                          const tour = booking.tour_schedules?.tours
                          const images = tour?.images || tour?.photos || []
                          const image = images[0] || "/placeholder.svg"
                          const startTime = new Date(booking.tour_schedules?.start_time)
                          const hasReview = booking.reviews && booking.reviews.length > 0
                          const canConfirm = booking.attendance && !booking.attendance[0]?.confirmed_by_tourist

                          return (
                            <div key={booking.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg">
                              <div className="w-full md:w-24 h-20 rounded-lg overflow-hidden shrink-0">
                                <Image
                                  src={image}
                                  alt={tour?.title || "Tour"}
                                  width={96}
                                  height={80}
                                  className="object-cover w-full h-full"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold break-words">{tour?.title || "Tour"}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  <span>{tour?.city || "City"}</span>
                                  <span className="text-muted-foreground/50 hidden sm:inline">|</span>
                                  <span>{startTime.toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center">
                                {canConfirm ? (
                                  <Link href="/bookings">
                                    <Button size="sm">Confirm Attendance</Button>
                                  </Link>
                                ) : hasReview ? (
                                  <Badge variant="secondary">Reviewed</Badge>
                                ) : (
                                  <Link href="/bookings">
                                    <Button size="sm">Leave Review</Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No completed tours yet</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <Card className="dashboard-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Travel Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Tours this year</span>
                        <span className="text-muted-foreground">0 / 15 goal</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Cities visited</span>
                        <span className="text-muted-foreground">0 / 10 goal</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Reviews written</span>
                        <span className="text-muted-foreground">0 / 10 goal</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Attendance confirmed</span>
                        <span className="text-muted-foreground">10 / 12 tours</span>
                      </div>
                      <Progress value={83} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Achievements */}
                <Card className="dashboard-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Recent Badges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {achievements
                        .filter((a) => a.earned)
                        .slice(0, 4)
                        .map((achievement) => (
                          <div key={achievement.name} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <achievement.icon className="w-5 h-5 text-primary" aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{achievement.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{achievement.description}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <div className="space-y-6">
              {/* Car bookings section */}
              {safeCarBookings.length > 0 && (
                <Card className="dashboard-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-primary" />
                      Car Bookings
                    </CardTitle>
                    <CardDescription>Your active car rental bookings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {safeCarBookings.map((booking) => (
                        <div key={booking.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg">
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Car className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="default">Car Rental</Badge>
                              <Badge variant="secondary" className="capitalize">{booking.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Booking ID: <span className="font-mono text-xs">{booking.id.slice(0, 8)}…</span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Guests: {booking.total_guests ?? (booking.adults + (booking.children ?? 0))}
                            </p>
                          </div>
                          <div className="flex items-center">
                            <Badge variant="outline" className="capitalize">{booking.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tour bookings section */}
              <Card className="dashboard-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Tour Bookings</CardTitle>
                      <CardDescription>View and manage all your tour bookings</CardDescription>
                    </div>
                    <Link href="/bookings">
                      <Button>View Full Booking History</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[...safeUpcomingBookings, ...safePastBookings].slice(0, 5).map((booking) => {
                      const tour = booking.tour_schedules?.tours
                      const images = tour?.images || tour?.photos || []
                      const image = images[0] || "/placeholder.svg"
                      const startTime = new Date(booking.tour_schedules?.start_time)
                      const isUpcoming = startTime > new Date()
                      const canConfirm = booking.attendance && !booking.attendance[0]?.confirmed_by_tourist

                      return (
                        <div key={booking.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg">
                          <div className="w-full md:w-32 h-24 rounded-lg overflow-hidden shrink-0">
                            <Image
                              src={image}
                              alt={tour?.title || "Tour"}
                              width={128}
                              height={96}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={isUpcoming ? "default" : "secondary"}>
                                {isUpcoming ? "Upcoming" : "Completed"}
                              </Badge>
                              {canConfirm && (
                                <Badge className="bg-primary/10 text-primary">Needs Confirmation</Badge>
                              )}
                            </div>
                            <h3 className="font-semibold">{tour?.title || "Tour"}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {tour?.city}, {tour?.country}
                              </span>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{startTime.toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <Link href="/bookings">
                              <Button variant="outline" size="sm" className="bg-transparent">
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                    {safeUpcomingBookings.length === 0 && safePastBookings.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">No tour bookings yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Wishlist Tab */}
          <TabsContent value="wishlist">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>My Wishlist</CardTitle>
                <CardDescription>Tours you have saved for later</CardDescription>
              </CardHeader>
              <CardContent>
                {safeWishlist.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {safeWishlist.map((item) => (
                      <Card key={item.id} className="dashboard-card overflow-hidden">
                        <div className="relative h-40">
                          <Image
                            src={item.image || "/placeholder.svg"}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                          <button
                            onClick={() => removeFromWishlist(item.id)}
                            className="absolute top-2 right-2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
                          >
                            <Heart className="h-4 w-4 fill-primary text-primary" />
                          </button>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold line-clamp-2 mb-2">{item.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                            <MapPin className="h-3 w-3" />
                            <span>
                              {item.city}, {item.country}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-chart-3 text-chart-3" />
                              <span className="font-medium">{item.rating}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">({item.reviewCount} reviews)</span>
                          </div>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-full overflow-hidden">
                              <Image
                                src={item.guideAvatar || "/placeholder.svg"}
                                alt={item.guideName}
                                width={24}
                                height={24}
                                className="object-cover w-full h-full"
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{item.guideName}</span>
                          </div>
                          <div className="flex gap-2">
                            <Link
                              href={item.tourId || item.tour_id || item.tour?.id
                                ? buildTourPathFromRecord({
                                    id: String(item.tourId || item.tour_id || item.tour?.id),
                                    title: item.title || item.tour?.title,
                                    city: item.city || item.tour?.city,
                                    city_slug: item.city_slug || item.tour?.city_slug,
                                    tour_slug: item.tour_slug || item.tour?.tour_slug,
                                  })
                                : "/tours"}
                              className="flex-1"
                            >
                              <Button className="w-full" size="sm">
                                Book Now
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-transparent"
                              onClick={() => removeFromWishlist(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">Your wishlist is empty</h3>
                    <p className="text-muted-foreground mb-4">Save tours you are interested in for later!</p>
                    <Link href="/tours">
                      <Button>Browse Tours</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead} className="bg-transparent">
                  Mark all as read
                </Button>
              )}
            </div>

            {safeNotifications.length > 0 ? (
              <div className="space-y-3">
                {safeNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      notification.is_read
                        ? "bg-muted/30 border-border/50"
                        : "bg-primary/5 border-primary/20 hover:border-primary/40"
                    }`}
                    aria-label={`Mark notification ${notification.title || ""} as read`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground">{notification.title || "Notification"}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message || "No message"}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {notification.created_at
                            ? new Date(notification.created_at).toLocaleDateString()
                            : "Recently"}
                        </p>
                      </div>
                      {!notification.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-medium text-muted-foreground">No notifications yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll see updates about tour bookings, messages, and special offers here
                </p>
              </div>
            )}
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Badges & Achievements</CardTitle>
                <CardDescription>Track your travel milestones and unlock new badges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.name}
                      className={`p-6 rounded-xl border-2 ${
                        achievement.earned ? "border-primary/20 bg-primary/5" : "border-muted bg-muted/30 opacity-60"
                      }`}
                    >
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                          achievement.earned ? "bg-primary/10" : "bg-muted"
                        }`}
                      >
                        <achievement.icon />
                      </div>
                      <h3 className="font-semibold mb-1">{achievement.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                      {achievement.earned ? (
                        <Badge className="bg-secondary/10 text-secondary">Earned</Badge>
                      ) : achievement.progress ? (
                        <div>
                          <Progress value={achievement.progress} className="mb-2" />
                          <p className="text-xs text-muted-foreground">{achievement.progress}% complete</p>
                        </div>
                      ) : (
                        <Badge variant="outline">Locked</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer variant="landingTemplate" />
    </div>
  )
}
