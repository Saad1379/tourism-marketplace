"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("pointer-events-none opacity-0", className)}
        aria-hidden
      />
    )
  }

  const isDark = theme === "dark" || (theme === "system" && resolvedTheme === "dark")
  const nextTheme = isDark ? "light" : "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("text-foreground/80 hover:text-foreground", className)}
      aria-label={`Switch to ${nextTheme} mode`}
      onClick={() => setTheme(nextTheme)}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
