"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Map, CalendarDays, Users, Save, RefreshCw, Info } from "lucide-react"

type PlanSettings = {
  plan_type: string
  max_tours: number
  max_schedules_per_week: number
  max_tourist_capacity: number
  updated_at: string
}

type FormState = {
  max_tours: string
  max_schedules_per_week: string
  max_tourist_capacity: string
}

const FIELDS = [
  {
    key: "max_tours" as const,
    label: "Max Tours",
    description: "Maximum number of tours a free-plan guide can create.",
    icon: Map,
    min: 0,
    max: 100,
    unit: "tours",
    hint: "Set to 0 to block free guides from creating any tour.",
  },
  {
    key: "max_schedules_per_week" as const,
    label: "Max Schedules per Week",
    description: "Maximum number of tour schedules a free-plan guide can publish in a single calendar week.",
    icon: CalendarDays,
    min: 0,
    max: 100,
    unit: "schedules / week",
    hint: "The week boundary follows ISO calendar weeks (Mon–Sun).",
  },
  {
    key: "max_tourist_capacity" as const,
    label: "Max Tourist Capacity",
    description: "Maximum number of adult tourists allowed per tour or schedule for free-plan guides.",
    icon: Users,
    min: 1,
    max: 500,
    unit: "adults",
    hint: "Applies to both the tour's max_capacity and each schedule's capacity.",
  },
]

export default function PlanSettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<PlanSettings | null>(null)
  const [form, setForm] = useState<FormState>({ max_tours: "", max_schedules_per_week: "", max_tourist_capacity: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/plan-settings")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSettings(data.settings)
      setForm({
        max_tours: String(data.settings.max_tours),
        max_schedules_per_week: String(data.settings.max_schedules_per_week),
        max_tourist_capacity: String(data.settings.max_tourist_capacity),
      })
      setDirty(false)
    } catch (err) {
      toast({ title: "Failed to load settings", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSettings() }, [])

  function handleChange(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    // Validate all fields before submitting
    for (const field of FIELDS) {
      const raw = form[field.key]
      const v = Number(raw)
      if (!Number.isInteger(v) || v < field.min || v > field.max) {
        toast({
          title: `Invalid value for "${field.label}"`,
          description: `Must be a whole number between ${field.min} and ${field.max}.`,
          variant: "destructive",
        })
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/plan-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tours: Number(form.max_tours),
          max_schedules_per_week: Number(form.max_schedules_per_week),
          max_tourist_capacity: Number(form.max_tourist_capacity),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSettings(data.settings)
      setDirty(false)
      toast({ title: "Free plan settings saved", description: "Changes take effect immediately for new tours and schedules." })
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    if (!settings) return
    setForm({
      max_tours: String(settings.max_tours),
      max_schedules_per_week: String(settings.max_schedules_per_week),
      max_tourist_capacity: String(settings.max_tourist_capacity),
    })
    setDirty(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Free Plan Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure the limits enforced on guides using the free plan. Changes apply instantly to all new tours and schedules — existing ones are not affected.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          These limits are enforced at the database level via triggers. Pro-plan guides bypass all limits.
          Guides who already have tours/schedules exceeding the new limits are <strong>not</strong> retroactively affected.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Free Plan Limits</CardTitle>
          <CardDescription>
            {settings
              ? `Last updated: ${new Date(settings.updated_at).toLocaleString()}`
              : "Loading current values…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-6">
              {FIELDS.map((f) => <Skeleton key={f.key} className="h-20 w-full" />)}
            </div>
          ) : (
            FIELDS.map((field) => {
              const Icon = field.icon
              const raw = form[field.key]
              const v = Number(raw)
              const isInvalid = raw !== "" && (!Number.isInteger(v) || v < field.min || v > field.max)
              const original = settings ? String((settings as any)[field.key]) : ""
              const changed = raw !== original

              return (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <Label htmlFor={field.key} className="text-sm font-medium">
                      {field.label}
                      {changed && <span className="ml-2 text-xs text-primary font-normal">(changed)</span>}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                  <div className="flex items-center gap-3">
                    <Input
                      id={field.key}
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={1}
                      value={raw}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className={`w-32 ${isInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <span className="text-sm text-muted-foreground">{field.unit}</span>
                  </div>
                  {isInvalid && (
                    <p className="text-xs text-destructive">Must be {field.min}–{field.max}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 italic">{field.hint}</p>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Action bar — only shown when there are unsaved changes */}
      {dirty && !loading && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">You have unsaved changes.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
