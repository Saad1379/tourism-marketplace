"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import { useMessageNotificationsStore } from "@/store/message-notifications-store"
import { useRealtimeMessageNotifications } from "@/lib/messaging/useRealtimeMessageNotifications"
import { DashboardSidebar } from "@/components/shared/dashboard-sidebar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
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
} from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const guideItems = [
  { icon: Home,         label: "Overview",     href: "/dashboard",              group: "Main" },
  { icon: Map,          label: "My Tours",     href: "/dashboard/tours",        group: "Main" },
  { icon: Calendar,     label: "Bookings",     href: "/dashboard/bookings",     group: "Main" },
  { icon: MessageSquare,label: "Messages",     href: "/dashboard/messages",     group: "Main" },
  { icon: Star,         label: "Reviews",      href: "/dashboard/reviews",      group: "Growth" },
  { icon: Zap,          label: "Credits",      href: "/dashboard/credits",      group: "Growth" },
  { icon: BarChart3,    label: "Analytics",    href: "/dashboard/analytics",    group: "Growth" },
  { icon: Crown,        label: "Upgrade",      href: "/dashboard/upgrade",      group: "Growth" },
  { icon: ShieldCheck,  label: "Verification", href: "/dashboard/verification", group: "Account" },
  { icon: Settings,     label: "Settings",     href: "/dashboard/settings",     group: "Account" },
]

const touristItems = [
  { icon: Home,          label: "Dashboard",     href: "/profile" },
  { icon: Calendar,      label: "Bookings",      href: "/bookings" },
  { icon: Heart,         label: "Wishlist",      href: "/profile?tab=wishlist" },
  { icon: MessageSquare, label: "Messages",      href: "/messages" },
  { icon: Bell,          label: "Notifications", href: "/profile?tab=notifications" },
  { icon: Settings,      label: "Settings",      href: "/profile/settings" },
]

export function DashboardLayoutPage({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { profile, user } = useAuth()
  const totalUnread = useMessageNotificationsStore((s) => s.totalUnread)

  useRealtimeMessageNotifications(user?.id || null)

  const isTourist = profile?.role === "tourist"
  const baseItems = isTourist ? touristItems : guideItems
  const items = baseItems.map((item) =>
    item.label === "Messages" && totalUnread > 0 ? { ...item, badge: totalUnread } : item
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isTourist || !user?.id) return

    const parsed = parseAutoTopupConfig(localStorage.getItem(AUTO_TOPUP_CONFIG_KEY))
    if (!parsed || !parsed.enabled || !parsed.packageId) return

    const threshold = typeof parsed.threshold === "number" ? parsed.threshold : AUTO_TOPUP_THRESHOLD
    const sessionKey = `tipwalk_auto_topup_redirected_${parsed.packageId}_${threshold}`
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
  }, [isTourist, user?.id, router])

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
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  )
}
