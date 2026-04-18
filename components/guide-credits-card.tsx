"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Info } from "lucide-react"

interface GuideCreditsCardProps {
  balance: number
}

export function GuideCreditsCard({ balance }: GuideCreditsCardProps) {
  const safeBalance = balance ?? 0

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Credits Balance</CardTitle>
              <CardDescription>Earned from bookings</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-4xl font-bold text-primary">{safeBalance}</div>
        <div className="flex items-start gap-2 p-3 bg-secondary/10 rounded-lg">
          <Info className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            You earn <span className="font-semibold text-foreground">3 credits per adult booking</span> on your tours.
            Use credits to promote tours or unlock premium features.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
