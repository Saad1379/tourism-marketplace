import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { absolute: "Create Account | TipWalk" },
  description:
    "Create your free TipWalk account to book free walking tours or start guiding travelers through your city.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Create Account | TipWalk",
    description: "Join TipWalk to book free walking tours or start guiding travelers through your city.",
    url: "/register",
    type: "website",
  },
  alternates: { canonical: "/register" },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
