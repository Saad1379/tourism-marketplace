"use client"

import { useEffect, useRef } from "react"
import { MapPin } from "lucide-react"

interface PlacesAutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

// Singleton loader: avoid appending the script tag more than once
let mapsScriptState: "idle" | "loading" | "loaded" = "idle"
const pendingCallbacks: (() => void)[] = []

function loadGoogleMapsScript(apiKey: string, onReady: () => void) {
  if (mapsScriptState === "loaded") {
    onReady()
    return
  }

  pendingCallbacks.push(onReady)

  if (mapsScriptState === "loading") return

  mapsScriptState = "loading"
  const script = document.createElement("script")
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  script.async = true
  script.defer = true
  script.onload = () => {
    mapsScriptState = "loaded"
    pendingCallbacks.forEach((cb) => cb())
    pendingCallbacks.length = 0
  }
  document.head.appendChild(script)
}

export function PlacesAutocompleteInput({
  value,
  onChange,
  placeholder = "e.g., In front of Notre-Dame Cathedral",
  id,
}: PlacesAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    const initAutocomplete = () => {
      if (!inputRef.current || autocompleteRef.current) return

      const w = window as any
      if (!w.google?.maps?.places) return

      autocompleteRef.current = new w.google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode", "establishment"],
      })

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace()
        const address = place?.formatted_address || place?.name || ""
        if (address) onChange(address)
      })
    }

    loadGoogleMapsScript(apiKey, initAutocomplete)

    return () => {
      if (autocompleteRef.current) {
        const w = window as any
        w.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [apiKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}
