"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { format, parseISO, addDays } from "date-fns"
import {
  ChevronLeft, Plus, Trash2, Car, CalendarRange, Loader2, ImageIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { CarImageUploader } from "@/components/cars/car-image-uploader"

// ── Types ──────────────────────────────────────────────────────────
interface CarSchedule {
  id: string
  car_id: string
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
  price_override: number | null
}

interface CarData {
  id: string
  title: string
  status: string
  price_per_day: number | null
  make: string | null
  model: string | null
  year: number | null
  seats: number
  images: string[]
}

// ── Helpers ────────────────────────────────────────────────────────
function rentalDays(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000))
}

function fmtDate(iso: string) {
  return format(parseISO(iso), "EEE, MMM d yyyy")
}

function toLocalDatetimeValue(iso: string) {
  // Trim to "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
  return iso.slice(0, 16)
}

// ── Component ──────────────────────────────────────────────────────
export default function CarScheduleEditPage() {
  const params = useParams()
  const router = useRouter()
  const carId = params.id as string

  const [car, setCar] = useState<CarData | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [schedules, setSchedules] = useState<CarSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // New slot form state
  const today = format(new Date(), "yyyy-MM-dd")
  const threeDaysLater = format(addDays(new Date(), 3), "yyyy-MM-dd")
  const [newStart, setNewStart] = useState(`${today}T10:00`)
  const [newEnd, setNewEnd] = useState(`${threeDaysLater}T10:00`)
  const [newCapacity, setNewCapacity] = useState(1)
  const [newPriceOverride, setNewPriceOverride] = useState("")

  // Load car + schedules
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [carRes, schRes] = await Promise.all([
          fetch(`/api/cars/${carId}`),
          fetch(`/api/cars/${carId}/schedules`),
        ])
        if (!carRes.ok) throw new Error("Car not found")
        const carData = await carRes.json()
        setCar(carData)
        setImages(Array.isArray(carData.images) ? carData.images : [])
        if (schRes.ok) setSchedules(await schRes.json())
      } catch {
        toast.error("Failed to load car data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [carId])

  // ── Add slot ──────────────────────────────────────────────────
  async function addSlot() {
    if (!newStart || !newEnd) { toast.error("Start and end are required"); return }
    if (new Date(newEnd) <= new Date(newStart)) { toast.error("End must be after start"); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/cars/${carId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: new Date(newStart).toISOString(),
          end_time: new Date(newEnd).toISOString(),
          capacity: Math.max(1, newCapacity),
          price_override: newPriceOverride ? Number(newPriceOverride) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create slot")
      }
      const created = await res.json()
      setSchedules((prev) => [...prev, created].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ))
      toast.success("Rental window added!")
      // Advance defaults for next slot
      setNewStart(newEnd)
      setNewEnd(format(addDays(new Date(newEnd), 3), "yyyy-MM-dd") + "T10:00")
      setNewPriceOverride("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add slot")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete slot ───────────────────────────────────────────────
  async function deleteSlot(scheduleId: string) {
    setDeletingId(scheduleId)
    try {
      const res = await fetch(`/api/cars/${carId}/schedules?schedule_id=${scheduleId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
      toast.success("Slot removed")
    } catch {
      toast.error("Failed to delete slot")
    } finally {
      setDeletingId(null)
    }
  }

  // ── Toggle Status ───────────────────────────────────────────
  const [statusLoading, setStatusLoading] = useState(false)
  async function togglePublish() {
    if (!car) return
    const newStatus = car.status === "published" ? "draft" : "published"
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/cars/${car.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      setCar({ ...car, status: newStatus })
      toast.success(newStatus === "published" ? "Car published!" : "Car unpublished")
    } catch {
      toast.error("Failed to update status")
    } finally {
      setStatusLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!car) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <Car className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">Car not found or you don't have access.</p>
        <Link href="/dashboard/cars"><Button variant="outline" className="mt-4">Back to My Cars</Button></Link>
      </div>
    )
  }

  const upcoming = schedules.filter((s) => new Date(s.end_time) > new Date())
  const past = schedules.filter((s) => new Date(s.end_time) <= new Date())

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/cars"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Back to My Cars
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">{car.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[car.make, car.model, car.year].filter(Boolean).join(" ")} · Edit photos &amp; rental windows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={car.status === "published" ? "default" : "secondary"} className="flex-shrink-0">
              {car.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePublish}
              disabled={statusLoading}
              className="h-7 text-xs"
            >
              {statusLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : car.status === "published" ? (
                "Unpublish"
              ) : (
                "Publish"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Images ─────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4 text-primary" />
            Photos
          </CardTitle>
          <CardDescription>
            The first photo is the featured image shown on listing cards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CarImageUploader
            images={images}
            onChange={setImages}
            carId={carId}
          />
        </CardContent>
      </Card>

      {/* ── Add new rental window ───────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4 text-primary" />
            Add Rental Window
          </CardTitle>
          <CardDescription>
            Define when this car is available. Buyers pick from these windows when booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="new-start">Pick-up date &amp; time *</Label>
              <Input
                id="new-start"
                type="datetime-local"
                value={newStart}
                min={`${today}T00:00`}
                onChange={(e) => setNewStart(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="new-end">Return date &amp; time *</Label>
              <Input
                id="new-end"
                type="datetime-local"
                value={newEnd}
                min={newStart}
                onChange={(e) => setNewEnd(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="new-capacity">Capacity (units)</Label>
              <Input
                id="new-capacity"
                type="number"
                min={1}
                value={newCapacity}
                onChange={(e) => setNewCapacity(Math.max(1, Number(e.target.value)))}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usually 1 for a single car. Increase if you have multiple identical cars.
              </p>
            </div>
            <div>
              <Label htmlFor="new-price">Price override (€/day)</Label>
              <Input
                id="new-price"
                type="number"
                min={0}
                step={0.01}
                value={newPriceOverride}
                onChange={(e) => setNewPriceOverride(e.target.value)}
                placeholder={car.price_per_day ? `Default: €${car.price_per_day}/day` : "Use listing price"}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use the listing&apos;s default price.
              </p>
            </div>
          </div>

          {/* Duration preview */}
          {newStart && newEnd && new Date(newEnd) > new Date(newStart) && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
              <span className="font-medium text-primary">
                {rentalDays(new Date(newStart).toISOString(), new Date(newEnd).toISOString())} day
                {rentalDays(new Date(newStart).toISOString(), new Date(newEnd).toISOString()) !== 1 ? "s" : ""} rental window
              </span>
              <span className="text-muted-foreground ml-2">
                {format(new Date(newStart), "MMM d")} → {format(new Date(newEnd), "MMM d, yyyy")}
              </span>
            </div>
          )}

          <Button onClick={addSlot} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {saving ? "Adding…" : "Add Rental Window"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Existing slots ────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Upcoming Windows ({upcoming.length})</span>
            {upcoming.length === 0 && (
              <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                ⚠ No upcoming slots — buyers can't book yet
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No upcoming rental windows. Add one above.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  defaultPrice={car.price_per_day}
                  deleting={deletingId === slot.id}
                  onDelete={() => deleteSlot(slot.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card className="border-border/40 opacity-70">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Past Windows ({past.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {past.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  defaultPrice={car.price_per_day}
                  deleting={deletingId === slot.id}
                  onDelete={() => deleteSlot(slot.id)}
                  isPast
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── SlotRow sub-component ──────────────────────────────────────────
function SlotRow({
  slot,
  defaultPrice,
  deleting,
  onDelete,
  isPast = false,
}: {
  slot: CarSchedule
  defaultPrice: number | null
  deleting: boolean
  onDelete: () => void
  isPast?: boolean
}) {
  const days = rentalDays(slot.start_time, slot.end_time)
  const isFull = slot.booked_count >= slot.capacity
  const price = slot.price_override ?? defaultPrice

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${isPast ? "border-border/30 bg-muted/20" : "border-border/50 bg-card"}`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Car className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">
          {days} day{days !== 1 ? "s" : ""}
          {price != null && (
            <span className="text-primary ml-2">€{Number(price).toFixed(0)}/day</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {fmtDate(slot.start_time)} → {fmtDate(slot.end_time)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant={isFull ? "destructive" : isPast ? "secondary" : "outline"} className="text-xs">
          {isFull ? "Full" : `${slot.capacity - slot.booked_count}/${slot.capacity} avail`}
        </Badge>
        {!isFull && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deleting}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove rental window?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the {days}-day window ({fmtDate(slot.start_time)} → {fmtDate(slot.end_time)}).
                  Buyers with existing bookings won't be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
