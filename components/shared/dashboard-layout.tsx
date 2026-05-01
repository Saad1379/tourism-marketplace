"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import { useMessageNotificationsStore } from "@/store/message-notifications-store"
import { useRealtimeMessageNotifications } from "@/lib/messaging/useRealtimeMessageNotifications"
import { DashboardSidebar } from "@/components/shared/dashboard-sidebar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { signOut as nextAuthSignOut } from "next-auth/react"
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { AUTO_TOPUP_CONFIG_KEY, AUTO_TOPUP_THRESHOLD, parseAutoTopupConfig } from "@/lib/credits/auto-topup"
import {
  Home,
  Map,
  Calendar,
  MessageSquare,
  Star,
  Zap,
  ShieldCheck,
  BarChart3,
  Settings,
  Crown,
  Menu,
  Heart,
  Bell,
  LayoutDashboard,
  Compass,
  LogOut,
  Loader2,
  Car,
} from "lucide-react"

import { isSeller } from "@/lib/marketplace/roles"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const sellerItems = [
  { icon: Home,         label: "Overview",     href: "/dashboard",              group: "Main" },
  { icon: Map,          label: "My Tours",     href: "/dashboard/tours",        group: "Main" },
  { icon: Car,          label: "My Cars",      href: "/dashboard/cars",         group: "Main" },
  { icon: Calendar,     label: "Bookings",     href: "/dashboard/bookings",     group: "Main" },
  { icon: MessageSquare,label: "Messages",     href: "/dashboard/messages",     group: "Main" },
  { icon: Star,         label: "Reviews",      href: "/dashboard/reviews",      group: "Growth" },
  { icon: Zap,          label: "Credits",      href: "/dashboard/credits",      group: "Growth" },
  { icon: BarChart3,    label: "Analytics",    href: "/dashboard/analytics",    group: "Growth" },
  { icon: Crown,        label: "Upgrade",      href: "/dashboard/upgrade",      group: "Growth" },
  { icon: ShieldCheck,  label: "Verification", href: "/dashboard/verification", group: "Account" },
  { icon: Settings,     label: "Settings",     href: "/dashboard/settings",     group: "Account" },
]

const buyerItems = [
  { icon: Home,          label: "Dashboard",     href: "/profile" },
  { icon: Calendar,      label: "Bookings",      href: "/bookings" },
  { icon: Heart,         label: "Wishlist",      href: "/profile?tab=wishlist" },
  { icon: MessageSquare, label: "Messages",      href: "/messages" },
  { icon: Bell,          label: "Notifications", href: "/profile?tab=notifications" },
  { icon: Settings,      label: "Settings",      href: "/profile/settings" },
]

export function DashboardLayoutPage({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { profile, user } = useAuth()
  const { toast } = useToast()
  const totalUnread = useMessageNotificationsStore((s) => s.totalUnread)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      try {
        const supabase = createSupabaseBrowserClient()
        await supabase.auth.signOut()
      } catch {
        // Best-effort - NextAuth is source of truth for session persistence.
      }
      await nextAuthSignOut({ redirect: false })
      toast({ title: "Success", description: "Signed out successfully" })
      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("[v0] Sign out error:", error)
      toast({ title: "Error", description: "Failed to sign out", variant: "destructive" })
    } finally {
      setSigningOut(false)
    }
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  useRealtimeMessageNotifications(user?.id || null)

  // Accept both old (tourist/guide) and new (buyer/seller) role names
  const isSellerRole = isSeller(profile?.role)
  const isBuyerRole = !isSellerRole
  const baseItems = isBuyerRole ? buyerItems : sellerItems
  const items = baseItems.map((item) =>
    item.label === "Messages" && totalUnread > 0 ? { ...item, badge: totalUnread } : item
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isBuyerRole || !user?.id) return

    const parsed = parseAutoTopupConfig(localStorage.getItem(AUTO_TOPUP_CONFIG_KEY))
    if (!parsed || !parsed.enabled || !parsed.packageId) return

    const threshold = typeof parsed.threshold === "number" ? parsed.threshold : AUTO_TOPUP_THRESHOLD
    const sessionKey = `touricho_auto_topup_redirected_${parsed.packageId}_${threshold}`
    if (sessionStorage.getItem(sessionKey) === "1") return

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/credits/balance", { cache: "no-store" })
        if (!response.ok || cancelled) return

        const payload = await response.json()
        const balance = Number(payload.balance || 0)

        if (balance <= threshold) {
          sessionStorage.setItem(sessionKey, "1")
          router.push(`/checkout?id=${encodeURIComponent(parsed.packageId)}&source=auto-topup`)
        }
      } catch (error) {
        console.error("[v0] Auto top-up check failed:", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isBuyerRole, user?.id, router])

  const pageTitle =
    [...baseItems]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.label ||
    "Dashboard"

  return (
    <div className="dashboard-template min-h-screen">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          dashboard-sidebar-surface fixed top-0 left-0 z-50 h-full w-64
          transform transition-transform duration-200 ease-in-out will-change-transform
          lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-label="Dashboard sidebar"
      >
        <DashboardSidebar
          items={items}
          onClose={() => setSidebarOpen(false)}
          userName={profile?.full_name || undefined}
          userEmail={profile?.email || undefined}
        />
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="dashboard-topbar-surface sticky top-0 z-30 flex h-14 items-center px-4 lg:px-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
                className="lg:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Menu className="w-4.5 h-4.5" />
              </Button>
              <h1 className="text-base font-semibold tracking-tight text-[color:var(--landing-ink)]">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle className="h-8 w-8" />
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 text-[color:var(--landing-muted)] hover:text-[color:var(--landing-ink)]"
                aria-label="Notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-[9px] font-bold leading-[16px] text-white text-center">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </Button>
              {isSellerRole && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 ml-1">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || "User"} />
                        <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">
                          {getInitials(profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center gap-2 p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || "User"} />
                        <AvatarFallback className="bg-primary text-[12px] text-primary-foreground">
                          {getInitials(profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-sm font-medium">{profile.full_name || "User"}</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/tours" className="cursor-pointer">
                        <Compass className="mr-2 h-4 w-4" />
                        My Tours
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/bookings" className="cursor-pointer">
                        <Calendar className="mr-2 h-4 w-4" />
                        Bookings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-destructive focus:text-destructive"
                      disabled={signingOut}
                    >
                      {signingOut ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4" />
                      )}
                      {signingOut ? "Signing out..." : "Sign Out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="dashboard-content p-4 lg:p-8 mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  )
}
