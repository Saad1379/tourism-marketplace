"use client"

import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import {
  MapPin, Users, Fuel, Settings2,
  Car as CarIcon, ChevronRight, CalendarRange, CheckCircle2, Loader2,
  ChevronLeft, ChevronRight as ChevronRightIcon
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CarBookingCalendar } from "@/components/car-booking-calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/supabase/auth-context"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────
interface CarSchedule {
  id: string
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
  price_override: number | null
}

interface CarDetailClientProps {
  carId: string
  initialCar: {
    id: string
    title: string
    description: string | null
    city: string | null
    country: string | null
    price_per_day: number | null
    make: string | null
    model: string | null
    year: number | null
    seats: number
    transmission: string | null
    fuel_type: string | null
    features: string[]
    images: string[]
    seller: { id: string; full_name: string; avatar_url: string | null }
    car_schedules: CarSchedule[]
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function rentalDays(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ── Component ──────────────────────────────────────────────────────
export default function CarDetailClient({ carId, initialCar }: CarDetailClientProps) {
  const { user, session } = useAuth()
  const car = initialCar

  // Carousel
  const allImages = car.images?.filter(Boolean) ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const prev = useCallback(() => setActiveIdx((i) => (i === 0 ? allImages.length - 1 : i - 1)), [allImages.length])
  const next = useCallback(() => setActiveIdx((i) => (i === allImages.length - 1 ? 0 : i + 1)), [allImages.length])

  // Keyboard navigation
  useEffect(() => {
    if (allImages.length <= 1) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [allImages.length, prev, next])

  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [adults, setAdults] = useState(1)

  // Booking state
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)

  const selectedSlot = car.car_schedules.find((s) => s.id === selectedScheduleId) ?? null
  const days = selectedSlot ? rentalDays(selectedSlot.start_time, selectedSlot.end_time) : 0
  const pricePerDay = selectedSlot?.price_override ?? car.price_per_day
  const totalPrice = days > 0 && pricePerDay != null ? days * pricePerDay : null

  async function handleBook() {
    if (!selectedScheduleId) { toast.error("Please select a rental window"); return }
    if (!user || !session) { toast.error("Please log in to book"); return }

    setBooking(true)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          resource_type: "car",
          schedule_id: selectedScheduleId,
          adults: Math.max(1, adults),
          children: 0,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Booking failed")
      }

      setBooked(true)
      toast.success("Car booked successfully!", {
        description: selectedSlot
          ? `${fmtDate(selectedSlot.start_time)} → ${fmtDate(selectedSlot.end_time)}`
          : undefined,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed")
    } finally {
      setBooking(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── Image carousel ──────────────────────────────── */}
        <section className="relative bg-muted overflow-hidden" style={{ height: "clamp(260px, 45vw, 520px)" }}>
          {allImages.length === 0 ? (
            <div className="flex h-full items-center justify-center bg-muted">
              <CarIcon className="h-24 w-24 text-muted-foreground/20" />
            </div>
          ) : (
            <>
              {/* Slides */}
              {allImages.map((img, idx) => (
                <div
                  key={img}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-500",
                    idx === activeIdx ? "opacity-100 z-10" : "opacity-0 z-0",
                  )}
                >
                  <Image
                    src={img}
                    alt={`${car.title} photo ${idx + 1}`}
                    fill
                    className="object-cover"
                    priority={idx === 0}
                  />
                </div>
              ))}

              {/* Prev / Next arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    aria-label="Previous photo"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors shadow"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={next}
                    aria-label="Next photo"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors shadow"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>

                  {/* Dot indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                    {allImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveIdx(idx)}
                        aria-label={`Go to photo ${idx + 1}`}
                        className={cn(
                          "rounded-full transition-all",
                          idx === activeIdx
                            ? "w-5 h-2 bg-white"
                            : "w-2 h-2 bg-white/50 hover:bg-white/80",
                        )}
                      />
                    ))}
                  </div>

                  {/* Counter */}
                  <div className="absolute top-3 right-3 z-20 rounded-full bg-background/70 backdrop-blur-sm px-2.5 py-1 text-xs font-medium">
                    {activeIdx + 1} / {allImages.length}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left: Car info ─────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title + location */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {car.transmission && (
                    <Badge variant="outline" className="capitalize">{car.transmission}</Badge>
                  )}
                  {car.fuel_type && (
                    <Badge variant="outline" className="capitalize">{car.fuel_type}</Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-foreground">{car.title}</h1>
                {(car.city || car.country) && (
                  <p className="flex items-center gap-1 text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4" />
                    {[car.city, car.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Make", value: car.make },
                  { label: "Model", value: car.model },
                  { label: "Year", value: car.year },
                  { label: "Seats", value: car.seats ? `${car.seats} seats` : null },
                  { label: "Transmission", value: car.transmission, icon: <Settings2 className="h-4 w-4" /> },
                  { label: "Fuel", value: car.fuel_type, icon: <Fuel className="h-4 w-4" /> },
                ].filter(s => s.value).map((spec) => (
                  <div key={spec.label} className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">{spec.label}</p>
                    <p className="font-semibold text-sm mt-0.5 capitalize">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              {car.description && (
                <Card className="border-border/50">
                  <CardHeader><CardTitle className="text-base">About this car</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{car.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Features */}
              {car.features?.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader><CardTitle className="text-base">Features</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {car.features.map((f) => (
                        <Badge key={f} variant="secondary">{f}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Seller */}
              {car.seller && (
                <Card className="border-border/50">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {car.seller.avatar_url ? (
                          <Image src={car.seller.avatar_url} alt={car.seller.full_name} fill className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-lg font-bold text-muted-foreground">
                            {car.seller.full_name?.[0] ?? "?"}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Listed by</p>
                        <p className="font-semibold">{car.seller.full_name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right: Booking widget ────────────────────── */}
            <div className="space-y-4">
              {/* Price */}
              {car.price_per_day != null && (
                <Card className="border-border/50">
                  <CardContent className="pt-5 pb-4">
                    <p className="text-3xl font-bold text-foreground">
                      €{Number(car.price_per_day).toFixed(0)}
                      <span className="text-base font-normal text-muted-foreground">/day</span>
                    </p>
                    {selectedSlot && totalPrice != null && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {days} day{days !== 1 ? "s" : ""} · <span className="font-semibold text-foreground">€{totalPrice.toFixed(0)} total</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Calendar */}
              {!booked ? (
                <>
                  <CarBookingCalendar
                    schedules={car.car_schedules}
                    selectedDate={selectedDate}
                    selectedScheduleId={selectedScheduleId}
                    onSelectDate={setSelectedDate}
                    onSelectSchedule={setSelectedScheduleId}
                    timeZone={typeof Intl !== "undefined"
                      ? Intl.DateTimeFormat().resolvedOptions().timeZone
                      : "UTC"}
                  />

                  {/* Guests & book */}
                  {selectedScheduleId && (
                    <Card className="border-border/50">
                      <CardContent className="pt-5 space-y-4">
                        <div>
                          <Label htmlFor="adults-input">Number of passengers</Label>
                          <Input
                            id="adults-input"
                            type="number"
                            min={1}
                            max={car.seats || 9}
                            value={adults}
                            onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
                            className="mt-1.5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Max {car.seats ?? "—"} passengers
                          </p>
                        </div>

                        {selectedSlot && (
                          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pick-up</span>
                              <span className="font-medium">{fmtDate(selectedSlot.start_time)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Return</span>
                              <span className="font-medium">{fmtDate(selectedSlot.end_time)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Duration</span>
                              <span className="font-medium">{days} day{days !== 1 ? "s" : ""}</span>
                            </div>
                            {totalPrice != null && (
                              <div className="flex justify-between border-t pt-1 mt-1">
                                <span className="font-semibold">Total</span>
                                <span className="font-bold text-primary">€{totalPrice.toFixed(0)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {!user ? (
                          <Link href="/login">
                            <Button className="w-full">Log in to Book</Button>
                          </Link>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={handleBook}
                            disabled={booking}
                          >
                            {booking
                              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Booking…</>
                              : "Book This Car"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6 text-center space-y-3">
                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                    <h3 className="text-lg font-bold">Booking Confirmed!</h3>
                    {selectedSlot && (
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(selectedSlot.start_time)} → {fmtDate(selectedSlot.end_time)}
                      </p>
                    )}
                    <Link href="/profile?tab=bookings">
                      <Button variant="outline" className="w-full mt-2">
                        View My Bookings <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
