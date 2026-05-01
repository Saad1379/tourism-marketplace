import Image from "next/image"
import Link from "next/link"
import { Star, Clock, Users, MapPin, Award, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { buildTourPath } from "@/lib/tour-url"

const PRO_BADGE_EXPLANATION =
  "PRO means this guide is on Touricho's paid Pro plan with extra tools and visibility, not a quality guarantee by itself."
const DEFAULT_CANCELLATION_POLICY_SHORT = "Cancel at least 24h before start so others can join."

export interface TourCardProps {
  id: string
  title: string
  city: string
  citySlug?: string | null
  tourSlug?: string | null
  image: string
  rating: number
  reviewCount: number
  duration: string
  maxGroupSize: number
  guideName: string
  guideAvatar?: string | null
  isGuidePro?: boolean
  languages: string[]
  isPremium?: boolean
  nextAvailableStartTime?: string | null
  nextAvailableSpots?: number | null
  guideBio?: string | null
  meetingPoint?: string | null
  cancellationPolicyShort?: string | null
  isNewTour?: boolean
}

function getInitials(name: string): string {
  const trimmed = String(name || "").trim()
  if (!trimmed) return "LG"
  const parts = trimmed.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "LG"
}

function formatMeetingPointLabel(meetingPoint: string | null | undefined): string {
  const text = String(meetingPoint || "").trim()
  if (!text) return "Meeting point shared after booking"
  return text.split(",")[0]?.trim() || text
}

export function TourCard({
  id,
  title,
  city,
  citySlug = null,
  tourSlug = null,
  image,
  rating,
  reviewCount,
  duration,
  maxGroupSize,
  guideName,
  guideAvatar,
  isGuidePro = false,
  languages,
  isPremium = false,
  nextAvailableStartTime = null,
  nextAvailableSpots = null,
  guideBio = null,
  meetingPoint = null,
  cancellationPolicyShort = null,
  isNewTour = false,
}: TourCardProps) {
  const safeLanguages = Array.isArray(languages) ? languages : []
  const nextSlotMs = nextAvailableStartTime ? new Date(nextAvailableStartTime).getTime() : Number.NaN
  const hasUpcomingSlot =
    Number.isFinite(nextSlotMs) && nextSlotMs > Date.now() && typeof nextAvailableSpots === "number" && nextAvailableSpots > 0
  const hasReviews = reviewCount > 0
  const showNewState = isNewTour || !hasReviews
  const quickMeetingPoint = formatMeetingPointLabel(meetingPoint)
  const quickCancellation = cancellationPolicyShort || DEFAULT_CANCELLATION_POLICY_SHORT
  const href = tourSlug
    ? buildTourPath(id, title, citySlug || city, tourSlug)
    : buildTourPath(id, title)

  return (
    <Link href={href}>
      <Card className="group overflow-hidden border-primary/15 bg-gradient-to-b from-card via-card to-primary/[0.03] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_36px_-22px_rgba(240,90,90,0.36)] dark:hover:shadow-[0_20px_40px_-24px_rgba(240,90,90,0.28)]">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={image || "/placeholder.svg"}
            alt={title || "Tour image"}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {isPremium && (
            <Badge className="absolute left-3 top-3 gap-1 border-0 bg-secondary text-secondary-foreground">
              <Award className="h-3 w-3" />
              Ad · Boosted
            </Badge>
          )}

          {/* City badge at bottom */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-primary/85 px-2.5 py-1 text-primary-foreground shadow-sm backdrop-blur-sm">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-semibold">{city}</span>
            </div>
            <div className="flex gap-1.5">
              {safeLanguages.slice(0, 2).map((lang) => (
                <Badge key={lang} variant="secondary" className="border-0 bg-background/95 text-foreground/85 text-xs shadow-sm">
                  {lang}
                </Badge>
              ))}
              {safeLanguages.length > 2 && (
                <Badge variant="secondary" className="border-0 bg-background/95 text-foreground/85 text-xs shadow-sm">
                  +{safeLanguages.length - 2}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <CardContent className="p-5">
          <h3 className="mb-3 line-clamp-2 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {title}
          </h3>
          <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-secondary" />
              {duration}
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-secondary" />
              Max {maxGroupSize}
            </div>
          </div>
          <div className="mb-4 space-y-2 rounded-lg border border-primary/15 bg-primary/[0.04] p-3 text-xs text-muted-foreground dark:bg-primary/[0.12]">
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
              <span className="line-clamp-1">{quickMeetingPoint}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
              <span className="line-clamp-1">{quickCancellation}</span>
            </div>
          </div>
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary dark:bg-primary/[0.18]">
            {hasUpcomingSlot
              ? `Next slot ${new Date(nextAvailableStartTime as string).toLocaleDateString()} • ${nextAvailableSpots} left`
              : "Check availability"}
          </div>
          {isPremium && (
            <p className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Source: Sponsored Listing
            </p>
          )}
          <div className="flex items-center justify-between border-t border-primary/15 pt-4">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 ring-2 ring-primary/15">
                <AvatarImage src={guideAvatar || undefined} alt={guideName || "Guide avatar"} />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(guideName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{guideName}</span>
                  {isGuidePro && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary"
                        >
                          Pro
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64 leading-relaxed" sideOffset={6}>
                        {PRO_BADGE_EXPLANATION}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {guideBio && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {guideBio}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 py-1 dark:bg-primary/[0.16]">
              {showNewState ? (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">New</span>
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 fill-chart-3 text-chart-3" />
                  <span className="text-sm font-semibold text-foreground">{rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({reviewCount})</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
