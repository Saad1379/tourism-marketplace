"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; positive: boolean }
  variant?: "primary" | "secondary" | "accent"
}

export function StatCard({ label, value, icon: Icon, trend, variant = "primary" }: StatCardProps) {
  const iconStyles = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    accent: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary",
  }

  const safeValue = typeof value === "number" ? (isNaN(value) ? 0 : value) : value

  return (
    <Card className="dashboard-card cursor-default rounded-2xl transition-all duration-200 hover:border-primary/20">
      <CardContent className="p-5">
        <div className={`inline-flex rounded-xl p-2.5 mb-3 ${iconStyles[variant]}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{safeValue}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
        {trend && (
          <p
            className={`text-xs font-medium mt-2.5 flex items-center gap-1 ${
              trend.positive ? "text-secondary dark:text-secondary" : "text-destructive dark:text-destructive"
            }`}
          >
            {trend.positive ? (
              <TrendingUp className="w-3 h-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="w-3 h-3" aria-hidden="true" />
            )}
            {trend.value}% vs last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}
