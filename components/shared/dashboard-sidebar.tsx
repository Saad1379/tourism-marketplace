"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { X, LogOut, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/lib/supabase/auth-context"
import { useToast } from "@/hooks/use-toast"
import { TourichoLogo } from "@/components/brand/touricho-logo"

export interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
  badge?: number | string
  group?: string
}

interface DashboardSidebarProps {
  items: SidebarItem[]
  onClose?: () => void
  userName?: string
  userEmail?: string
}

export function DashboardSidebar({ items, onClose, userName, userEmail }: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const { toast } = useToast()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      toast({ title: "Signed out", description: "You have been logged out." })
      router.push("/login")
    } catch (error) {
      console.error("Sign out error:", error)
      toast({ title: "Error", description: "Failed to sign out", variant: "destructive" })
    } finally {
      setSigningOut(false)
    }
  }

  // Group items by their group field
  const groups: { label: string | null; items: SidebarItem[] }[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const groupLabel = item.group ?? null
    const key = groupLabel ?? "__ungrouped__"
    if (!seen.has(key)) {
      seen.add(key)
      groups.push({ label: groupLabel, items: [] })
    }
    groups.find((g) => (g.label ?? "__ungrouped__") === key)!.items.push(item)
  }

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Brand header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[color:var(--landing-border)] px-4">
        <Link href="/" aria-label="Touricho home">
          <TourichoLogo size="sm" textClassName="text-[color:var(--landing-ink)] text-sm" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-[color:var(--landing-muted)] hover:text-[color:var(--landing-ink)] lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-3 space-y-5">
          {groups.map(({ label, items: groupItems }) => (
            <div key={label ?? "ungrouped"}>
              {label && (
                <p className="mb-1.5 select-none px-3 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--landing-muted-2)]">
                  {label}
                </p>
              )}
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))

                  return (
                    <Link key={item.href} href={item.href} onClick={onClose}>
                      <div
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                          isActive
                            ? "border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)]"
                            : "text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)]/70 hover:text-[color:var(--landing-ink)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                            {item.badge}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {userName && (
        <div className="flex-shrink-0 border-t border-[color:var(--landing-border)] p-3">
          <div className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[color:var(--landing-accent-soft)]/70">
            <div className="flex h-8 w-8 flex-shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium leading-tight text-[color:var(--landing-ink)]">{userName}</p>
              {userEmail && (
                <p className="truncate text-xs leading-tight text-[color:var(--landing-muted)]">{userEmail}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-[color:var(--landing-muted)] opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
            >
              {signingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
