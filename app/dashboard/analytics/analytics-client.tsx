"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  TrendingUp,
  Users,
  Star,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, BarChart, Bar } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useAuth } from "@/lib/supabase/auth-context"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Spinner } from "@/components/ui/spinner"

type AnalyticsSummary = {
  bookings: number
  attendanceRate: number
  averageRating: number
  revenue: number
}

type WeeklyRow = {
  name: string
  bookings: number
  attendance: number
  revenue: number
}

type TopTour = {
  id: string
  title: string
  city: string
  bookings: number
  attendanceRate: number
  rating: number
}

import { isSeller } from "@/lib/marketplace/roles"

export default function AnalyticsClient() {
  const router = useRouter()
  const { user, profile, isLoading: authLoading } = useAuth()

  const [summary, setSummary] = useState<AnalyticsSummary>({
    bookings: 0,
    attendanceRate: 0,
    averageRating: 0,
    revenue: 0,
  })
  const [weeklyData, setWeeklyData] = useState<WeeklyRow[]>([])
  const [topTours, setTopTours] = useState<TopTour[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (profile && !isSeller(profile.role)) {
      router.push("/")
    }
  }, [authLoading, user, profile, router])

  const chartConfig = useMemo(
    () => ({
      bookings: { label: "Bookings", color: "var(--chart-1)" },
      attendance: { label: "Attended", color: "var(--chart-2)" },
      revenue: { label: "Revenue", color: "var(--chart-3)" },
    }),
    [],
  )

  useEffect(() => {
    if (!user || !isSeller(profile?.role)) return

    const fetchAnalytics = async () => {
      try {
        setIsLoading(true)
        const res = await fetch("/api/analytics")
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error || "Failed to load analytics")
        }
        const data = await res.json()
        setSummary(data.summary)
        setWeeklyData(data.weekly || [])
        setTopTours(data.topTours || [])
      } catch (err) {
        console.error("[v0] Failed to load analytics:", err)
        setError(err instanceof Error ? err.message : "Failed to load analytics")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [user, profile?.role])

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner label="Loading analytics..." />
      </div>
    )
  }

  if (!user || !isSeller(profile?.role)) {
    return null
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="rounded-2xl border border-border/60 bg-gradient-to-r from-primary/8 via-primary/5 to-secondary/10 p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2">Last 7 days</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Seller Analytics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Understand booking momentum, attendance quality, and revenue trends.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="bg-background">
              <Link href="/dashboard/credits">Manage Credits</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/tours">
                Open My Tours <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Analytics unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2"><Calendar className="h-4 w-4 text-primary" /></div>
            <p className="text-2xl font-bold">{summary.bookings}</p>
            <p className="text-sm text-muted-foreground">Total bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 inline-flex rounded-lg bg-secondary/10 p-2"><Users className="h-4 w-4 text-secondary" /></div>
            <p className="text-2xl font-bold">{summary.attendanceRate}%</p>
            <p className="text-sm text-muted-foreground">Attendance rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 inline-flex rounded-lg bg-chart-3/10 p-2"><Star className="h-4 w-4 text-chart-3" /></div>
            <p className="text-2xl font-bold">{summary.averageRating.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">Average rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2"><TrendingUp className="h-4 w-4 text-primary" /></div>
            <p className="text-2xl font-bold">€{summary.revenue.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground">Platform fee revenue</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-primary" />
              Weekly Bookings vs Attendance
            </CardTitle>
            <CardDescription>Submitted bookings compared with attended guests.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                <Spinner className="h-4 w-4 mr-2" /> Loading chart...
              </div>
            ) : weeklyData.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">No data yet.</div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[320px]">
                <LineChart data={weeklyData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="bookings" type="monotone" stroke="var(--color-bookings)" strokeWidth={2} dot={false} />
                  <Line dataKey="attendance" type="monotone" stroke="var(--color-attendance)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-secondary" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Estimated daily platform fee revenue from Pro bookings.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                <Spinner className="h-4 w-4 mr-2" /> Loading chart...
              </div>
            ) : weeklyData.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">No revenue data yet.</div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[320px]">
                <BarChart data={weeklyData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Tours</CardTitle>
            <CardDescription>Use these tours as templates for future listings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Spinner className="h-4 w-4 mr-2" /> Loading top tours...
              </div>
            )}
            {!isLoading && topTours.length === 0 && (
              <p className="text-sm text-muted-foreground">No performance data yet. Publish tours to start collecting analytics.</p>
            )}
            {topTours.map((tour) => (
              <div
                key={tour.id}
                className="rounded-xl border border-border/60 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-foreground">{tour.title}</p>
                  <p className="text-sm text-muted-foreground">{tour.city}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{tour.bookings} bookings</Badge>
                  <Badge variant="outline">{tour.attendanceRate}% attendance</Badge>
                  <span className="inline-flex items-center gap-1 text-chart-3 px-2 py-1 rounded-md bg-chart-3/10">
                    <Star className="h-3.5 w-3.5 fill-chart-3" />
                    {tour.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Prioritized improvements for conversion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/60 p-4">
              <p className="font-medium">Increase visibility</p>
              <p className="text-xs text-muted-foreground mt-1">Run a boost campaign on your top tour this week.</p>
              <Button asChild size="sm" className="mt-3 w-full">
                <Link href="/dashboard/credits">Boost a Tour</Link>
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="font-medium">Improve attendance</p>
              <p className="text-xs text-muted-foreground mt-1">Send reminder messages to reduce no-shows.</p>
              <Button asChild size="sm" variant="outline" className="mt-3 w-full bg-transparent">
                <Link href="/dashboard/messages">Open Messages</Link>
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 p-4 bg-secondary/10">
              <p className="font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-secondary" />Improve your top tours</p>
              <p className="text-xs text-muted-foreground mt-1">The same full analytics are available on both Free and Pro. Use these insights to optimize titles, slots, and messaging.</p>
              <Button asChild size="sm" className="mt-3 w-full">
                <Link href="/dashboard/tours">Edit Tours</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
