"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Map,
  Users,
  Tag,
  CreditCard,
  MapPin,
  Menu,
  X,
  LogOut,
  Loader2,
  ChevronRight,
  Shield,
  UserCheck,
  Bell,
  SlidersHorizontal,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/lib/supabase/auth-context"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { TipWalkLogo } from "@/components/brand/tipwalk-logo"

const adminNavItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/admin/overview" },
  { icon: Map, label: "Tours", href: "/admin/tours" },
  { icon: FileText, label: "Blog", href: "/admin/blog" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: UserCheck, label: "Guides", href: "/admin/guides" },
  { icon: Tag, label: "Promo Codes", href: "/admin/promo-codes" },
  { icon: CreditCard, label: "Credits", href: "/admin/credits" },
  { icon: MapPin, label: "Cities", href: "/admin/cities" },
  { icon: SlidersHorizontal, label: "Plan Settings", href: "/admin/plan-settings" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { toast } = useToast()
  const [signingOut, setSigningOut] = useState(false)
  const [pendingGuidesCount, setPendingGuidesCount] = useState(0)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const realtimeChannelRef = useRef<ReturnType<typeof createClient>["channel"] | null>(null)

  const pageTitle =
    [...adminNavItems]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.label || "Admin"

  // Fetch initial counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [guidesRes, notifRes] = await Promise.all([
          fetch("/api/admin/guides?approval_status=pending&limit=1"),
          fetch("/api/admin/notifications?unread=true"),
        ])
        const guidesData = await guidesRes.json()
        const notifData = await notifRes.json()
        if (!guidesData.error) setPendingGuidesCount(guidesData.total || 0)
        if (!notifData.error) setUnreadNotifCount(notifData.total || 0)
      } catch {
        // Silently fail — counts are decorative
      }
    }
    fetchCounts()
  }, [pathname])

  // Supabase Realtime — subscribe to new admin_notifications
  useEffect(() => {
    const supabase = createClient()
    interface AdminNotification {
      title: string
      message: string
      type: string
    }

    const channel = supabase
      .channel("admin-notifications")
      .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "admin_notifications" },
      (payload: { new: AdminNotification }) => {
        const notif = payload.new as AdminNotification
        setPendingGuidesCount((prev) => (notif.type === "guide_application" ? prev + 1 : prev))
        setUnreadNotifCount((prev) => prev + 1)
        toast({
        title: notif.title,
        description: notif.message,
        })
      }
      )
      .subscribe()

    realtimeChannelRef.current = channel as any

    return () => {
      supabase.removeChannel(channel)
    }
  }, [toast])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      toast({ title: "Signed out", description: "You have been logged out." })
      router.push("/login")
    } catch {
      toast({ title: "Error", description: "Failed to sign out", variant: "destructive" })
    } finally {
      setSigningOut(false)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/admin/notifications", { method: "PATCH" })
      setUnreadNotifCount(0)
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-card border-r shadow-sm
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b">
            <Link href="/admin/overview" className="flex items-center gap-2" aria-label="TipWalk Admin home">
              <TipWalkLogo size="sm" textClassName="text-sm text-foreground" />
              <div>
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-primary" />
                  <span className="text-xs text-primary font-medium">Admin</span>
                </div>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Nav */}
          <ScrollArea className="flex-1">
            <nav className="p-4 space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                const showBadge = item.href === "/admin/guides" && pendingGuidesCount > 0
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                    <div
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {showBadge && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-yellow-100 text-yellow-800"}`}>
                            {pendingGuidesCount}
                          </span>
                        )}
                        {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </nav>
          </ScrollArea>

          <Separator />

          {/* Footer */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email || "Admin"}</p>
                <Badge variant="secondary" className="text-xs">Admin</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/">Back to site</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center justify-between px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{pageTitle}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadNotifCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100 transition-colors"
                  title="Mark all notifications as read"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {unreadNotifCount} new
                </button>
              )}
              <Badge variant="outline" className="text-xs hidden sm:flex">
                Admin Console
              </Badge>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
