"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import {
  Menu,
  X,
  ChevronDown,
  User,
  LogOut,
  LayoutDashboard,
  Heart,
  Calendar,
  Settings,
  Compass,
  Loader2,
  Bell,
  Car,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/supabase/auth-context"
import { signOut as nextAuthSignOut } from "next-auth/react"
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useMessageNotificationsStore } from "@/store/message-notifications-store"
import { useRealtimeMessageNotifications } from "@/lib/messaging/useRealtimeMessageNotifications"
import { ThemeToggle } from "@/components/theme-toggle"
import { buildCityToursPath } from "@/lib/tour-url"
import { cn } from "@/lib/utils"
import { TourichoLogo } from "@/components/brand/touricho-logo"
import { useReviewLinkVisibility } from "@/hooks/use-review-link-visibility"
import { isSeller as checkIsSeller, isBuyer as checkIsBuyer } from "@/lib/marketplace/roles"

type NavbarVariant = "default" | "landingTemplate"

interface NavbarProps {
  variant?: NavbarVariant
}

export function Navbar({ variant = "default" }: NavbarProps = {}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { user, profile, isLoading } = useAuth()
  const showReviewLinks = useReviewLinkVisibility()
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const totalUnread = useMessageNotificationsStore((s) => s.totalUnread)

  useRealtimeMessageNotifications(user?.id || null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mobileMenuOpen])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener("resize", onResize, { passive: true })
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (variant !== "landingTemplate") {
      setIsScrolled(false)
      return
    }

    const onScroll = () => setIsScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [variant])

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

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Canonical role helpers
  const isBuyer = checkIsBuyer(profile?.role)
  const isSeller = checkIsSeller(profile?.role)
  const isTourist = isBuyer // backward-compat alias used below
  const isTouristAccountRoute =
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/bookings" ||
    pathname.startsWith("/bookings/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/")
  const showAccountOnlyMobileMenu = Boolean(user && isBuyer && isTouristAccountRoute)
  const isLanding = variant === "landingTemplate"
  const desktopNavButtonClass = isLanding
    ? "text-[color:var(--landing-muted)] hover:text-[color:var(--landing-ink)] hover:bg-[color:var(--landing-accent-soft)]"
    : "text-foreground/80 hover:text-foreground hover:bg-muted"
  const auxLinkClass = isLanding
    ? "text-sm font-medium text-[color:var(--landing-muted)] transition-colors hover:text-[color:var(--landing-ink)]"
    : "text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"

  const mobileMenuPanel =
    isMounted && mobileMenuOpen
      ? createPortal(
          <>
            <button
              type="button"
              role="presentation"
              aria-label="Close menu overlay"
              className="fixed inset-x-0 top-16 bottom-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              id="mobile-menu"
              className={cn(
                "fixed inset-x-0 top-16 z-50 border-t md:hidden",
                isLanding
                  ? "landing-template border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]"
                  : "border-border bg-background",
              )}
              style={{
                height: "calc(100dvh - 4rem)",
                paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
              }}
            >
              <div className="h-full overflow-y-auto px-4 py-4">
                {!showAccountOnlyMobileMenu && (
                  <>
                    <Link
                      href="/tours"
                      className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Find Tours
                    </Link>
                    <Link
                      href="/cars"
                      className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Rent a Car
                    </Link>
                    <Link
                      href="/how-it-works"
                      className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      How It Works
                    </Link>
                    <Link
                      href="/blog"
                      className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Blog
                    </Link>
                    {showReviewLinks ? (
                      <Link
                        href="/reviews"
                        className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Reviews
                      </Link>
                    ) : null}
                    <Link
                      href="/faq"
                      className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      FAQ
                    </Link>
                    <Link
                      href="/about"
                      className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      About Us
                    </Link>
                    {(!user || isBuyer) && (
                      <Link
                        href="/become-guide"
                        className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        List your services
                      </Link>
                    )}
                  </>
                )}
                <div
                  className={cn(
                    showAccountOnlyMobileMenu ? "" : "mt-4 border-t pt-4",
                    isLanding ? "border-[color:var(--landing-border)]" : "border-border",
                  )}
                >
                  {isLoading ? (
                    <div className="space-y-2 px-3">
                      <div className="h-10 w-full rounded bg-muted animate-pulse" />
                      <div className="h-10 w-full rounded bg-muted animate-pulse" />
                    </div>
                  ) : user && profile ? (
                    <>
                      <div className="mb-2 flex items-center gap-3 px-3 py-2.5">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || "User"} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{profile.full_name || "User"}</p>
                          <p className="text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                      {isSeller ? (
                        <>
                          <Link
                            href="/dashboard"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Dashboard
                          </Link>
                          <Link
                            href="/dashboard/tours"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            My Tours
                          </Link>
                          <Link
                            href="/dashboard/cars"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            My Cars
                          </Link>
                          <Link
                            href="/dashboard/bookings"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Bookings
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/profile"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            My Profile
                          </Link>
                          <Link
                            href="/bookings"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            My Bookings
                          </Link>
                          <Link
                            href="/messages"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Messages
                          </Link>
                          <Link
                            href="/profile?tab=wishlist"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Wishlist
                          </Link>
                          <Link
                            href="/profile/settings"
                            className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Settings
                          </Link>
                          {showAccountOnlyMobileMenu && (
                            <Link
                              href="/tours"
                              className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              Find Tours
                            </Link>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => {
                          handleSignOut()
                          setMobileMenuOpen(false)
                        }}
                        disabled={signingOut}
                        className="mt-2 block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {signingOut ? "Signing out..." : "Sign Out"}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Log in
                      </Link>
                      <Link
                        href="/register"
                        className="mt-2 block rounded-full bg-primary px-3 py-2.5 text-center text-base font-medium text-primary-foreground"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Register
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          isLanding
            ? cn(
                "landing-template border-b backdrop-blur-xl",
                isScrolled
                  ? "border-[color:var(--landing-border)] bg-[color:var(--landing-nav-bg-solid)] shadow-[var(--landing-shadow-sm)]"
                  : "border-transparent bg-[color:var(--landing-nav-bg)]",
              )
            : "bg-background border-b border-border",
        )}
      >
        <nav className={cn("mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8", isLanding && "relative")}>
        {/* Logo */}
        <Link href="/" aria-label="Touricho home">
          <TourichoLogo
            size="md"
            markClassName={cn(isLanding && "shadow-[0_6px_16px_rgba(224,92,58,0.3)]")}
            textClassName={cn(isLanding ? "text-[color:var(--landing-ink)]" : "text-foreground")}
          />
        </Link>

        {/* Desktop Navigation - with overflow handling */}
        <div className="hidden overflow-x-auto overflow-y-hidden lg:flex lg:items-center lg:gap-x-1 lg:whitespace-nowrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn("gap-1", desktopNavButtonClass)}>
                Destinations <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={buildCityToursPath("paris")}>Paris</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={buildCityToursPath("rome")}>Rome</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={buildCityToursPath("barcelona")}>Barcelona</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={buildCityToursPath("london")}>London</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/tours">View All Cities</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" asChild className={desktopNavButtonClass}>
            <Link href="/tours">Find Tours</Link>
          </Button>
          <Button variant="ghost" asChild className={desktopNavButtonClass}>
            <Link href="/cars">Rent a Car</Link>
          </Button>
          <Button variant="ghost" asChild className={desktopNavButtonClass}>
            <Link href="/how-it-works">How It Works</Link>
          </Button>
          <Button variant="ghost" asChild className={desktopNavButtonClass}>
            <Link href="/blog">Blog</Link>
          </Button>
          {showReviewLinks ? (
            <Button variant="ghost" asChild className={desktopNavButtonClass}>
              <Link href="/reviews">Reviews</Link>
            </Button>
          ) : null}
          <Button variant="ghost" asChild className={desktopNavButtonClass}>
            <Link href="/faq">FAQ</Link>
          </Button>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-9 w-20 rounded-full bg-muted animate-pulse" />
            </div>
          ) : user && profile ? (
            <>
              {isBuyer && (
                <Link
                  href="/become-guide"
                  className={auxLinkClass}
                >
                  List your services
                </Link>
              )}
              <Button variant="ghost" size="icon" className="relative" asChild aria-label="Open messages">
                <Link href="/messages">
                  <Bell className="h-5 w-5 text-foreground/80" />
                  {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary px-1 text-center text-[10px] leading-[18px] text-primary-foreground">
                      {totalUnread}
                    </span>
                  )}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || "User"} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
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
                  {isSeller ? (
                    <>
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
                        <Link href="/dashboard/cars" className="cursor-pointer">
                          <Car className="mr-2 h-4 w-4" />
                          My Cars
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
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          My Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/bookings" className="cursor-pointer">
                          <Calendar className="mr-2 h-4 w-4" />
                          My Bookings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile?tab=wishlist" className="cursor-pointer">
                          <Heart className="mr-2 h-4 w-4" />
                          Wishlist
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile/settings" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
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
            </>
          ) : (
            <>
              <Link
                href="/become-guide"
                className={auxLinkClass}
              >
                List your services
              </Link>
              <Link
                href="/login"
                className={auxLinkClass}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className={cn(
                  "inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90",
                  isLanding && "landing-btn-coral",
                )}
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile/Tablet controls */}
        <div className="inline-flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            className={cn(
              "relative inline-flex items-center justify-center rounded-md p-2 text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isLanding && "text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)]",
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        </nav>
      </header>
      {mobileMenuPanel}
    </>
  )
}
