"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Car, Search, Eye, EyeOff, Trash2, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getStorageUrl } from "@/lib/utils"

interface AdminCar {
  id: string
  title: string
  status: string
  price_per_day: number | null
  make: string | null
  model: string | null
  year: number | null
  seats: number
  city: string | null
  images: string[]
  created_at: string
  seller: { id: string; full_name: string; email: string } | null
  car_schedules: { id: string }[]
}

export default function AdminCarsPage() {
  const [cars, setCars] = useState<AdminCar[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadCars() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/admin/cars?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setCars(Array.isArray(data) ? data : data.cars ?? [])
    } catch {
      toast.error("Failed to load car listings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCars()
  }, [statusFilter])

  async function toggleStatus(car: AdminCar) {
    const newStatus = car.status === "published" ? "draft" : "published"
    setActionLoading(car.id)
    try {
      const res = await fetch(`/api/cars/${car.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast.success(`Car ${newStatus === "published" ? "published" : "unpublished"}`)
      await loadCars()
    } catch {
      toast.error("Failed to update status")
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteCar(carId: string) {
    setActionLoading(carId)
    try {
      const res = await fetch(`/api/cars/${carId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Car deleted")
      setCars((prev) => prev.filter((c) => c.id !== carId))
    } catch {
      toast.error("Failed to delete car")
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = cars.filter((car) => {
    const term = search.toLowerCase()
    return (
      !term ||
      car.title.toLowerCase().includes(term) ||
      car.city?.toLowerCase().includes(term) ||
      car.make?.toLowerCase().includes(term) ||
      car.model?.toLowerCase().includes(term) ||
      car.seller?.full_name?.toLowerCase().includes(term) ||
      car.seller?.email?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            Car Listings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage all car listings across the marketplace
          </p>
        </div>
        <div className="text-sm text-muted-foreground font-medium">
          {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, city, seller..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "published", "draft"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Cars List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Car className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No car listings found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((car) => {
            const firstImage = car.images?.[0]
            const isLoading = actionLoading === car.id

            return (
              <Card key={car.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative h-20 w-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {firstImage ? (
                        <Image
                          src={getStorageUrl(firstImage)}
                          alt={car.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Car className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground line-clamp-1">{car.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {[car.make, car.model, car.year].filter(Boolean).join(" ")}
                            {car.city ? ` · ${car.city}` : ""}
                            {" · "}
                            {car.seats} seats
                          </p>
                          {car.seller && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Seller:{" "}
                              <span className="font-medium">{car.seller.full_name}</span>
                              {" "}({car.seller.email})
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={car.status === "published" ? "default" : "secondary"}>
                            {car.status}
                          </Badge>
                          {car.price_per_day !== null && (
                            <span className="text-sm font-medium">
                              €{Number(car.price_per_day).toFixed(0)}/day
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 mt-3">
                        <span className="text-xs text-muted-foreground mr-2">
                          {car.car_schedules?.length ?? 0} slot{car.car_schedules?.length !== 1 ? "s" : ""}
                        </span>

                        <Link href={`/cars/${car.id}`} target="_blank">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View listing">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isLoading}
                          onClick={() => toggleStatus(car)}
                          title={car.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {car.status === "published" ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete car listing?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &quot;{car.title}&quot; and all its schedules.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteCar(car.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
