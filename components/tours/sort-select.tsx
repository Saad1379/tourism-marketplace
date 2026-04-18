"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { trackFunnelEvent } from "@/lib/analytics/ga"

export type SortValue = "recommended" | "rating_desc" | "reviews_desc" | "duration_asc"

const options: Array<{ value: SortValue; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "rating_desc", label: "Top Rated" },
  { value: "reviews_desc", label: "Most Reviewed" },
  { value: "duration_asc", label: "Shortest Duration" },
]

export function SortSelect({ value }: { value: SortValue }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const paramsString = useMemo(() => searchParams.toString(), [searchParams])

  const handleSortChange = (nextValue: SortValue) => {
    const params = new URLSearchParams(paramsString)
    if (nextValue === "recommended") {
      params.delete("sort")
    } else {
      params.set("sort", nextValue)
    }

    trackFunnelEvent("tours_sort_changed", {
      sort: nextValue,
      city: params.get("city") || undefined,
      language: params.get("language") || undefined,
      duration: params.get("duration") || undefined,
      entry_page: pathname,
    })

    const nextQuery = params.toString()
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">Sort tours</span>
      <select
        aria-label="Sort tours"
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        value={value}
        onChange={(event) => handleSortChange(event.target.value as SortValue)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
