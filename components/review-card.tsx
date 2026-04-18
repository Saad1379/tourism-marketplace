import Image from "next/image"
import { Star, Quote, MessageCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export interface ReviewCardProps {
  id: string
  authorName: string
  authorAvatar?: string | null
  rating: number
  date: string
  content: string
  tourTitle: string
  city: string
  guideResponse?: string
}

export function ReviewCard({ authorName, authorAvatar, rating, date, content, tourTitle, city, guideResponse }: ReviewCardProps) {
  const safeAvatar = typeof authorAvatar === "string" && !authorAvatar.includes("/placeholder.svg") ? authorAvatar : null
  const initials = authorName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "GT"

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {safeAvatar ? (
              <Image src={safeAvatar} alt={authorName} width={44} height={44} className="rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </div>
            )}
            <div>
              <h4 className="font-semibold text-foreground">{authorName}</h4>
              <p className="text-sm text-muted-foreground">{date}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i < rating ? "fill-chart-3 text-chart-3" : "fill-muted text-muted"}`}
              />
            ))}
          </div>
        </div>
        <div className="relative">
          <Quote className="absolute -left-1 -top-1 h-6 w-6 text-primary/20" />
          <p className="pl-6 text-sm leading-relaxed text-muted-foreground line-clamp-4">{content}</p>
        </div>

        {guideResponse && (
          <div className="mt-4 bg-muted/50 rounded-lg p-3 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Guide's Response</span>
            </div>
            <p className="text-sm text-muted-foreground italic">"{guideResponse}"</p>
          </div>
        )}
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Tour: </span>
            <span className="font-medium text-foreground">{tourTitle}</span>
            {city && <span className="text-muted-foreground"> in {city}</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
