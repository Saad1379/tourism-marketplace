"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Schedule {
  id: string
  start_time: string
  capacity: number
  booked_count?: number
  language?: string
}

interface TourBookingCalendarProps {
  schedules: Schedule[]
  onSelectDate: (date: Date | null) => void
  onSelectSchedule: (scheduleId: string | null) => void
  selectedDate: Date | null
  selectedScheduleId: string | null
  tourTimeZone: string
}

const WEEKDAY_HEADERS_MONDAY_FIRST = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

function toDatePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } | null {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === "year")?.value || "")
  const month = Number(parts.find((part) => part.type === "month")?.value || "")
  const day = Number(parts.find((part) => part.type === "day")?.value || "")

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  return { year, month, day }
}

function buildDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function toDateKeyInTimeZone(date: Date, timeZone: string): string | null {
  const parts = toDatePartsInTimeZone(date, timeZone)
  if (!parts) return null
  return buildDateKey(parts.year, parts.month, parts.day)
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

function dateToLocalKey(date: Date): string {
  return buildDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function formatMonthHeading(monthDate: Date) {
  return monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function formatDateKeyForDisplay(dateKey: string, timeZone: string): string {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return dateKey

  const { year, month, day } = parsed
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone,
  })
}

export function TourBookingCalendar({
  schedules,
  onSelectDate,
  onSelectSchedule,
  selectedDate,
  selectedScheduleId,
  tourTimeZone,
}: TourBookingCalendarProps) {
  const safeSchedules = Array.isArray(schedules) ? schedules : []
  const [currentMonth, setCurrentMonth] = useState(() => {
    const nowParts = toDatePartsInTimeZone(new Date(), tourTimeZone)
    if (!nowParts) return new Date()
    return new Date(nowParts.year, nowParts.month - 1, 1)
  })
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() =>
    selectedDate ? dateToLocalKey(selectedDate) : null,
  )

  useEffect(() => {
    setSelectedDateKey(selectedDate ? dateToLocalKey(selectedDate) : null)
  }, [selectedDate])

  useEffect(() => {
    const nowParts = toDatePartsInTimeZone(new Date(), tourTimeZone)
    if (!nowParts) return
    setCurrentMonth((prev) => {
      if (prev.getFullYear() === nowParts.year && prev.getMonth() === nowParts.month - 1) {
        return prev
      }
      return new Date(nowParts.year, nowParts.month - 1, 1)
    })
  }, [tourTimeZone])

  const schedulesByDate = useMemo(() => {
    const grouped: Record<string, (Schedule & { available: number })[]> = {}
    safeSchedules.forEach((schedule) => {
      const parsedStart = new Date(schedule.start_time)
      if (!Number.isFinite(parsedStart.getTime())) return
      const dateKey = toDateKeyInTimeZone(parsedStart, tourTimeZone)
      if (!dateKey) return
      if (!grouped[dateKey]) grouped[dateKey] = []
      const available = (schedule.capacity || 0) - (schedule.booked_count || 0)
      grouped[dateKey].push({ ...schedule, available })
    })
    return grouped
  }, [safeSchedules, tourTimeZone])

  // Dates that have at least one available slot
  const datesWithAvailability = useMemo(() => {
    const todayKey = toDateKeyInTimeZone(new Date(), tourTimeZone)
    if (!todayKey) return []

    return Object.entries(schedulesByDate)
      .filter(([dateKey, slots]) => {
        if (!slots.some((schedule) => schedule.available > 0)) return false
        if (dateKey < todayKey) return false
        const parts = parseDateKey(dateKey)
        if (!parts) return false
        return parts.year === currentMonth.getFullYear() && parts.month - 1 === currentMonth.getMonth()
      })
      .map(([dateKey]) => parseDateKey(dateKey)?.day)
      .filter((day): day is number => typeof day === "number")
  }, [schedulesByDate, currentMonth, tourTimeZone])

  const handleDateClick = (day: number) => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const dateKey = buildDateKey(year, month, day)
    setSelectedDateKey(dateKey)

    const clickedDate = new Date(year, month - 1, day, 12, 0, 0)
    onSelectDate(clickedDate)
    onSelectSchedule(null) // Reset time slot when date changes
  }

  const timesForSelectedDate = useMemo(() => {
    if (!selectedDateKey) return []
    const slots = schedulesByDate[selectedDateKey] || []
    return slots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [selectedDateKey, schedulesByDate])

  const firstDaySundayBased = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const firstDayMondayBased = (firstDaySundayBased + 6) % 7
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const helperText = useMemo(() => {
    if (!selectedDateKey) return "Select a date"
    if (timesForSelectedDate.length === 0) return "No times available for this date"
    if (!selectedScheduleId) return "Now choose a time"
    return ""
  }, [selectedDateKey, selectedScheduleId, timesForSelectedDate])

  const isDateSelected = (day: number) => {
    if (!selectedDateKey) return false
    return selectedDateKey === buildDateKey(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day)
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Select Travel Date & Time</CardTitle>
        <p className="text-xs text-muted-foreground mt-2">{helperText || "Choose your preferred date and time"}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Calendar Section */}
        <div className="space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-center min-w-32">
              {formatMonthHeading(currentMonth)}
            </h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Calendar Grid - Fixed 7-column layout */}
          <div
            className="grid gap-2 sm:gap-2"
            style={{
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            }}
          >
            {/* Day headers */}
            {WEEKDAY_HEADERS_MONDAY_FIRST.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2 min-h-[44px] flex items-center justify-center"
              >
                {day}
              </div>
            ))}

            {/* Empty cells for first week */}
            {Array.from({ length: firstDayMondayBased }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[44px]" />
            ))}

            {/* Day cells */}
            {days.map((day) => {
              const hasAvailability = datesWithAvailability.includes(day)
              const isSelected = isDateSelected(day)

              return (
                <button
                  key={day}
                  onClick={() => {
                    if (hasAvailability) handleDateClick(day)
                  }}
                  disabled={!hasAvailability}
                  aria-selected={isSelected}
                  aria-label={`${buildDateKey(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day)}, ${hasAvailability ? "available" : "not available"}`}
                  className={`
                    min-h-[44px] rounded-lg text-sm font-medium transition-all
                    flex items-center justify-center
                    ${!hasAvailability ? "text-muted-foreground/50 cursor-not-allowed bg-muted/30" : "cursor-pointer"}
                    ${isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" : hasAvailability ? "bg-muted hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary" : ""}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time Slots Section - Shows only when date is selected */}
        {selectedDateKey && (
          <div className="pt-4 border-t border-border space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Available times on{" "}
              {formatDateKeyForDisplay(selectedDateKey, tourTimeZone)}
            </h3>

            {timesForSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No times available for this date</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {timesForSelectedDate.map((schedule) => {
                  const startTime = new Date(schedule.start_time)
                  const timeStr = startTime.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: tourTimeZone,
                  })
                  const isSelected = selectedScheduleId === schedule.id
                  const isFull = schedule.available <= 0

                  return (
                    <button
                      key={schedule.id}
                      onClick={() => {
                        if (!isFull) onSelectSchedule(schedule.id)
                      }}
                      disabled={isFull}
                      aria-selected={isSelected}
                      aria-label={`${timeStr}, ${isFull ? "full" : `${schedule.available} spots left`}`}
                      className={`
                        p-2 rounded-lg text-sm transition-all
                        min-h-[44px] flex flex-col items-center justify-center
                        ${
                          isFull
                            ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                              : "bg-muted hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary"
                        }
                      `}
                    >
                      <span className="font-medium">{timeStr}</span>
                      {schedule.language && (
                        <span className="text-xs font-medium text-primary mb-1">
                          {schedule.language}
                        </span>
                      )}
                      <span
                        className={`text-xs ${isFull ? "text-destructive/70" : isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                      >
                        {isFull ? "Full" : schedule.available === 1 ? "1 left" : `${schedule.available} left`}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Clear Selection Button - Visible when date or time is selected */}
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

        {/* Empty State */}
        {safeSchedules.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No dates available for booking</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
