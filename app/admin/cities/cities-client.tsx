"use client"

import { useEffect, useState } from "react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, MapPin, Euro } from "lucide-react"

type City = {
  id: string
  name: string
  country: string
  slug: string
  credits_per_adult: number
  is_active: boolean
  created_at: string
}

const emptyForm = { name: "", country: "", credits_per_adult: "3", is_active: true }

export default function CitiesClient() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCity, setEditingCity] = useState<City | null>(null)
  const [deletingCity, setDeletingCity] = useState<City | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { toast } = useToast()

  useEffect(() => { fetchCities() }, [])

  async function fetchCities() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/cities")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCities(json.cities)
    } catch (err) {
      toast({ title: "Failed to load cities", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditingCity(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(city: City) {
    setEditingCity(city)
    setForm({
      name: city.name,
      country: city.country,
      credits_per_adult: String(city.credits_per_adult),
      is_active: city.is_active,
    })
    setDialogOpen(true)
  }

  function openDelete(city: City) {
    setDeletingCity(city)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    const fee = Number(form.credits_per_adult)
    if (!form.name.trim() || !form.country.trim()) {
      toast({ title: "Name and country are required", variant: "destructive" })
      return
    }
    if (!Number.isInteger(fee) || fee < 0 || fee > 100) {
      toast({ title: "Fee must be a whole number between 0 and 100", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const url = editingCity ? `/api/admin/cities/${editingCity.id}` : "/api/admin/cities"
      const method = editingCity ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          country: form.country.trim(),
          credits_per_adult: fee,
          is_active: form.is_active,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      toast({
        title: editingCity ? "City updated" : "City added",
        description: `${form.name} — €${fee}/adult`,
      })
      setDialogOpen(false)
      await fetchCities()
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingCity) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/cities/${deletingCity.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast({ title: "City deleted", description: deletingCity.name })
      setDeleteDialogOpen(false)
      await fetchCities()
    } catch (err) {
      toast({ title: "Cannot delete", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cities</h1>
          <p className="text-muted-foreground mt-1">
            Manage available cities and set the booking fee (credits per adult) for each.
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Add City
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            All Cities
          </CardTitle>
          <CardDescription>
            1 credit = €1. The fee is deducted from the guide's credit balance per adult attendee at booking time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : cities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No cities yet. Add one to get started.</p>
          ) : (
            <div className="divide-y">
              {cities.map((city) => (
                <div key={city.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{city.name}</span>
                        {!city.is_active && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{city.country} · slug: <code className="bg-muted px-1 rounded">{city.slug}</code></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{city.credits_per_adult}</span>
                      <span className="text-xs text-muted-foreground">/adult</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(city)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDelete(city)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCity ? "Edit City" : "Add City"}</DialogTitle>
            <DialogDescription>
              {editingCity
                ? "Update the city details. The slug cannot be changed."
                : "New cities will be immediately available in the guide's tour creation form."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="city-name">City name *</Label>
              <Input
                id="city-name"
                placeholder="e.g. Marseille"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city-country">Country *</Label>
              <Input
                id="city-country"
                placeholder="e.g. France"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city-fee">Booking fee (credits per adult)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="city-fee"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="w-28"
                  value={form.credits_per_adult}
                  onChange={(e) => setForm((f) => ({ ...f, credits_per_adult: e.target.value }))}
                />
                <span className="text-sm text-muted-foreground">= €{form.credits_per_adult || "?"} per adult</span>
              </div>
              <p className="text-xs text-muted-foreground">Set to 0 for a free city (no fee charged).</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive cities are hidden from guides.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            {!editingCity && form.name && (
              <p className="text-xs text-muted-foreground">
                Slug will be auto-generated: <code className="bg-muted px-1 rounded">{form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}</code>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingCity ? "Save changes" : "Add city"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingCity?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the city. Tours referencing this city will not be affected, but it will no longer appear in the city dropdown for new tours.
              If any active tours use this city, deletion will be blocked — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
