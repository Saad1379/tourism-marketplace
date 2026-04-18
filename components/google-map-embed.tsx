"use client"

interface GoogleMapEmbedProps {
  address: string
  height?: number | string
  className?: string
}

export function GoogleMapEmbed({ address, height = 280, className = "" }: GoogleMapEmbedProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  if (!address?.trim() || !apiKey) return null

  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}&zoom=16`

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border ${className}`}
      style={{ height }}
    >
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={src}
        title="Meeting point location"
      />
    </div>
  )
}
