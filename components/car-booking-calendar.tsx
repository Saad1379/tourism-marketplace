"use client"

/**
 * CarBookingCalendar
 *
 * Mirrors TourBookingCalendar but adapted for car rental semantics:
 *   - Each car_schedule is a RENTAL WINDOW (start_time → end_time).
 *   - The buyer picks a pick-up date from available windows, then the
 *     component shows all windows that start on that date so they can
 *     choose duration / return date.
 *   - A slot is "available" when capacity > booked_count.
 *
 * Props are intentionally identical shape to TourBookingCalendar so the
 * same booking form wrapper can drive either calendar.
 */

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Car, CalendarRange } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface CarSchedule {
  id: string
  start_time: string
  end_time: string
  capacity: number
  booked_count?: number
  price_override?: number | null
}

interface CarBookingCalendarProps {
  schedules: CarSchedule[]
  onSelectDate: (date: Date | null) => void
  onSelectSchedule: (scheduleId: string | null) => void
  selectedDate: Date | null
  selectedScheduleId: string | null
  /** IANA timezone for display (e.g. "Europe/Paris"). Falls back to browser local. */
  timeZone?: string
}

// ────────────────────────────────────────────────────────────────
// Utilities (same pattern as TourBookingCalendar)
// ────────────────────────────────────────────────────────────────

const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

function toDatePartsInTZ(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = fmt.formatToParts(date)
  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  const day = Number(parts.find((p) => p.type === "day")?.value)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

function buildDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function toDateKeyInTZ(date: Date, tz: string): string | null {
  const parts = toDatePartsInTZ(date, tz)
  if (!parts) return null
  return buildDateKey(parts.year, parts.month, parts.day)
}

function parseDateKey(k: string) {
  const [yr, mo, dy] = k.split("-").map(Number)
  if (!Number.isFinite(yr) || !Number.isFinite(mo) || !Number.isFinite(dy)) return null
  return { year: yr, month: mo, day: dy }
}

function dateToLocalKey(d: Date) {
  return buildDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function formatMonthHeading(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function formatDateKey(dateKey: string, tz: string) {
  const p = parseDateKey(dateKey)
  if (!p) return dateKey
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12))
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz })
}

/** Rental duration in whole days (always positive). */
function rentalDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.round(ms / 86_400_000))
}

function formatRentalWindow(start: string, end: string, tz: string) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: tz,
    })
  const days = rentalDays(start, end)
  return `${fmt(start)} → ${fmt(end)}  (${days} day${days !== 1 ? "s" : ""})`
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function CarBookingCalendar({
  schedules,
  onSelectDate,
  onSelectSchedule,
  selectedDate,
  selectedScheduleId,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: CarBookingCalendarProps) {
  const safeSchedules = Array.isArray(schedules) ? schedules : []

  // Current month shown in calendar
  const [currentMonth, setCurrentMonth] = useState(() => {
    const parts = toDatePartsInTZ(new Date(), timeZone)
    if (!parts) return new Date()
    return new Date(parts.year, parts.month - 1, 1)
  })

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() =>
    selectedDate ? dateToLocalKey(selectedDate) : null,
  )

  // Sync when parent clears selection
  useEffect(() => {
    setSelectedDateKey(selectedDate ? dateToLocalKey(selectedDate) : null)
  }, [selectedDate])

  // Group schedules by the START DATE of each rental window
  const schedulesByDate = useMemo(() => {
    const grouped: Record<string, (CarSchedule & { available: number })[]> = {}
    safeSchedules.forEach((s) => {
      const startDate = new Date(s.start_time)
      if (!Number.isFinite(startDate.getTime())) return
      const key = toDateKeyInTZ(startDate, timeZone)
      if (!key) return
      if (!grouped[key]) grouped[key] = []
      const available = (s.capacity || 0) - (s.booked_count || 0)
      grouped[key].push({ ...s, available })
    })
    return grouped
  }, [safeSchedules, timeZone])

  // Days in current month that have ≥1 available slot
  const availableDays = useMemo(() => {
    const todayKey = toDateKeyInTZ(new Date(), timeZone)
    if (!todayKey) return []
    return Object.entries(schedulesByDate)
      .filter(([key, slots]) => {
        if (key < todayKey) return false
        if (!slots.some((s) => s.available > 0)) return false
        const p = parseDateKey(key)
        return p && p.year === currentMonth.getFullYear() && p.month - 1 === currentMonth.getMonth()
      })
      .map(([key]) => parseDateKey(key)?.day)
      .filter((d): d is number => typeof d === "number")
  }, [schedulesByDate, currentMonth, timeZone])

  // Slots for the selected pick-up date, sorted by duration (shortest first)
  const slotsForDate = useMemo(() => {
    if (!selectedDateKey) return []
    const slots = schedulesByDate[selectedDateKey] ?? []
    return [...slots].sort(
      (a, b) => rentalDays(a.start_time, a.end_time) - rentalDays(b.start_time, b.end_time),
    )
  }, [selectedDateKey, schedulesByDate])

  // Calendar grid helpers
  const firstDaySun = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const firstDayMon = (firstDaySun + 6) % 7
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()

  const isDateSelected = (day: number) => {
    if (!selectedDateKey) return false
    return selectedDateKey === buildDateKey(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day)
  }

  const handleDateClick = (day: number) => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const key = buildDateKey(year, month, day)
    setSelectedDateKey(key)
    onSelectDate(new Date(year, month - 1, day, 12))
    onSelectSchedule(null) // reset slot when pick-up date changes
  }

  const helperText = useMemo(() => {
    if (!selectedDateKey) return "Select a pick-up date"
    if (slotsForDate.length === 0) return "No rental windows available on this date"
    if (!selectedScheduleId) return "Now choose a rental window"
    return ""
  }, [selectedDateKey, slotsForDate.length, selectedScheduleId])

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          Select Rental Period
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {helperText || "Choose your pick-up date and rental window"}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Month calendar ── */}
        <div className="space-y-4">
          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-center min-w-32">{formatMonthHeading(currentMonth)}</h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grid */}
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {/* Weekday headers */}
            {WEEKDAY_HEADERS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-2 min-h-[44px] flex items-center justify-center"
              >
                {d}
              </div>
            ))}

            {/* Offset empty cells */}
            {Array.from({ length: firstDayMon }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[44px]" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const hasSlots = availableDays.includes(day)
              const isSelected = isDateSelected(day)
              return (
                <button
                  key={day}
                  disabled={!hasSlots}
                  onClick={() => hasSlots && handleDateClick(day)}
                  aria-selected={isSelected}
                  aria-label={`${buildDateKey(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day)}, ${hasSlots ? "available" : "not available"}`}
                  className={`
                    min-h-[44px] rounded-lg text-sm font-medium transition-all
                    flex items-center justify-center
                    ${!hasSlots ? "text-muted-foreground/40 cursor-not-allowed bg-muted/20" : "cursor-pointer"}
                    ${isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                      : hasSlots
                        ? "bg-muted hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary"
                        : ""}
                  `}
                >
                  {day}
                  {hasSlots && !isSelected && (
                    <span className="absolute mt-6 block h-1 w-1 rounded-full bg-primary opacity-70" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Rental window slots ── */}
        {selectedDateKey && (
          <div className="pt-4 border-t border-border space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Available rental windows starting{" "}
              <span className="text-primary">{formatDateKey(selectedDateKey, timeZone)}</span>
            </h3>

            {slotsForDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rental windows available on this date.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {slotsForDate.map((slot) => {
                  const isSelected = selectedScheduleId === slot.id
                  const isFull = slot.available <= 0
                  const days = rentalDays(slot.start_time, slot.end_time)
                  const price = slot.price_override

                  return (
                    <button
                      key={slot.id}
                      disabled={isFull}
                      onClick={() => !isFull && onSelectSchedule(slot.id)}
                      aria-selected={isSelected}
                      aria-label={`${days} day rental, ${isFull ? "fully booked" : `${slot.available} available`}`}
                      className={`
                        w-full text-left p-3 rounded-xl border-2 transition-all
                        ${isFull
                          ? "border-border/30 bg-muted/30 opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1"
                            : "border-border/50 bg-card hover:border-primary/40 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary"}
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Car className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {days} day{days !== 1 ? "s" : ""} rental
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {formatRentalWindow(slot.start_time, slot.end_time, timeZone)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {price != null && (
                            <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                              €{Number(price).toFixed(0)}
                              <span className="text-xs font-normal text-muted-foreground">/day</span>
                            </span>
                          )}
                          <Badge
                            variant={isFull ? "destructive" : isSelected ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {isFull ? "Full" : `${slot.available} left`}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Clear selection ── */}
        {(selectedDateKey || selectedScheduleId) && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent"
              onClick={() => {
                setSelectedDateKey(null)
                onSelectDate(null)
                onSelectSchedule(null)
              }}
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* ── Empty state ── */}
        {safeSchedules.length === 0 && (
          <div className="text-center py-8">
            <Car className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No rental windows available yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
