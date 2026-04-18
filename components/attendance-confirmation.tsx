"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, User, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/supabase/auth-context"

interface AttendanceConfirmationProps {
  bookingId: string
  booking: {
    id: string
    guide_id: string
    tourist_id: string
    guide_checked_in?: boolean
    tourist_confirmed?: boolean
    attendance_status?: string
    status: string
    profiles?: {
      full_name: string
      avatar_url?: string
    }
  }
  onUpdate?: (booking: any) => void
  variant?: "guide" | "tourist"
}

export function AttendanceConfirmation({
  bookingId,
  booking,
  onUpdate,
  variant = "tourist",
}: AttendanceConfirmationProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!user) return null

  const isGuide = user.id === booking.guide_id
  const isTourist = user.id === booking.tourist_id

  if (!isGuide && !isTourist) return null

  const handleAttendanceConfirmation = async (action: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: { session } } = await import("@supabase/supabase-js").then(m =>
        m.createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        ).auth.getSession()
      )

      if (!session?.access_token) {
        setError("Not authenticated")
        return
      }

      const response = await fetch(`/api/bookings/${bookingId}/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to confirm attendance")
        return
      }

      const updatedBooking = await response.json()
      setSuccess(true)
      onUpdate?.(updatedBooking)

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error("[v0] Attendance confirmation error:", err)
      setError("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Tour Attendance</h3>
            {success && (
              <Badge className="bg-secondary/10 text-secondary dark:bg-secondary/15 dark:text-secondary">
                <CheckCircle className="h-3 w-3 mr-1" />
                Confirmed
              </Badge>
            )}
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Guide Status */}
            <div className="p-4 rounded-lg border border-border bg-muted/50">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium">Guide Check-In</span>
                {booking.guide_checked_in ? (
                  <CheckCircle className="h-4 w-4 text-secondary" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {booking.guide_checked_in ? "Guide has confirmed attendance" : "Awaiting guide confirmation"}
              </p>
              {isGuide && !booking.guide_checked_in && (
                <Button
                  size="sm"
                  onClick={() => handleAttendanceConfirmation("guide-confirm")}
                  isLoading={isLoading}
                  disabled={booking.status !== "confirmed"}
                  className="w-full text-xs"
                >
                  Confirm I'm Here
                </Button>
              )}
            </div>

            {/* Tourist Status */}
            <div className="p-4 rounded-lg border border-border bg-muted/50">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium">Tourist Confirmation</span>
                {booking.tourist_confirmed ? (
                  <CheckCircle className="h-4 w-4 text-secondary" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {booking.tourist_confirmed ? "Tourist has confirmed attendance" : "Awaiting tourist confirmation"}
              </p>
              {isTourist && !booking.tourist_confirmed && (
                <Button
                  size="sm"
                  onClick={() => handleAttendanceConfirmation("tourist-confirm")}
                  isLoading={isLoading}
                  disabled={booking.status !== "confirmed"}
                  className="w-full text-xs"
                >
                  Confirm Attendance
                </Button>
              )}
            </div>
          </div>

          {/* Attendance Status */}
          {booking.attendance_status && (
            <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/15 border border-primary/30 dark:border-primary/30">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary dark:text-primary">
                    {booking.attendance_status === "show"
                      ? "Tourist showed up"
                      : booking.attendance_status === "no_show"
                        ? "Tourist was a no-show"
                        : "Partial attendance"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 dark:bg-destructive/15 border border-destructive/30 dark:border-destructive/30">
              <p className="text-xs text-destructive dark:text-destructive">{error}</p>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            Both guide and tourist must confirm attendance before the tour concludes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
