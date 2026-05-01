import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { absolute: "Create Account | Touricho" },
  description:
    "Create your free Touricho account to book free walking tours or start guiding travelers through your city.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Create Account | Touricho",
    description: "Join Touricho to book free walking tours or start guiding travelers through your city.",
    url: "/register",
    type: "website",
  },
  alternates: { canonical: "/register" },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
