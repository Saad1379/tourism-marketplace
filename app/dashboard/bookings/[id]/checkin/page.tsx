"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  Search,
  CheckCircle,
  XCircle,
  BarChart3,
  UserCheck,
  UserX,
  Mail,
  Phone,
  ArrowLeft,
  Download,
  CheckCheck,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/lib/supabase/auth-context"

// Mock tour data for the check-in page
const tourData = {
  id: "1",
  name: "Historical Paris Walking Tour",
  image: "/paris-eiffel-tower.png",
  date: "Dec 15, 2025",
  time: "10:00 AM",
  location: "Eiffel Tower Main Entrance",
  totalGuests: 8,
}

// Mock guests for the tour
const initialGuests = [
  {
    id: "g1",
    name: "Sarah Mitchell",
    email: "sarah.m@email.com",
    phone: "+1 555-1234",
    avatar: "/smiling-woman-portrait.png",
    partySize: 2,
    status: "pending" as "pending" | "show" | "no-show",
    notes: "",
    bookedAt: "Dec 10, 2025",
  },
  {
    id: "g2",
    name: "James Chen",
    email: "james.chen@email.com",
    phone: "+1 555-5678",
    avatar: "/casual-man-portrait.png",
    partySize: 1,
    status: "pending" as "pending" | "show" | "no-show",
    notes: "First time visiting Paris",
    bookedAt: "Dec 8, 2025",
  },
  {
    id: "g3",
    name: "Emma Rodriguez",
    email: "emma.r@email.com",
    phone: "+1 555-9012",
    avatar: "/woman-tourist-portrait.jpg",
    partySize: 3,
    status: "pending" as "pending" | "show" | "no-show",
    notes: "Traveling with children (ages 8, 12)",
    bookedAt: "Dec 5, 2025",
  },
  {
    id: "g4",
    name: "Michael Brown",
    email: "michael.b@email.com",
    phone: "+1 555-3456",
    avatar: "/man-with-glasses-portrait.png",
    partySize: 2,
    status: "pending" as "pending" | "show" | "no-show",
    notes: "",
    bookedAt: "Dec 12, 2025",
  },
]

export default function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { user, profile, isLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [guests, setGuests] = useState(initialGuests)
  const [selectedGuest, setSelectedGuest] = useState<(typeof initialGuests)[0] | null>(null)
  const [noShowReason, setNoShowReason] = useState("")
  const [showNoShowDialog, setShowNoShowDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)

  const filteredGuests = guests.filter(
    (guest) =>
      guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const totalExpectedGuests = guests.reduce((sum, g) => sum + g.partySize, 0)
  const checkedInGuests = guests.filter((g) => g.status === "show").reduce((sum, g) => sum + g.partySize, 0)
  const noShowGuests = guests.filter((g) => g.status === "no-show").reduce((sum, g) => sum + g.partySize, 0)
  const pendingGuests = guests.filter((g) => g.status === "pending").reduce((sum, g) => sum + g.partySize, 0)

  const attendanceRate = totalExpectedGuests > 0 ? Math.round((checkedInGuests / totalExpectedGuests) * 100) : 0

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (profile && profile.role !== "guide") {
      router.push("/")
    }
  }, [isLoading, user, profile, router])

  if (isLoading || !user || profile?.role !== "guide") {
    return null
  }

  const handleCheckIn = (guestId: string) => {
    setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, status: "show" as const } : g)))
  }

  const handleNoShow = (guestId: string) => {
    setSelectedGuest(guests.find((g) => g.id === guestId) || null)
    setShowNoShowDialog(true)
  }

  const confirmNoShow = () => {
    if (selectedGuest) {
      setGuests((prev) =>
        prev.map((g) => (g.id === selectedGuest.id ? { ...g, status: "no-show" as const, notes: noShowReason } : g)),
      )
    }
    setShowNoShowDialog(false)
    setNoShowReason("")
    setSelectedGuest(null)
  }

  const handleResetStatus = (guestId: string) => {
    setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, status: "pending" as const } : g)))
  }

  const handleCheckInAll = () => {
    setGuests((prev) => prev.map((g) => (g.status === "pending" ? { ...g, status: "show" as const } : g)))
  }

  const handleCompleteTour = () => {
    setShowCompleteDialog(true)
  }

  const getStatusBadge = (status: "pending" | "show" | "no-show") => {
    switch (status) {
      case "show":
        return (
          <Badge className="bg-secondary text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Checked In
          </Badge>
        )
      case "no-show":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            No Show
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="p-4 lg:p-6 space-y-6">
          <section className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/bookings">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Bookings
              </Link>
            </Button>
          </section>

          {/* Tour Info Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Image
                  src={tourData.image || "/placeholder.svg"}
                  alt={tourData.name}
                  width={200}
                  height={150}
                  className="rounded-xl object-cover w-full md:w-48 h-36"
                />
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-2">{tourData.name}</h1>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{tourData.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{tourData.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{tourData.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{totalExpectedGuests} expected guests</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary">{checkedInGuests}</p>
                    <p className="text-sm text-muted-foreground">Checked In</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                    <UserX className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{noShowGuests}</p>
                    <p className="text-sm text-muted-foreground">No Shows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{pendingGuests}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{attendanceRate}%</p>
                    <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Progress */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Check-in Progress</span>
                <span className="text-sm text-muted-foreground">
                  {checkedInGuests + noShowGuests} of {totalExpectedGuests} processed
                </span>
              </div>
              <Progress value={((checkedInGuests + noShowGuests) / totalExpectedGuests) * 100} className="h-2" />
            </CardContent>
          </Card>

          {/* Guest List */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Guest List</CardTitle>
                  <CardDescription>Check in guests as they arrive at the meeting point</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCheckInAll} disabled={pendingGuests === 0}>
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Check In All
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export List
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search guests by name or email..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Guest Cards */}
              <div className="space-y-3">
                {filteredGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      guest.status === "show"
                        ? "bg-secondary/10 border-secondary/30"
                        : guest.status === "no-show"
                          ? "bg-destructive/10 border-destructive/30"
                          : "bg-background"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={guest.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{guest.name[0]}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{guest.name}</h3>
                          {getStatusBadge(guest.status)}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {guest.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {guest.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            Party of {guest.partySize}
                          </span>
                        </div>
                        {guest.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">Note: {guest.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {guest.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-secondary hover:bg-secondary/90"
                              onClick={() => handleCheckIn(guest.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Check In
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleNoShow(guest.id)}>
                              <XCircle className="w-4 h-4 mr-1" />
                              No Show
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleResetStatus(guest.id)}>
                            Reset Status
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Complete Tour Button */}
          <div className="flex justify-end">
            <Button size="lg" className="bg-primary" onClick={handleCompleteTour} disabled={pendingGuests > 0}>
              <CheckCheck className="w-5 h-5 mr-2" />
              Complete Tour & Submit Attendance
            </Button>
          </div>

          {/* Summary Note */}
          {pendingGuests > 0 && (
            <Card className="border-primary/30 bg-primary/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-primary">Pending Check-ins</p>
                    <p className="text-sm text-primary">
                      You still have {pendingGuests} guests pending check-in. Please mark all guests as either "Checked
                      In" or "No Show" before completing the tour.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
      </main>

      {/* No Show Dialog */}
      <Dialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as No Show</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark {selectedGuest?.name} (party of {selectedGuest?.partySize}) as a no show?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Add any notes about why the guest didn't show up..."
                value={noShowReason}
                onChange={(e) => setNoShowReason(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoShowDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmNoShow}>
              Confirm No Show
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Tour Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Tour</DialogTitle>
            <DialogDescription>Review the attendance summary before submitting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/10 rounded-lg text-center">
                <p className="text-3xl font-bold text-secondary">{checkedInGuests}</p>
                <p className="text-sm text-secondary">Attended</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <p className="text-3xl font-bold text-destructive">{noShowGuests}</p>
                <p className="text-sm text-destructive">No Shows</p>
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">Attendance Rate</span>
                <span className="text-xl font-bold">{attendanceRate}%</span>
              </div>
              <Progress value={attendanceRate} className="h-2 mt-2" />
            </div>
            <p className="text-sm text-muted-foreground">
              Guests who attended will receive a notification to confirm their attendance and leave a review. No-show
              guests will be notified and this will be recorded in their profile.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button asChild>
              <Link href="/dashboard/bookings">Submit Attendance</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
