"use client"

import type React from "react"
import { usePathname } from "next/navigation"

import { useAuth } from "@/lib/supabase/auth-context"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"

export function AuthLoadingState({ children }: { children: React.ReactNode }) {
  const { isLoading, error } = useAuth()
  const pathname = usePathname()

  const protectedPrefixes = ["/dashboard", "/profile", "/bookings", "/messages", "/admin", "/checkout"]
  const isProtectedRoute = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

  if (!isProtectedRoute) {
    return <>{children}</>
  }

  // Ignore AbortErrors - they're internal timeout implementation details, not real errors
  const actualError = error?.name === "AbortError" ? null : error

  if (actualError) {
    const isRecoverable =
      actualError.message?.includes("timeout") ||
      actualError.message?.includes("Connection timeout") ||
      actualError.message?.includes("network")

    const isNetworkError = isRecoverable

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full space-y-4">
          <div
            className={`${isNetworkError ? "bg-primary/10 border-primary/30" : "bg-destructive/10 border-destructive/30"} border rounded-lg p-4`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`w-6 h-6 ${isNetworkError ? "text-primary" : "text-destructive"} flex-shrink-0 mt-0.5`}
              />
              <div>
                <h1 className={`text-lg font-semibold ${isNetworkError ? "text-primary" : "text-destructive"} mb-2`}>
                  {isNetworkError ? "Connection Timeout" : "Authentication Error"}
                </h1>
                <p className={`text-sm ${isNetworkError ? "text-primary" : "text-destructive"} mb-4`}>{actualError.message}</p>

                {isNetworkError && (
                  <div
                    className={`text-xs ${isNetworkError ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"} p-2 rounded mb-3 space-y-1`}
                  >
                    <p className="font-semibold">Troubleshooting steps:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Check your internet connection</li>
                      <li>Disable VPN or proxy if using one</li>
                      <li>Check browser console for CORS errors</li>
                      <li>Try again in a few moments</li>
                    </ul>
                  </div>
                )}

                <details
                  className={`text-xs ${isNetworkError ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"} p-2 rounded cursor-pointer`}
                >
                  <summary className="font-mono font-bold">Debug Info</summary>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{actualError.stack}</pre>
                </details>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className={`w-full px-4 py-2 ${isNetworkError ? "bg-primary hover:bg-primary" : "bg-destructive hover:bg-destructive/90"} text-white rounded-lg font-medium transition flex items-center justify-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            {isNetworkError ? "Retry" : "Reload Page"}
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="space-y-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Connecting to Touricho...</p>
          <p className="text-xs text-muted-foreground">Authenticating with Supabase (timeout in 15 seconds)</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
