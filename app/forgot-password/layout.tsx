import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { absolute: "Reset Password | TipWalk" },
  description: "Reset your TipWalk account password. Enter your email and we'll send you a reset link.",
  robots: { index: false, follow: false },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
