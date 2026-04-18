"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, CheckCircle, XCircle, MapPin, Globe, User, Clock } from "lucide-react"

type Guide = {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  city?: string
  phone?: string
  bio?: string
  languages?: string[]
  created_at: string
  guide_approval_status: "pending" | "approved" | "rejected" | null
  onboarding_completed?: boolean
}

const STATUS_CONFIG = {
  pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-300" },
}

export default function AdminGuidesPage() {
  const { toast } = useToast()
  const [guides, setGuides] = useState<Guide[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [page, setPage] = useState(1)
  const limit = 20

  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchGuides = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        approval_status: statusFilter,
      })
      const res = await fetch(`/api/admin/guides?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGuides(data.guides)
      setTotal(data.total)
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load guides",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, toast])

  useEffect(() => {
    fetchGuides()
  }, [fetchGuides])

  const handleAction = async (guideId: string, action: "approved" | "rejected") => {
    setActionLoading(guideId + action)
    try {
      const res = await fetch(`/api/admin/guides/${guideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guide_approval_status: action }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      toast({
        title: action === "approved" ? "Guide Approved" : "Guide Rejected",
        description:
          action === "approved"
            ? "The guide has been approved and notified by email."
            : "The guide application has been rejected.",
      })
      setSelectedGuide(null)
      fetchGuides()
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Action failed",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guide Applications</h1>
          <p className="text-sm text-muted-foreground">{total} {statusFilter === "all" ? "total" : statusFilter} applications</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGuides}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All Applications</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : guides.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No {statusFilter === "all" ? "" : statusFilter} applications found.
            </div>
          ) : (
            <div className="divide-y">
              {guides.map((guide) => {
                const statusCfg = guide.guide_approval_status
                  ? STATUS_CONFIG[guide.guide_approval_status]
                  : null
                return (
                  <div key={guide.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <Avatar className="h-11 w-11 flex-shrink-0">
                      <AvatarImage src={guide.avatar_url} />
                      <AvatarFallback>
                        {(guide.full_name || guide.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{guide.full_name || "—"}</p>
                        {statusCfg && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.className}`}>
                            {statusCfg.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{guide.email}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {guide.city && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {guide.city}
                          </span>
                        )}
                        {guide.languages && guide.languages.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            {guide.languages.slice(0, 3).join(", ")}
                            {guide.languages.length > 3 && ` +${guide.languages.length - 3}`}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Applied {new Date(guide.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedGuide(guide)}
                      >
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                      {guide.guide_approval_status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleAction(guide.id, "approved")}
                            disabled={actionLoading === guide.id + "approved"}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            {actionLoading === guide.id + "approved" ? "Approving..." : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(guide.id, "rejected")}
                            disabled={actionLoading === guide.id + "rejected"}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            {actionLoading === guide.id + "rejected" ? "Rejecting..." : "Reject"}
                          </Button>
                        </>
                      )}
                      {guide.guide_approval_status === "rejected" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleAction(guide.id, "approved")}
                          disabled={actionLoading === guide.id + "approved"}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
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
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Guide Detail Dialog */}
      <Dialog open={!!selectedGuide} onOpenChange={(o) => !o && setSelectedGuide(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Guide Application</DialogTitle>
            <DialogDescription>
              Review this guide's application details before approving or rejecting.
            </DialogDescription>
          </DialogHeader>
          {selectedGuide && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selectedGuide.avatar_url} />
                  <AvatarFallback className="text-lg">
                    {(selectedGuide.full_name || selectedGuide.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{selectedGuide.full_name || "—"}</p>
                  <p className="text-sm text-muted-foreground">{selectedGuide.email}</p>
                  {selectedGuide.phone && (
                    <p className="text-sm text-muted-foreground">{selectedGuide.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">City</p>
                  <p className="font-medium">{selectedGuide.city || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Applied</p>
                  <p className="font-medium">{new Date(selectedGuide.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedGuide.languages && selectedGuide.languages.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Languages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGuide.languages.map((lang) => (
                      <Badge key={lang} variant="secondary" className="text-xs">{lang}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedGuide.bio && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Bio</p>
                  <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-lg p-3">
                    {selectedGuide.bio}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedGuide(null)}>
              Close
            </Button>
            {selectedGuide?.guide_approval_status !== "approved" && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => selectedGuide && handleAction(selectedGuide.id, "approved")}
                disabled={!!actionLoading}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {actionLoading ? "Processing..." : "Approve"}
              </Button>
            )}
            {selectedGuide?.guide_approval_status !== "rejected" && (
              <Button
                variant="destructive"
                onClick={() => selectedGuide && handleAction(selectedGuide.id, "rejected")}
                disabled={!!actionLoading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {actionLoading ? "Processing..." : "Reject"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
