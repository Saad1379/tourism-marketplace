"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, RefreshCw, CreditCard, Star } from "lucide-react"

type CreditPackage = {
  id: string
  name: string
  credits: number
  price_eur: number
  is_active: boolean
  is_popular: boolean
  savings_percentage?: number
  display_order: number
  created_at: string
}

const emptyForm = {
  name: "",
  credits: 100,
  price_eur: 9.99,
  is_active: true,
  is_popular: false,
  savings_percentage: "",
  display_order: 0,
}

export default function AdminCreditsPage() {
  const { toast } = useToast()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPkg, setEditPkg] = useState<CreditPackage | null>(null)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deletePkgId, setDeletePkgId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPackages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/credits")
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPackages(data.packages)
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchPackages() }, [fetchPackages])

  const openCreate = () => {
    setEditPkg(null)
    setForm({ ...emptyForm, display_order: packages.length })
    setDialogOpen(true)
  }

  const openEdit = (pkg: CreditPackage) => {
    setEditPkg(pkg)
    setForm({
      name: pkg.name,
      credits: pkg.credits,
      price_eur: pkg.price_eur,
      is_active: pkg.is_active,
      is_popular: pkg.is_popular,
      savings_percentage: pkg.savings_percentage?.toString() || "",
      display_order: pkg.display_order,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        price_eur: parseFloat(String(form.price_eur)),
        credits: parseInt(String(form.credits)),
        savings_percentage: form.savings_percentage ? parseInt(String(form.savings_percentage)) : null,
      }
      const url = editPkg ? `/api/admin/credits/${editPkg.id}` : "/api/admin/credits"
      const method = editPkg ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: editPkg ? "Package updated" : "Package created" })
      setDialogOpen(false)
      fetchPackages()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (pkg: CreditPackage, field: "is_active" | "is_popular") => {
    try {
      const res = await fetch(`/api/admin/credits/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !pkg[field] }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Package updated" })
      fetchPackages()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deletePkgId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/credits/${deletePkgId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({
        title: data.deactivated ? "Package deactivated" : "Package deleted",
        description: data.deactivated ? "This package has purchase history and was deactivated instead of deleted." : undefined,
      })
      setDeletePkgId(null)
      fetchPackages()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit Packages</h1>
          <p className="text-sm text-muted-foreground">Manage pricing visible to guides on the store page</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPackages}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Package
          </Button>
        </div>
      </div>

      {/* Packages Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No credit packages yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={`relative overflow-hidden ${pkg.is_popular ? "border-primary shadow-md" : ""}`}>
              {pkg.is_popular && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}
              {!pkg.is_active && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg gap-2">
                  <Badge variant="secondary" className="text-sm">Inactive</Badge>
                  <Button size="sm" onClick={() => handleToggle(pkg, "is_active")}>
                    Activate
                  </Button>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pkg.name}</CardTitle>
                <CardDescription>Order #{pkg.display_order}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold">€{Number(pkg.price_eur).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">{pkg.credits.toLocaleString()} credits</p>
                  {pkg.savings_percentage && (
                    <Badge variant="outline" className="mt-1 text-secondary border-secondary/30">
                      Save {pkg.savings_percentage}%
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active</span>
                    <Switch
                      checked={pkg.is_active}
                      onCheckedChange={() => handleToggle(pkg, "is_active")}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Most Popular</span>
                    <Switch
                      checked={pkg.is_popular}
                      onCheckedChange={() => handleToggle(pkg, "is_popular")}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(pkg)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletePkgId(pkg.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPkg ? "Edit Package" : "Create Credit Package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Package Name *</Label>
              <Input
                placeholder="e.g. Starter Pack"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Credits</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (EUR)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price_eur}
                  onChange={(e) => setForm({ ...form, price_eur: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Savings % (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 20"
                  value={form.savings_percentage}
                  onChange={(e) => setForm({ ...form, savings_percentage: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_popular}
                onCheckedChange={(v) => setForm({ ...form, is_popular: v })}
              />
              <Label>Mark as Most Popular</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Active (visible to guides)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editPkg ? "Save Changes" : "Create Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePkgId} onOpenChange={(o) => !o && setDeletePkgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credit Package?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this credit package. Existing purchases using this package will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
