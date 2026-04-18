"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, MapPin, Clock } from "lucide-react"

interface BookingCardProps {
  tour: {
    title: string
    city: string
    image?: string
  }
  date: string
  time?: string
  guests: number
  adults?: number
  children?: number
  status: "confirmed" | "pending" | "cancelled" | "completed" | "upcoming"
  guide?: {
    name: string
    avatar?: string
  }
  onClick?: () => void
}

export function BookingCard({ tour, date, time, guests, adults, children, status, guide, onClick }: BookingCardProps) {
  const statusConfig = {
    confirmed: { className: "bg-secondary/10 text-secondary border border-secondary/30", label: "Confirmed" },
    pending: { className: "bg-primary/10 text-primary border border-primary/30", label: "Pending" },
    cancelled: { className: "bg-destructive/10 text-destructive border border-destructive/30", label: "Cancelled" },
    completed: { className: "bg-secondary/10 text-secondary border border-secondary/30", label: "Completed" },
    upcoming: { className: "bg-accent text-accent-foreground border border-border/60", label: "Upcoming" },
  }

  const statusStyle = statusConfig[status] || statusConfig.confirmed

  return (
    <Card
      className="dashboard-card rounded-xl bg-card transition-all duration-200 hover:border-primary/20"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) onClick() }}
    >
      <CardContent className="p-5">
        <div className="flex gap-4">
          {tour.image && (
            <div className="w-20 h-20 rounded-xl bg-muted flex-shrink-0 overflow-hidden">
              <img src={tour.image} alt={tour.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate">{tour.title}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {tour.city}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusStyle.className}`}>
                {statusStyle.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                {date}
              </span>
              {time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {time}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                {guests} guest{guests !== 1 ? "s" : ""}
                {adults !== undefined && children !== undefined && ` (${adults}a, ${children}c)`}
              </span>
            </div>

            {guide && (
              <p className="text-xs text-muted-foreground mt-2">Guide: {guide.name}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
