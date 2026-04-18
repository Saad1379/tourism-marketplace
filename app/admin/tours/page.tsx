"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Search, Edit, Trash2, Globe, MapPin, Users, Clock, RefreshCw } from "lucide-react"

type Tour = {
  id: string
  title: string
  city: string
  country: string
  status: string
  created_at: string
  duration_minutes?: number
  max_group_size?: number
  languages: string[]
  categories: string[]
  guide?: { id: string; full_name: string; email: string }
}

export default function AdminToursPage() {
  const { toast } = useToast()
  const [tours, setTours] = useState<Tour[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  const [editTour, setEditTour] = useState<Tour | null>(null)
  const [editForm, setEditForm] = useState<Partial<Tour>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTourId, setDeleteTourId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTours = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/admin/tours?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTours(data.tours)
      setTotal(data.total)
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to load tours", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, toast])

  useEffect(() => { fetchTours() }, [fetchTours])

  const handleEdit = (tour: Tour) => {
    setEditTour(tour)
    setEditForm({
      title: tour.title,
      city: tour.city,
      country: tour.country,
      status: tour.status,
      duration_minutes: tour.duration_minutes,
      max_group_size: tour.max_group_size,
    })
  }

  const handleSave = async () => {
    if (!editTour) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/tours/${editTour.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Tour updated successfully" })
      setEditTour(null)
      fetchTours()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to update", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (tour: Tour) => {
    const newStatus = tour.status === "published" ? "draft" : "published"
    try {
      const res = await fetch(`/api/admin/tours/${tour.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: `Tour ${newStatus === "published" ? "published" : "unpublished"}` })
      fetchTours()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTourId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/tours/${deleteTourId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Tour deleted" })
      setDeleteTourId(null)
      fetchTours()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tours Management</h1>
          <p className="text-sm text-muted-foreground">{total} total tours</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTours}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, city, country..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tours Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tours</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tours.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No tours found.</div>
          ) : (
            <div className="divide-y">
              {tours.map((tour) => (
                <div key={tour.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{tour.title}</p>
                      <Badge variant={tour.status === "published" ? "default" : "secondary"}>
                        {tour.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{tour.city}, {tour.country}</span>
                      {tour.duration_minutes && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{tour.duration_minutes}m</span>
                      )}
                      {tour.max_group_size && (
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{tour.max_group_size} max</span>
                      )}
                      {tour.languages?.length > 0 && (
                        <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{tour.languages.join(", ")}</span>
                      )}
                    </div>
                    {tour.guide && (
                      <p className="text-xs text-muted-foreground mt-1">Guide: {tour.guide.full_name || tour.guide.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(tour)}
                    >
                      {tour.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(tour)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTourId(tour.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editTour} onOpenChange={(o) => !o && setEditTour(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tour</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editForm.title || ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={editForm.city || ""}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={editForm.country || ""}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration (mins)</Label>
                <Input
                  type="number"
                  value={editForm.duration_minutes || ""}
                  onChange={(e) => setEditForm({ ...editForm, duration_minutes: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Group Size</Label>
                <Input
                  type="number"
                  value={editForm.max_group_size || ""}
                  onChange={(e) => setEditForm({ ...editForm, max_group_size: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status || "draft"}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTour(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTourId} onOpenChange={(o) => !o && setDeleteTourId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tour?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tour and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Tour"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
