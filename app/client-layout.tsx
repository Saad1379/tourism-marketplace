"use client"

import type React from "react"
import { Suspense } from "react"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/providers/auth-provider"
import { AuthLoadingState } from "@/components/auth-loading-state"
import { AnalyticsSetup } from "@/components/analytics-setup"
import { AssistantWidget } from "@/components/assistant/assistant-widget"
import { LandingEffectsLoader } from "@/components/landing/landing-effects-loader"
import { Toaster } from "@/components/ui/sonner"

import { ThemeProvider } from "@/components/theme-provider"

function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <AuthLoadingState>{children}</AuthLoadingState>
          {/* Analytics setup with cookie banner */}
          <Suspense fallback={null}>
            <AnalyticsSetup />
          </Suspense>
          <Suspense fallback={null}>
            <LandingEffectsLoader />
          </Suspense>
   
          <Toaster position="top-right" expand={true} richColors closeButton />
        </AuthProvider>
      </ThemeProvider>
      <Analytics />
    </>
  )
}

export { ClientLayout }
export default ClientLayout
