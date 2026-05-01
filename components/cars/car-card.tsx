"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Car, Users, Fuel, Settings, MapPin, Star, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getStorageUrl } from "@/lib/utils"

interface CarSchedule {
  id: string
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
}

interface CarSeller {
  id: string
  full_name: string
  avatar_url: string | null
}

export interface CarListing {
  id: string
  title: string
  description: string | null
  city: string | null
  city_slug: string
  country: string | null
  price_per_day: number | null
  make: string | null
  model: string | null
  year: number | null
  seats: number
  transmission: string | null
  fuel_type: string | null
  images: string[]
  features: string[]
  status: string
  created_at: string
  seller: CarSeller | null
  car_schedules: CarSchedule[]
}

interface CarCardProps {
  car: CarListing
}

export function CarCard({ car }: CarCardProps) {
  const firstImage = car.images?.[0]
  const imageSrc = firstImage ? getStorageUrl(firstImage) : null

  const nextAvailable = useMemo(() => {
    const now = Date.now()
    return car.car_schedules
      .filter(
        (s) =>
          new Date(s.start_time).getTime() > now &&
          (s.capacity - s.booked_count) > 0,
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
  }, [car.car_schedules])

  return (
    <Link href={`/cars/${car.id}`} className="block group">
      <Card className="overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 h-full">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={car.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Car className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          {/* Transmission badge */}
          {car.transmission && (
            <Badge className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm text-foreground border-border/50 text-xs">
              {car.transmission}
            </Badge>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Title & Location */}
          <div>
            <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {car.title}
            </h3>
            {car.city && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {car.city}
                {car.country ? `, ${car.country}` : ""}
              </p>
            )}
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {car.seats} seats
            </span>
            {car.fuel_type && (
              <span className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {car.fuel_type}
              </span>
            )}
            {car.make && car.model && (
              <span className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                {car.make} {car.model}
                {car.year ? ` (${car.year})` : ""}
              </span>
            )}
          </div>

          {/* Availability & Price */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-sm">
              {nextAvailable ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Available from{" "}
                  {new Date(nextAvailable.start_time).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">Check availability</span>
              )}
            </div>
            {car.price_per_day !== null && (
              <div className="text-right">
                <span className="font-bold text-foreground">
                  €{Number(car.price_per_day).toFixed(0)}
                </span>
                <span className="text-xs text-muted-foreground">/day</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
