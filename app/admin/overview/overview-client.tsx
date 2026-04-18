"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  Map,
  Calendar,
  TrendingUp,
  Star,
  CreditCard,
  UserCheck,
  Globe,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

type OverviewData = {
  kpis: {
    totalUsers: number
    totalGuides: number
    totalTourists: number
    totalTours: number
    activeTours: number
    totalBookings: number
    totalRevenue: number
    bookingsByStatus: Record<string, number>
  }
  monthlyBookings: { month: string; count: number }[]
  monthlyRevenue: { month: string; revenue: number }[]
  monthlyUsers: { month: string; count: number }[]
  topTours: { id: string; title: string; count: number }[]
  topGuides: { id: string; guideName: string; revenue: number }[]
}

function formatMonth(month: string) {
  const [year, m] = month.split("-")
  const date = new Date(parseInt(year), parseInt(m) - 1)
  return date.toLocaleString("default", { month: "short" })
}

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  color = "text-primary",
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  sub?: string
  color?: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-muted`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle>Failed to load analytics</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data) return null

  const { kpis, monthlyBookings, monthlyRevenue, monthlyUsers, topTours, topGuides } = data

  const bookingChartData = monthlyBookings.map((d) => ({
    month: formatMonth(d.month),
    Bookings: d.count,
  }))

  const revenueChartData = monthlyRevenue.map((d) => ({
    month: formatMonth(d.month),
    Revenue: d.revenue,
  }))

  const userChartData = monthlyUsers.map((d) => ({
    month: formatMonth(d.month),
    Users: d.count,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time analytics across the entire platform</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Users" value={kpis.totalUsers.toLocaleString()} icon={Users} color="text-primary" />
        <KpiCard label="Guides" value={kpis.totalGuides.toLocaleString()} icon={UserCheck} color="text-secondary" />
        <KpiCard label="Tourists" value={kpis.totalTourists.toLocaleString()} icon={Globe} color="text-secondary" />
        <KpiCard label="Total Tours" value={kpis.totalTours.toLocaleString()} icon={Map} sub={`${kpis.activeTours} active`} color="text-primary" />
        <KpiCard label="Total Bookings" value={kpis.totalBookings.toLocaleString()} icon={Calendar} color="text-cyan-500" />
        <KpiCard label="Total Revenue" value={`${kpis.totalRevenue.toLocaleString()} cr`} icon={CreditCard} sub="in credits" color="text-secondary" />
        <KpiCard label="Confirmed Bookings" value={(kpis.bookingsByStatus.confirmed || 0).toLocaleString()} icon={Star} color="text-primary" />
        <KpiCard label="Completed Bookings" value={(kpis.bookingsByStatus.completed || 0).toLocaleString()} icon={TrendingUp} color="text-primary" />
      </div>

      {/* Booking Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(kpis.bookingsByStatus).map(([s, count]) => (
              <div key={s} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium capitalize">{s.replace("_", " ")}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Bookings (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={bookingChartData}>
                <defs>
                  <linearGradient id="bookingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="Bookings" stroke="var(--primary)" fill="url(#bookingGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue (credits)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="Revenue" stroke="var(--secondary)" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={userChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="Users" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Tours */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 Tours by Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTours.length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
              {topTours.map((tour, i) => (
                <div key={tour.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium truncate max-w-[180px]">{tour.title}</span>
                  </div>
                  <Badge variant="secondary">{tour.count} bookings</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Guides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 Earning Guides</CardTitle>
          <CardDescription>Ranked by total guests served</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topGuides.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            {topGuides.map((guide, i) => (
              <div key={guide.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="font-medium">{guide.guideName}</span>
                </div>
                <Badge variant="outline">{guide.revenue} guests</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
