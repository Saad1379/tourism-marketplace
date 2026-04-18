import type { Metadata } from "next"
import VerificationClient from "./verification-client"

export const metadata: Metadata = {
  title: "Verification | TipWalk",
  description: "Submit guide verification documents and track review status.",
  robots: "noindex, nofollow",
}

export default function VerificationPage() {
  return <VerificationClient />
}
