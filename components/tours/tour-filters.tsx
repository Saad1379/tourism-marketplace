"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { trackFunnelEvent } from "@/lib/analytics/ga"

export function TourFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentLanguage = searchParams.get("language") || ""
  const currentDuration = searchParams.get("duration") || ""
  const currentFeaturedOnly = searchParams.get("featured") === "1"

  const languages = [
    { id: "any", label: "Any language" },
    { id: "English", label: "English" },
    { id: "Spanish", label: "Spanish" },
    { id: "French", label: "French" },
    { id: "German", label: "German" },
    { id: "Italian", label: "Italian" },
  ]

  const durations = [
    { id: "any", label: "Any duration" },
    { id: "short", label: "Under 2 hours" },
    { id: "medium", label: "2 - 3 hours" },
    { id: "long", label: "Over 3 hours" },
  ]

  const handleFilterChange = (type: "language" | "duration", value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (!value) {
      params.delete(type)
    } else {
      params.set(type, value)
    }

    trackFunnelEvent("tours_filter_changed", {
      filter_type: type,
      filter_value: value || "any",
      city: params.get("city") || undefined,
      language: params.get("language") || undefined,
      duration: params.get("duration") || undefined,
      featured: params.get("featured") === "1" ? "featured_only" : "all",
    })

    router.push(`/tours?${params.toString()}`)
  }

  const handleFeaturedToggle = (enabled: boolean) => {
    const params = new URLSearchParams(searchParams.toString())

    if (enabled) {
      params.set("featured", "1")
    } else {
      params.delete("featured")
    }

    trackFunnelEvent("tours_filter_changed", {
      filter_type: "featured",
      filter_value: enabled ? "featured_only" : "all",
      city: params.get("city") || undefined,
      language: params.get("language") || undefined,
      duration: params.get("duration") || undefined,
    })

    router.push(`/tours?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-sm font-medium leading-none text-foreground">Listing Type</h3>
        <label
          htmlFor="featured-only-switch"
          className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2.5"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Featured only</p>
            <p className="text-xs text-muted-foreground">Show only boosted tours</p>
          </div>
          <Switch
            id="featured-only-switch"
            checked={currentFeaturedOnly}
            onCheckedChange={handleFeaturedToggle}
            aria-label="Toggle featured tours only"
          />
        </label>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-medium leading-none text-foreground">Language</h3>
        <RadioGroup
          value={currentLanguage || "any"}
          onValueChange={(value) => handleFilterChange("language", value === "any" ? "" : value)}
          className="space-y-3"
        >
          {languages.map((lang) => (
            <label
              key={lang.id}
              htmlFor={`lang-${lang.id}`}
              className="flex cursor-pointer items-center space-x-2 rounded-md p-1 hover:bg-muted/40"
            >
              <RadioGroupItem
                id={`lang-${lang.id}`}
                value={lang.id}
              />
              <span className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {lang.label}
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>
      
      <div className="border-t pt-4">
        <h3 className="mb-4 text-sm font-medium leading-none text-foreground">Duration</h3>
        <RadioGroup
          value={currentDuration || "any"}
          onValueChange={(value) => handleFilterChange("duration", value === "any" ? "" : value)}
          className="space-y-3"
        >
          {durations.map((dur) => (
            <label
              key={dur.id}
              htmlFor={`dur-${dur.id}`}
              className="flex cursor-pointer items-center space-x-2 rounded-md p-1 hover:bg-muted/40"
            >
              <RadioGroupItem
                id={`dur-${dur.id}`}
                value={dur.id}
              />
              <span className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {dur.label}
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  )
}
