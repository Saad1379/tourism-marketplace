import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { buildCityToursPath } from "@/lib/tour-url"

export interface CityCardProps {
  name: string
  country: string
  image: string
  tourCount: number
}

export function CityCard({ name, country, image, tourCount }: CityCardProps) {
  return (
    <Link
      href={buildCityToursPath(name)}
      className="group relative block aspect-[4/5] overflow-hidden rounded-2xl"
    >
      <Image
        src={image || "/placeholder.svg"}
        alt={name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-primary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Arrow indicator */}
      <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/20 backdrop-blur-sm opacity-0 transition-all duration-300 group-hover:opacity-100">
        <ArrowUpRight className="h-5 w-5 text-white" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p className="text-xs uppercase tracking-wider text-white/70 mb-1">{country}</p>
        <h3 className="text-2xl font-bold text-white">{name}</h3>
        <p className="mt-2 text-sm font-medium text-primary">
          {tourCount} tours available
        </p>
      </div>
    </Link>
  )
}
