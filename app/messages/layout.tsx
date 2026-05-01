import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Messages | Touricho",
  robots: {
    index: false,
    follow: false,
  },
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children
}
