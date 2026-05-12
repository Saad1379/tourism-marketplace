"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Map, CalendarDays, Users, Save, RefreshCw, Info, Crown, Sparkles, CreditCard } from "lucide-react"

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

type SignupPromoState = {
  enabled: boolean
  credits: number
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

  // Signup promo state
  const [promoLoading, setPromoLoading] = useState(true)
  const [promoSaving, setPromoSaving] = useState(false)
  const [promo, setPromo] = useState<SignupPromoState>({ enabled: false, credits: 200 })
  const [promoCreditsInput, setPromoCreditsInput] = useState("200")

  // ── Free Plan Settings ──

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

  // ── Signup Promo Settings ──

  async function fetchPromo() {
    setPromoLoading(true)
    try {
      const res = await fetch("/api/admin/guide-signup-promo")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPromo({ enabled: data.enabled, credits: data.credits })
      setPromoCreditsInput(String(data.credits))
    } catch (err) {
      toast({ title: "Failed to load promo settings", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setPromoLoading(false)
    }
  }

  useEffect(() => { fetchPromo() }, [])

  async function handlePromoToggle(enabled: boolean) {
    setPromoSaving(true)
    try {
      const res = await fetch("/api/admin/guide-signup-promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPromo({ enabled: data.enabled, credits: data.credits })
      toast({
        title: data.enabled ? "Signup promo enabled" : "Signup promo disabled",
        description: data.enabled
          ? `New guides will receive Pro plan + ${data.credits} credits on signup.`
          : "New guides will start on the Free plan as usual.",
      })
    } catch (err) {
      toast({ title: "Failed to update", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setPromoSaving(false)
    }
  }

  async function handlePromoSaveCredits() {
    const v = Number(promoCreditsInput)
    if (!Number.isInteger(v) || v < 0 || v > 10000) {
      toast({ title: "Invalid credits value", description: "Must be a whole number between 0 and 10,000.", variant: "destructive" })
      return
    }
    setPromoSaving(true)
    try {
      const res = await fetch("/api/admin/guide-signup-promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: v }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPromo({ enabled: data.enabled, credits: data.credits })
      setPromoCreditsInput(String(data.credits))
      toast({ title: "Promo credits updated", description: `New guides will receive ${data.credits} credits on signup.` })
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setPromoSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan & Promo Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure free plan limits and guide signup promotions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchSettings(); fetchPromo() }} disabled={loading || promoLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${(loading || promoLoading) ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ─────────── Signup Promo Card ─────────── */}
      <Card className={`relative overflow-hidden border-2 transition-colors ${promo.enabled ? "border-amber-400/60 shadow-md shadow-amber-100/30" : "border-border"}`}>
        {promo.enabled && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
        )}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${promo.enabled ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md" : "bg-muted"}`}>
                <Crown className={`h-5 w-5 ${promo.enabled ? "text-white" : "text-muted-foreground"}`} />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Free Pro on Signup
                  {promo.enabled && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Grant new guides instant Pro plan + bonus credits at signup — no payment required.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {promoLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              {/* Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${promo.enabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {promo.enabled ? <Sparkles className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Enable signup promo</p>
                    <p className="text-xs text-muted-foreground">
                      {promo.enabled ? "New guides get Pro + credits instantly" : "New guides start on the Free plan"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="signup-promo-toggle"
                  checked={promo.enabled}
                  onCheckedChange={handlePromoToggle}
                  disabled={promoSaving}
                />
              </div>

              {/* Credits amount */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <Label htmlFor="promo-credits" className="text-sm font-medium">
                    Bonus Credits
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Number of credits gifted to each new guide at signup when the promo is active.
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    id="promo-credits"
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={promoCreditsInput}
                    onChange={(e) => setPromoCreditsInput(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">credits</span>
                  {String(promo.credits) !== promoCreditsInput && (
                    <Button size="sm" onClick={handlePromoSaveCredits} disabled={promoSaving}>
                      <Save className="h-3 w-3 mr-1" />
                      {promoSaving ? "Saving…" : "Save"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className={`flex items-start gap-3 rounded-lg border p-3.5 text-xs ${promo.enabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p>When enabled, every new guide who completes the signup flow receives:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><strong>Pro plan</strong> (12 months, non-auto-renewing)</li>
                    <li><strong>{promo.credits} credits</strong> added to their balance</li>
                    <li>A <strong>"Limited-Time Promo"</strong> banner on the signup page</li>
                  </ul>
                  <p className="mt-1 text-[11px] opacity-80">
                    Existing guides are not affected. Only future signups receive the promo.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─────────── Free Plan Limits Card ─────────── */}

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
