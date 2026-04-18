"use client"

import type React from "react"
import { useEffect, useId, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trackFunnelEvent } from "@/lib/analytics/ga"
import { buildCityToursPath } from "@/lib/tour-url"

interface SearchBarProps {
  variant?: "hero" | "compact"
  theme?: "default" | "landingTemplate"
}

type CityOption = {
  slug: string
  name: string
  country: string
}

type SearchSuggestion = {
  city: string
  country: string
  label: string
}

function getSuggestionScore(query: string, city: string, country: string) {
  const q = query.toLowerCase()
  const cityLower = city.toLowerCase()
  const countryLower = country.toLowerCase()

  if (cityLower.startsWith(q)) return 3
  if (cityLower.includes(q)) return 2
  if (countryLower.startsWith(q) || countryLower.includes(q)) return 1
  return 0
}

export function SearchBar({ variant = "hero", theme = "default" }: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchId = useId()
  const [destination, setDestination] = useState("")
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [cityCatalog, setCityCatalog] = useState<CityOption[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const query = destination.trim()

  useEffect(() => {
    const controller = new AbortController()

    const loadCities = async () => {
      try {
        const response = await fetch("/api/cities", { signal: controller.signal })
        const data = await response.json()
        const cities = Array.isArray(data?.cities) ? data.cities : []
        setCityCatalog(cities)
      } catch {
        setCityCatalog([])
      }
    }

    loadCities()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([])
      setActiveIndex(-1)
      setShowSuggestions(false)
      return
    }

    const localSuggestions = cityCatalog
      .map((city) => ({
        city: city.name,
        country: city.country || "",
        label: city.country ? `${city.name}, ${city.country}` : city.name,
        score: getSuggestionScore(query, city.name, city.country || ""),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.city.localeCompare(b.city))
      .slice(0, 8)
      .map(({ city, country, label }) => ({ city, country, label }))

    if (localSuggestions.length > 0) {
      setSuggestions(localSuggestions)
      setShowSuggestions(true)
      setActiveIndex(-1)
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        const data = await response.json()
        const remoteSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : []

        const deduped = new Map<string, SearchSuggestion>()
        for (const suggestion of [...localSuggestions, ...remoteSuggestions]) {
          const city = String(suggestion.city || "").trim()
          if (!city) continue
          const country = String(suggestion.country || "").trim()
          const key = `${city.toLowerCase()}|${country.toLowerCase()}`
          if (!deduped.has(key)) {
            deduped.set(key, {
              city,
              country,
              label: String(suggestion.label || (country ? `${city}, ${country}` : city)),
            })
          }
        }

        const mergedSuggestions = Array.from(deduped.values()).slice(0, 8)
        setSuggestions(mergedSuggestions)
        setShowSuggestions(mergedSuggestions.length > 0)
        setActiveIndex(-1)
      } catch {
        if (localSuggestions.length === 0) {
          setSuggestions([])
          setShowSuggestions(false)
          setActiveIndex(-1)
        }
      }
    }, 180)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, cityCatalog])

  const selectedSuggestion = useMemo(
    () => (activeIndex >= 0 ? suggestions[activeIndex] : null),
    [activeIndex, suggestions],
  )
  const listboxId = `${searchId}-listbox`
  const activeOptionId = activeIndex >= 0 ? `${searchId}-option-${activeIndex}` : undefined

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    const city = selectedSuggestion?.city || destination.trim()
    if (city) {
      trackFunnelEvent("home_search_submitted", {
        city,
        search_query: destination.trim(),
        entry_page: pathname,
      })
      router.push(buildCityToursPath(city))
    } else {
      trackFunnelEvent("home_search_submitted", {
        city: "",
        search_query: "",
        entry_page: pathname,
      })
      router.push("/tours")
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (event.key === "Escape") {
      setShowSuggestions(false)
      setActiveIndex(-1)
    }
  }

  const chooseSuggestion = (value: string) => {
    setDestination(value)
    setShowSuggestions(false)
    setActiveIndex(-1)
  }

  if (variant === "compact") {
    const compactInputClass =
      theme === "landingTemplate"
        ? "pl-10 rounded-full border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] text-[color:var(--landing-ink)]"
        : "pl-10 rounded-full border-border bg-background"
    const compactDropdownClass =
      theme === "landingTemplate"
        ? "absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-lg"
        : "absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-border bg-background shadow-lg"
    const compactButtonClass = theme === "landingTemplate" ? "rounded-full landing-btn-coral" : "rounded-full"

    return (
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Where do you want to explore?"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            onKeyDown={handleKeyDown}
            className={compactInputClass}
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-haspopup="listbox"
            role="combobox"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              id={listboxId}
              role="listbox"
              className={compactDropdownClass}
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.city}-${suggestion.country}`}
                  id={`${searchId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  type="button"
                  onMouseDown={() => chooseSuggestion(suggestion.city)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    index === activeIndex ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" className={compactButtonClass}>
          Search
        </Button>
      </form>
    )
  }

  const heroFormClass =
    theme === "landingTemplate"
      ? "landing-hero-search flex flex-col gap-3 rounded-[28px] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-3 shadow-[var(--landing-shadow-md)] md:flex-row md:items-center md:gap-0 md:rounded-[999px] md:p-2"
      : "flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg md:flex-row md:items-center md:gap-0 md:rounded-full md:p-2"
  const heroInputClass =
    theme === "landingTemplate"
      ? "border-0 bg-transparent pl-12 text-base text-[color:var(--landing-ink)] shadow-none placeholder:text-[color:var(--landing-muted-2)] focus-visible:ring-0 h-12"
      : "border-0 bg-transparent pl-12 text-base shadow-none placeholder:text-muted-foreground focus-visible:ring-0 h-12"
  const heroIconClass =
    theme === "landingTemplate"
      ? "absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--landing-muted)]"
      : "absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
  const heroDropdownClass =
    theme === "landingTemplate"
      ? "absolute inset-x-2 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-md)]"
      : "absolute inset-x-2 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-border bg-background shadow-xl"
  const heroButtonClass = theme === "landingTemplate" ? "w-full rounded-full landing-btn-coral md:w-auto md:px-8" : "w-full rounded-full md:w-auto md:px-8"

  return (
    <form
      onSubmit={handleSearch}
      className={heroFormClass}
    >
      <div className="relative flex-1">
        <MapPin className={heroIconClass} />
        <Input
          type="text"
          placeholder="Where do you want to explore first?"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          onKeyDown={handleKeyDown}
          className={heroInputClass}
          aria-autocomplete="list"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-haspopup="listbox"
          role="combobox"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div
            id={listboxId}
            role="listbox"
            className={heroDropdownClass}
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.city}-${suggestion.country}`}
                id={`${searchId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
                onMouseDown={() => chooseSuggestion(suggestion.city)}
                className={`block w-full px-4 py-2.5 text-left text-sm ${
                  index === activeIndex ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="md:pl-2">
        <Button
          type="submit"
          size="lg"
          className={heroButtonClass}
        >
          <Search className="h-4 w-4 mr-2" />
          Find a Tour
        </Button>
      </div>
    </form>
  )
}
