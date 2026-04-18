"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BadgeCheck, ClipboardList, ShieldAlert, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type AdminStats = {
  pendingVerifications: number
  openDisputes: number
  toursToReview: number
  newGuides: number
}

type VerificationQueueItem = {
  id: string
  name: string
  submitted: string | null
  status: string
}

type DisputeQueueItem = {
  id: string
  tour: string
  issue: string
}

export default function AdminClient() {
  const [stats, setStats] = useState<AdminStats>({
    pendingVerifications: 0,
    openDisputes: 0,
    toursToReview: 0,
    newGuides: 0,
  })
  const [verificationQueue, setVerificationQueue] = useState<VerificationQueueItem[]>([])
  const [disputeQueue, setDisputeQueue] = useState<DisputeQueueItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch("/api/admin/overview")
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error || "Failed to load admin overview")
        }
        const data = await res.json()
        setStats(data.stats)
        setVerificationQueue(data.verificationQueue || [])
        setDisputeQueue(data.disputeQueue || [])
      } catch (err) {
        console.error("[v0] Failed to load admin overview:", err)
        setError(err instanceof Error ? err.message : "Failed to load admin overview")
      }
    }

    fetchOverview()
  }, [])

  const adminStats = [
    { label: "Pending verifications", value: stats.pendingVerifications.toString(), icon: BadgeCheck },
    { label: "Open disputes", value: stats.openDisputes.toString(), icon: ShieldAlert },
    { label: "Tours to review", value: stats.toursToReview.toString(), icon: ClipboardList },
    { label: "New guides", value: stats.newGuides.toString(), icon: Users },
  ]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Admin Console</p>
            <h1 className="text-2xl font-semibold">Operations Overview</h1>
          </div>
          <Button asChild>
            <Link href="/">Back to site</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>Admin data unavailable</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {adminStats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">Updated today</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Verification queue</CardTitle>
              <CardDescription>Approve guides, request more information, or reject submissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {verificationQueue.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending verifications.</p>
              )}
              {verificationQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Submitted {item.submitted ? new Date(item.submitted).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Badge>{item.status}</Badge>
                    <Button size="sm">Review</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dispute alerts</CardTitle>
              <CardDescription>Open issues requiring admin resolution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {disputeQueue.length === 0 && <p className="text-sm text-muted-foreground">No disputes to review.</p>}
              {disputeQueue.map((dispute) => (
                <div key={dispute.id} className="rounded-lg border border-border/60 p-4">
                  <p className="font-semibold">{dispute.tour}</p>
                  <p className="text-sm text-muted-foreground">Issue: {dispute.issue}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="secondary">Open</Badge>
                    <Button size="sm" variant="outline">
                      Resolve
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
