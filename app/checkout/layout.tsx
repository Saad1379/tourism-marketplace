import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Checkout | TipWalk",
  robots: {
    index: false,
    follow: false,
  },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
