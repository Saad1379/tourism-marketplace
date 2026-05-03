"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

const DAYS_OF_WEEK = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
  { label: "Sunday", value: 0 },
]

interface RecurringScheduleBuilderProps {
  tourLanguages: string[]
  onGenerate: (schedules: any[]) => void
  existingSchedules?: any[]
  defaultCapacity?: number
  maxCapacity?: number
}

export function RecurringScheduleBuilder({
  tourLanguages,
  onGenerate,
  existingSchedules = [],
  defaultCapacity = 8,
  maxCapacity = 50,
}: RecurringScheduleBuilderProps) {
  const [showRecurring, setShowRecurring] = useState(true)
  const [selectedDays, setSelectedDays] = useState<number[]>([]) // No days selected by default
  const [time, setTime] = useState("")
  const [capacity, setCapacity] = useState(String(defaultCapacity))
  const [language, setLanguage] = useState(tourLanguages[0] || "English")
  const [startDate, setStartDate] = useState("")
  const [weeksCount, setWeeksCount] = useState("")
  const [generatedCount, setGeneratedCount] = useState(0)

  useEffect(() => {
    if (tourLanguages.length > 0) {
      if (!tourLanguages.includes(language)) {
        setLanguage(tourLanguages[0])
      } else if (tourLanguages.length === 1) {
        setLanguage(tourLanguages[0])
      }
    }
  }, [tourLanguages, language])

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const generateSchedules = () => {
    if (selectedDays.length === 0) {
      alert("Please select at least one day")
      return
    }

    if (!startDate) {
      alert("Please select a start date")
      return
    }

    if (!time) {
      alert("Please select a time")
      return
    }

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    
    const weeks = parseInt(weeksCount) || 8
    const endDate = new Date(start.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)

    const newSchedules = []
    const [hours, minutes] = time.split(":").map(Number)

    console.log("[v0] Generating schedules from", start.toDateString(), "to", endDate.toDateString())
    console.log("[v0] Selected days:", selectedDays)
    console.log("[v0] Time:", time, "Capacity:", capacity, "Language:", language)

    // Iterate through each day in the range
    for (let currentDate = new Date(start); currentDate < endDate; currentDate.setDate(currentDate.getDate() + 1)) {
      const dayOfWeek = currentDate.getDay()
      
      if (selectedDays.includes(dayOfWeek)) {
        // Create a new date object to avoid mutation issues
        const scheduleDate = new Date(currentDate)
        scheduleDate.setHours(hours, minutes, 0, 0)
        const isoString = scheduleDate.toISOString()

        const schedule = {
          id: `temp_${Date.now()}_${Math.random()}`,
          start_time: isoString,
          capacity: Math.min(parseInt(capacity) || defaultCapacity, maxCapacity),
          language: language,
          startDate: scheduleDate.toISOString().split("T")[0],
          time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
          isNew: true,
        }

        console.log("[v0] Generated schedule:", schedule.startDate, schedule.time)
        newSchedules.push(schedule)
      }
    }

    console.log("[v0] Total schedules generated:", newSchedules.length)
    setGeneratedCount(newSchedules.length)
    
    if (newSchedules.length > 0) {
      onGenerate(newSchedules)
    } else {
      alert("No schedules were generated. Please check your settings.")
    }
  }

  const languageOptions = tourLanguages.length > 0 ? tourLanguages : ["English"]

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="space-y-3 border-b pb-4">
        <Label className="text-sm font-semibold">Schedule Type</Label>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-8">
          <label className="flex items-start sm:items-center gap-2 sm:gap-3 cursor-pointer">
            <input
              type="radio"
              name="schedule-mode"
              checked={showRecurring}
              onChange={() => setShowRecurring(true)}
              className="h-4 w-4 mt-0.5 sm:mt-0 shrink-0"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
              <span className="text-sm font-medium">Recurring Schedule</span>
              <span className="text-xs text-muted-foreground">(Bulk generate for weeks)</span>
            </div>
          </label>
          <label className="flex items-start sm:items-center gap-2 sm:gap-3 cursor-pointer">
            <input
              type="radio"
              name="schedule-mode"
              checked={!showRecurring}
              onChange={() => setShowRecurring(false)}
              className="h-4 w-4 mt-0.5 sm:mt-0 shrink-0"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
              <span className="text-sm font-medium">Add Individual Slots</span>
              <span className="text-xs text-muted-foreground">(One at a time)</span>
            </div>
          </label>
        </div>
      </div>

      {showRecurring && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate Weekly Schedule</CardTitle>
            <CardDescription>Automatically create repeating time slots</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Days Selection */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Days of Week</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <label key={day.value} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 p-2 rounded">
                    <Checkbox
                      checked={selectedDays.includes(day.value)}
                      onCheckedChange={() => handleDayToggle(day.value)}
                    />
                    <span className="text-xs sm:text-sm">{day.label.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="time" className="text-sm font-medium">
                  Time
                </Label>
                <Input type="time" id="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="capacity" className="text-sm font-medium">
                  Capacity per Slot
                </Label>
                <Input
                  type="number"
                  id="capacity"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  min="1"
                  max={String(maxCapacity)}
                />
              </div>
            </div>

            {/* Language Selection */}
            {languageOptions.length > 1 && (
            <div>
              <Label htmlFor="language" className="text-sm font-medium">
                Language
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-sm font-medium">
                  Start Date
                </Label>
                <Input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="weeks" className="text-sm font-medium">
                  Duration (weeks)
                </Label>
                <Input
                  type="number"
                  id="weeks"
                  value={weeksCount}
                  onChange={(e) => setWeeksCount(e.target.value)}
                  min="1"
                  max="52"
                />
              </div>
            </div>

            {/* Generate Button */}
            <Button onClick={generateSchedules} className="w-full" size="lg">
              <Plus className="h-4 w-4 mr-2" />
              <span className="truncate">Generate {selectedDays.length > 0 ? `${selectedDays.length * parseInt(weeksCount || '8')} Schedules` : "Schedules"}</span>
            </Button>

            {generatedCount > 0 && (
              <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4 text-sm text-secondary">
                <div className="font-semibold mb-1">Success!</div>
                <div>Generated {generatedCount} schedule slots. They appear below in the schedule list.</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
