"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CreditCard,
  Gift,
  Sparkles,
  TrendingUp,
  Clock3,
  Info,
  ArrowUpRight,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/supabase/auth-context"
import { createClient } from "@/lib/supabase/client"
import { AUTO_TOPUP_CONFIG_KEY, AUTO_TOPUP_THRESHOLD, parseAutoTopupConfig } from "@/lib/credits/auto-topup"

type CreditPackage = {
  id: string
  name: string
  credits: number
  price: number
  pricePerCredit: number
  isPopular: boolean
}

type CreditTransaction = {
  id: string
  type: string
  amount: number
  description: string | null
  created_at: string
}

type ActiveBoost = {
  id: string
  expires_at: string
  credits_spent: number
  boost_type: string
  tours?: { title?: string }
}

const BOOST_OPTIONS = [{ id: "30", days: 30, credits: 30 }]

export default function CreditsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile, isLoading: authLoading } = useAuth()

  const [loadingData, setLoadingData] = useState(true)
  const [currentCredits, setCurrentCredits] = useState(0)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [tours, setTours] = useState<any[]>([])
  const [selectedTour, setSelectedTour] = useState("")
  const [selectedBoostPackage, setSelectedBoostPackage] = useState("30")
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoost[]>([])

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState("")

  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const [redeeming, setRedeeming] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const [activatingBoost, setActivatingBoost] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false)
  const [autoTopupPackageId, setAutoTopupPackageId] = useState<string>("")

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (profile && profile.role !== "guide") {
      router.push("/")
    }
  }, [authLoading, user, profile, router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const parsed = parseAutoTopupConfig(localStorage.getItem(AUTO_TOPUP_CONFIG_KEY))
    if (!parsed) return
    setAutoTopupEnabled(parsed.enabled)
    setAutoTopupPackageId(parsed.packageId)
  }, [])

  useEffect(() => {
    if (!user || profile?.role !== "guide") return

    const fetchData = async () => {
      try {
        setLoadingData(true)

        const creditsRes = await fetch("/api/credits/balance", { cache: "no-store" })
        if (creditsRes.ok) {
          const creditJson = await creditsRes.json()
          setCurrentCredits(Number(creditJson.balance || 0))
          setTransactions((creditJson.transactions || []) as CreditTransaction[])
        }

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (authUser) {
          const [toursRes, boostsRes, packagesRes] = await Promise.all([
            fetch("/api/tours"),
            supabase
              .from("tour_boosts")
              .select(`id, expires_at, credits_spent, boost_type, tours!inner(title)`)
              .eq("guide_id", authUser.id)
              .eq("is_active", true)
              .gt("expires_at", new Date().toISOString())
              .order("expires_at", { ascending: true }),
            supabase
              .from("credit_packages")
              .select("id, name, credits, price_eur, is_popular")
              .eq("is_active", true)
              .order("display_order", { ascending: true }),
          ])

          if (toursRes.ok) {
            const toursJson = await toursRes.json()
            const publishedTours = Array.isArray(toursJson)
              ? toursJson.filter((tour: any) => tour.status === "published" || tour.published_at)
              : []
            setTours(publishedTours)
            if (publishedTours.length > 0) {
              setSelectedTour(publishedTours[0].id)
            }
          }

          if (!boostsRes.error && boostsRes.data) {
            setActiveBoosts(boostsRes.data as ActiveBoost[])
          }

          if (!packagesRes.error && packagesRes.data) {
            const parsedPackages: CreditPackage[] = packagesRes.data.map((pkg: any) => ({
              id: pkg.id,
              name: pkg.name,
              credits: Number(pkg.credits || 0),
              price: Number(pkg.price_eur || 0),
              pricePerCredit: Number(pkg.price_eur || 0) / Math.max(Number(pkg.credits || 1), 1),
              isPopular: Boolean(pkg.is_popular),
            }))
            setPackages(parsedPackages)

            const defaultPackage = parsedPackages.find((pkg) => pkg.isPopular) || parsedPackages[0]
            if (defaultPackage) {
              if (!selectedPackageId) setSelectedPackageId(defaultPackage.id)
              if (!autoTopupPackageId) setAutoTopupPackageId(defaultPackage.id)
            }
          }
        }
      } catch (error) {
        console.error("[v0] Failed to fetch credits page data:", error)
      } finally {
        setLoadingData(false)
      }
    }

    fetchData()
  }, [user, profile?.role])

  const selectedBoost = useMemo(
    () => BOOST_OPTIONS.find((item) => item.id === selectedBoostPackage) || BOOST_OPTIONS[0],
    [selectedBoostPackage],
  )

  const selectedPurchasePackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) || null,
    [packages, selectedPackageId],
  )

  const autoTopupPackage = useMemo(
    () => packages.find((pkg) => pkg.id === autoTopupPackageId) || null,
    [packages, autoTopupPackageId],
  )

  const handleRedeemPromo = async () => {
    if (!promoCode.trim()) return

    setRedeeming(true)
    setDialogError(null)

    try {
      const response = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus({ type: "success", message: data.message || "Promo code redeemed." })
        setRedeemDialogOpen(false)
        setPromoCode("")

        const creditsResponse = await fetch("/api/credits/balance", { cache: "no-store" })
        const creditsData = await creditsResponse.json()
        setCurrentCredits(Number(creditsData.balance || 0))
        setTransactions((creditsData.transactions || []) as CreditTransaction[])

        if (data.pro_upgraded) {
          window.location.reload()
        }
      } else {
        setDialogError(data.error || "Failed to redeem code")
      }
    } catch (error) {
      setDialogError("Network error occurred. Please try again.")
    } finally {
      setRedeeming(false)
    }
  }

  const handleActivateBoost = async () => {
    if (!selectedTour) {
      setStatus({ type: "error", message: "Select a tour before activating a boost." })
      return
    }

    setActivatingBoost(true)
    setStatus(null)

    try {
      const response = await fetch("/api/boosts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tour_id: selectedTour,
          credits: selectedBoost.credits,
          days: selectedBoost.days,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus({ type: "error", message: data.error || "Failed to activate boost." })
        return
      }

      setStatus({ type: "success", message: "Boost activated successfully." })
      setCurrentCredits((prev) => prev - selectedBoost.credits)

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        const { data: boostData } = await supabase
          .from("tour_boosts")
          .select(`id, expires_at, credits_spent, boost_type, tours!inner(title)`)
          .eq("guide_id", authUser.id)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: true })

        if (boostData) setActiveBoosts(boostData as ActiveBoost[])
      }
    } catch (error) {
      setStatus({ type: "error", message: "Network error while activating boost." })
    } finally {
      setActivatingBoost(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }

  if (!user || profile?.role !== "guide") {
    return null
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {status && (
        <Alert
          variant={status.type === "error" ? "destructive" : "default"}
          className={status.type === "success" ? "border-secondary/30 bg-secondary/10 text-secondary" : ""}
        >
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <section className="rounded-2xl border border-border/60 bg-gradient-to-r from-primary via-primary/95 to-secondary p-6 text-white">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-white/80 text-sm">Guide Wallet</p>
            <p className="text-5xl font-bold tracking-tight">{currentCredits}</p>
            <p className="text-white/80 mt-1">credits available</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">
                  <CreditCard className="h-4 w-4 mr-2" /> Buy Credits
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Buy Credits</DialogTitle>
                  <DialogDescription>Choose a package to fund your wallet.</DialogDescription>
                </DialogHeader>

                {loadingData ? (
                  <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4 mr-2" /> Loading packages...
                  </div>
                ) : (
                  <RadioGroup value={selectedPackageId} onValueChange={setSelectedPackageId} className="space-y-3 py-2">
                    {packages.map((pkg) => (
                      <Label
                        key={pkg.id}
                        htmlFor={pkg.id}
                        className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                          selectedPackageId === pkg.id ? "border-primary bg-primary/5" : "border-border/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem id={pkg.id} value={pkg.id} />
                          <div>
                            <p className="font-medium">{pkg.name}</p>
                            <p className="text-xs text-muted-foreground">{pkg.credits} credits • €{pkg.pricePerCredit.toFixed(2)}/credit</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">€{pkg.price}</p>
                          {pkg.isPopular && <Badge className="mt-1 bg-primary text-primary-foreground">Popular</Badge>}
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button>
                  <Button asChild disabled={!selectedPurchasePackage} onClick={() => setPurchaseDialogOpen(false)}>
                    <Link href={selectedPurchasePackage ? `/checkout?id=${selectedPurchasePackage.id}` : "#"}>
                      {selectedPurchasePackage ? `Checkout €${selectedPurchasePackage.price}` : "Select package"}
                    </Link>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/20">
                  <Gift className="h-4 w-4 mr-2" /> Redeem Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Redeem Promo Code</DialogTitle>
                  <DialogDescription>Apply promo codes for credits or Pro access benefits.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {dialogError && (
                    <Alert variant="destructive">
                      <AlertDescription>{dialogError}</AlertDescription>
                    </Alert>
                  )}
                  <Input
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(event.target.value.toUpperCase())
                      if (dialogError) setDialogError(null)
                    }}
                    placeholder="ENTER CODE"
                    className="uppercase tracking-widest text-center"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRedeemDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleRedeemPromo} disabled={redeeming || !promoCode.trim()}>
                    {redeeming ? <Spinner className="h-4 w-4 mr-2" /> : null}
                    {redeeming ? "Redeeming..." : "Redeem"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="inline-flex rounded-lg bg-primary/10 p-2 mb-3"><Wallet className="h-4 w-4 text-primary" /></div>
            <p className="text-2xl font-bold">{currentCredits}</p>
            <p className="text-sm text-muted-foreground">Current credits</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="inline-flex rounded-lg bg-secondary/10 p-2 mb-3"><Sparkles className="h-4 w-4 text-secondary" /></div>
            <p className="text-2xl font-bold">{activeBoosts.length}</p>
            <p className="text-sm text-muted-foreground">Active boosts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="inline-flex rounded-lg bg-chart-3/10 p-2 mb-3"><Clock3 className="h-4 w-4 text-chart-3" /></div>
            <p className="text-2xl font-bold">{transactions.length}</p>
            <p className="text-sm text-muted-foreground">Recent transactions</p>
          </CardContent>
        </Card>
      </section>

      {autoTopupEnabled && autoTopupPackage && (
        <Alert className="border-secondary/30 bg-secondary/10">
          <Info className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Auto top-up is enabled for <strong>{autoTopupPackage.name}</strong>. Checkout will auto-open when balance hits {AUTO_TOPUP_THRESHOLD} credits.
            </span>
            <Button asChild size="sm" variant="outline" className="bg-background">
              <Link href="/dashboard/upgrade">Manage</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Boost a Tour</CardTitle>
              <CardDescription>Use the 30-day boosted placement (30 credits) to improve visibility.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="boost-tour">Select tour</Label>
                <Select value={selectedTour} onValueChange={setSelectedTour} disabled={tours.length === 0}>
                  <SelectTrigger id="boost-tour">
                    <SelectValue placeholder={tours.length ? "Choose tour" : "No published tours available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tours.map((tour) => (
                      <SelectItem key={tour.id} value={tour.id}>{tour.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Boost duration</Label>
                <RadioGroup value={selectedBoostPackage} onValueChange={setSelectedBoostPackage} className="grid gap-2 sm:grid-cols-3">
                  {BOOST_OPTIONS.map((option) => (
                    <Label
                      key={option.id}
                      htmlFor={`boost-${option.id}`}
                      className={`rounded-lg border p-3 cursor-pointer ${
                        selectedBoostPackage === option.id ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id={`boost-${option.id}`} value={option.id} />
                          <span className="text-sm font-medium">{option.days}d</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{option.credits} cr</span>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <Button
                className="w-full"
                disabled={!selectedTour || activatingBoost || currentCredits < selectedBoost.credits}
                onClick={handleActivateBoost}
              >
                {activatingBoost ? <Spinner className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {currentCredits < selectedBoost.credits
                  ? `Need ${selectedBoost.credits - currentCredits} more credits`
                  : `Activate ${selectedBoost.days}-day boost (${selectedBoost.credits} credits)`}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Boosts</CardTitle>
              <CardDescription>Live campaigns currently influencing ranking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeBoosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active boosts yet.</p>
              ) : (
                activeBoosts.map((boost) => {
                  const daysLeft = Math.max(
                    0,
                    Math.ceil((new Date(boost.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                  )

                  return (
                    <div key={boost.id} className="rounded-lg border border-border/60 p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{boost.tours?.title || "Tour"}</p>
                        <p className="text-xs text-muted-foreground">{boost.credits_spent} credits spent • {daysLeft} days left</p>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Credit Packages</CardTitle>
              <CardDescription>Top up quickly from your preferred package.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingData ? (
                <div className="text-sm text-muted-foreground flex items-center"><Spinner className="h-4 w-4 mr-2" /> Loading packages...</div>
              ) : (
                packages.map((pkg) => (
                  <div key={pkg.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{pkg.name}</p>
                        <p className="text-xs text-muted-foreground">{pkg.credits} credits • €{pkg.pricePerCredit.toFixed(2)}/credit</p>
                      </div>
                      <p className="font-semibold">€{pkg.price}</p>
                    </div>
                    <Button asChild className="w-full mt-3" variant={pkg.isPopular ? "default" : "outline"}>
                      <Link href={`/checkout?id=${pkg.id}`}>
                        Buy {pkg.credits} credits <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest wallet activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                transactions.map((tx) => {
                  const date = new Date(tx.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })

                  return (
                    <div key={tx.id} className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{tx.description || tx.type}</p>
                        <p className="text-xs text-muted-foreground">{date}</p>
                      </div>
                      <span className={tx.amount > 0 ? "text-secondary font-semibold" : "text-muted-foreground font-semibold"}>
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </span>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-3.5 w-3.5" /> Credits never expire and can be reused across campaigns.
      </div>
    </div>
  )
}
