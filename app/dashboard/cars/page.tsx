"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Plus, Car, Edit, Trash2, Eye, EyeOff, CalendarDays, CalendarRange } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SellerCar {
  id: string
  title: string
  status: string
  price_per_day: number | null
  make: string | null
  model: string | null
  year: number | null
  seats: number
  images: string[]
  created_at: string
  car_schedules: { id: string }[]
}

export default function SellerCarsPage() {
  const [cars, setCars] = useState<SellerCar[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadCars() {
    try {
      // Fetch seller's own cars (including drafts) via profile-scoped API
      const res = await fetch("/api/cars?include_own=true", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load cars")
      const data = await res.json()
      setCars(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load your car listings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCars()
  }, [])

  async function togglePublish(car: SellerCar) {
    const newStatus = car.status === "published" ? "draft" : "published"
    setActionLoading(car.id)
    try {
      const res = await fetch(`/api/cars/${car.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success(newStatus === "published" ? "Car published!" : "Car unpublished")
      await loadCars()
    } catch (e) {
      toast.error("Failed to update status")
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteCar(carId: string) {
    setActionLoading(carId)
    try {
      const res = await fetch(`/api/cars/${carId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete car")
      toast.success("Car deleted")
      setCars((prev) => prev.filter((c) => c.id !== carId))
    } catch {
      toast.error("Failed to delete car")
    } finally {
      setActionLoading(null)
    }
  }

  const activeCars = cars.filter((c) => c.status === "published")
  const draftCars = cars.filter((c) => c.status === "draft")

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Cars</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {cars.length} listing{cars.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/cars/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Car
          </Button>
        </Link>
      </div>

      {cars.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-16 text-center">
            <Car className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No cars yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Add your first car listing to start receiving bookings.
            </p>
            <Link href="/dashboard/cars/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add your first car
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active">Active ({activeCars.length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({draftCars.length})</TabsTrigger>
            <TabsTrigger value="all">All ({cars.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeCars.length === 0 ? (
              <EmptyState title="No active listings" description="Publish your drafts to show them to customers." />
            ) : (
              activeCars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  actionLoading={actionLoading}
                  togglePublish={togglePublish}
                  deleteCar={deleteCar}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4">
            {draftCars.length === 0 ? (
              <EmptyState title="No drafts" description="All your car listings are currently published." />
            ) : (
              draftCars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  actionLoading={actionLoading}
                  togglePublish={togglePublish}
                  deleteCar={deleteCar}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {cars.map((car) => (
              <CarCard
                key={car.id}
                car={car}
                actionLoading={actionLoading}
                togglePublish={togglePublish}
                deleteCar={deleteCar}
              />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <Car className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function CarCard({
  car,
  actionLoading,
  togglePublish,
  deleteCar,
}: {
  car: SellerCar
  actionLoading: string | null
  togglePublish: (car: SellerCar) => void
  deleteCar: (carId: string) => void
}) {
  const firstImage = car.images?.[0]
  const isLoading = actionLoading === car.id

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="relative h-20 w-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
            {firstImage ? (
              <Image src={getStorageUrl(firstImage)} alt={car.title} fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Car className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground line-clamp-1">{car.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {[car.make, car.model, car.year].filter(Boolean).join(" ")}
                  {" • "}
                  {car.seats} seats
                </p>
              </div>
              <Badge variant={car.status === "published" ? "default" : "secondary"} className="flex-shrink-0">
                {car.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {car.price_per_day !== null && (
                <span className="text-sm font-medium">€{Number(car.price_per_day).toFixed(0)}/day</span>
              )}
              <span className="text-xs text-muted-foreground">
                {car.car_schedules?.length ?? 0} slot
                {car.car_schedules?.length !== 1 ? "s" : ""}
              </span>

              <div className="flex items-center gap-1 ml-auto">
                {car.status !== "published" && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                    onClick={() => togglePublish(car)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Publish
                  </Button>
                )}

                <Link href={`/dashboard/cars/${car.id}/edit`}>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-transparent text-xs">
                    <CalendarRange className="h-3.5 w-3.5" />
                    Manage Slots
                  </Button>
                </Link>

                {car.status === "published" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isLoading}
                    onClick={() => togglePublish(car)}
                    title="Unpublish"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                )}

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
                        This will permanently delete &quot;{car.title}&quot; and all its schedules. This action
                        cannot be undone.
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
        </div>
      </CardContent>
    </Card>
  )
}
